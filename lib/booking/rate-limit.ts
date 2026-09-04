import { lt, lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { rateLimits, webhookEvents } from '../../db/schema';

/**
 * webhook_events 멱등 키 보관 기간.
 *
 * 이 페이로드는 "같은 이벤트를 두 번 처리하지 않기" 위한 단기 판정용이다(토스 재시도는
 * 길어야 며칠). payments.rawResponse처럼 전자상거래법 5년 보관 대상이 아니므로
 * (db/schema.ts payments.rawResponse 주석 참조) 90일이면 충분히 넉넉하다.
 */
const WEBHOOK_EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * 90일 지난 webhook_events 행을 지운다. 실패해도 삼킨다 — 부가 정리 작업이 본 처리
 * (rate-limit 판정·웹훅 처리)를 막으면 안 된다.
 */
const cleanupExpiredWebhookEvents = async (now: number): Promise<void> => {
  try {
    await getDb()
      .delete(webhookEvents)
      .where(lt(webhookEvents.processedAt, new Date(now - WEBHOOK_EVENT_RETENTION_MS)));
  } catch (error: unknown) {
    console.error('[booking-rate-limit] webhook_events 정리 실패:', error);
  }
};

/**
 * 범용 요청 제한 카운터.
 *
 * `lib/contracts/admin-rate-limit.ts`의 `checkDownloadRateLimit` 패턴을 그대로 따른다 —
 * rate_limits 테이블에 원자적 UPSERT(count + 1)로 증가시키므로 서버리스 다중 인스턴스에서도
 * Turso가 공유 카운터 역할을 해 안전하다. 키·한도·창을 인자화해 여러 호출부(예약 생성 등)가
 * 재사용할 수 있게 일반화했다.
 *
 * true = 허용(한도 이내), false = 한도 초과.
 */
export const consumeRateLimit = async (
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> => {
  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

    // webhook_events에 쓰는 곳은 pages/api/payments/webhook.ts 하나뿐이고(db/schema.ts
    // webhookEvents 주석), 그 핸들러는 처리 전에 반드시 이 함수를 `webhook:ip:*` 키로
    // 먼저 호출한다(rate-limit 통과 여부와 무관하게). 별도 정리 배치·cron을 새로 두는 대신
    // 이미 있는 이 호출에 lazy cleanup을 얹는다 — 위 rate_limits 정리와 같은 패턴이고,
    // webhook.ts는 이번 작업 범위 밖이라(다른 에이전트 동시 수정 대상) 건드리지 않는다.
    if (key.startsWith('webhook:')) {
      await cleanupExpiredWebhookEvents(now);
    }

    const [row] = await getDb()
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: nowSeconds + windowSeconds })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + 1` } })
      .returning();

    return (row?.count ?? 1) <= limit;
  } catch (error: unknown) {
    console.error('[booking-rate-limit] Rate limit check unavailable, allowing:', error);
    // 셀 수 없다는 이유로 정당한 예약 시도를 막지 않는다(admin-rate-limit과 동일 판단).
    return true;
  }
};
