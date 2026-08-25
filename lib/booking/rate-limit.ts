import { lte, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { rateLimits } from '../../db/schema';

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
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    await getDb().delete(rateLimits).where(lte(rateLimits.expiresAt, nowSeconds));

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
