import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { kstDateString } from '../booking/kst';
import { safeDbErrorSummary } from '../payments/dbErrorSummary';
import type { HealthIssue } from './healthCheck';
import { DUPLICATE_ACK_MARKER, describeDuplicateMatches, listManualRevenueDuplicates } from './manualRevenueDuplicates';

/**
 * 매출 현황(분야별 매출)이 **조용히 틀리는** 경우를 매일 운영 점검(healthCheck.ts collectDbIssues)에 올린다 — 2026-10-21 감사.
 * 셋 다 medium이고 매출 현황으로 보낸다. 표가 없으면(마이그레이션 전) 그 점검만 건너뛴다.
 *
 * 1. 수기 매출 중복 의심(최근 35일) — 같은 돈을 사이트 주문과 수기로 두 번 적었을 수 있다(manualRevenueDuplicates.ts). 운영자가 확인해
 *    메모에 `[중복 아님]`을 넣으면(매출 현황의 "중복 아님" 버튼) 더 묻지 않는다.
 * 2. 결제 링크 기록이 없는 예약금 주문(최근 60일) — `payment_link_orders`가 없으면 링크의 분야를 몰라 녹음·제작으로 센다.
 * 3. 연습실 월 이용료 카드 구독과 월 입주 기록이 같은 사람(계약 또는 이름이 같다) — 한 방의 월세가 구독 결제와 월 입주 수입으로 두 번 잡힌다.
 */
export const DUPLICATE_LOOKBACK_DAYS = 35;
export const UNLINKED_DEPOSIT_LOOKBACK_DAYS = 60;

const DAY = 86400;
const SAMPLE = 10;

const sample = (lines: string[]): string =>
  lines.length <= SAMPLE ? lines.join('\n') : `${lines.slice(0, SAMPLE).join('\n')}\n외 ${lines.length - SAMPLE}건`;

const skip = (label: string, error: unknown) => console.error(`[health] ${label} 점검 실패 — 건너뜁니다:`, safeDbErrorSummary(error));

export const collectRevenueIssues = async (now: Date): Promise<HealthIssue[]> => {
  const db = getDb();
  const issues: HealthIssue[] = [];
  const today = kstDateString(now);

  try {
    const from = kstDateString(new Date(now.getTime() - DUPLICATE_LOOKBACK_DAYS * DAY * 1000));
    const suspects = await listManualRevenueDuplicates({ from, to: today });
    if (suspects.length > 0) {
      issues.push({
        severity: 'medium',
        title: `직접 받은 매출 중복 의심 ${suspects.length}건`,
        detail: `${sample(suspects.map((s) => `${s.receivedOn} ${s.description} ${s.totalAmount.toLocaleString('ko-KR')}원 — ${describeDuplicateMatches(s)}`))}\n같은 입금을 사이트 주문(입금 확인)과 직접 받은 매출에 두 번 적으면 매출이 두 배가 됩니다. 중복이면 매출 현황에서 직접 기록을 지우고, 다른 거래가 맞으면 “중복 아님”을 눌러 주세요(메모에 ${DUPLICATE_ACK_MARKER}가 남아 더 묻지 않습니다).`,
        href: '/admin/revenue',
      });
    }
  } catch (error) {
    skip('수기 매출 중복', error);
  }

  try {
    const since = Math.floor(now.getTime() / 1000) - UNLINKED_DEPOSIT_LOOKBACK_DAYS * DAY;
    const unlinked = await db.all<{ order_no: string; total_amount: number }>(sql`
      SELECT DISTINCT o.order_no AS order_no, o.total_amount AS total_amount FROM orders o JOIN payments p ON p.order_id = o.id
      WHERE o.type = 'deposit' AND o.status IN ('paid', 'partially_refunded') AND p.approved_at IS NOT NULL AND p.approved_at >= ${since}
        AND NOT EXISTS (SELECT 1 FROM payment_link_orders plo WHERE plo.order_no = o.order_no)
      ORDER BY o.order_no LIMIT 50
    `);
    if (unlinked.length > 0) {
      issues.push({
        severity: 'medium',
        title: `결제 링크 기록 없는 예약금 주문 ${unlinked.length}건`,
        detail: `${sample(unlinked.map((u) => `${u.order_no} ${Number(u.total_amount).toLocaleString('ko-KR')}원`))}\n어느 결제 링크로 받은 돈인지 기록(payment_link_orders)이 없어 매출 현황에서 분야를 모르고 녹음·제작으로 셉니다. 연습실·플랫폼 매출이었다면 분야별 숫자가 틀립니다 — 옛 파일 링크 결제인지 확인해 주세요.`,
        href: '/admin/revenue',
      });
    }
  } catch (error) {
    skip('예약금 링크 기록', error);
  }

  try {
    const both = await db.all<{ customer_name: string; room_number: string | null }>(sql`
      SELECT s.customer_name AS customer_name, t.room_number AS room_number FROM subscriptions s
      JOIN room_tenancies t ON t.status = 'active' AND t.monthly_amount > 0
        AND ((s.contract_id IS NOT NULL AND t.contract_id = s.contract_id) OR t.tenant_name = s.customer_name)
      WHERE s.kind = 'practice-room' AND s.status = 'active'
      ORDER BY t.room_number LIMIT 30
    `);
    if (both.length > 0) {
      issues.push({
        severity: 'medium',
        title: `연습실 월세 이중 집계 의심 ${both.length}건`,
        detail: `${sample(both.map((b) => `${b.room_number ?? '비상주'} ${b.customer_name}`))}\n같은 사람이 연습실 월 이용료 카드 구독(결제 행)과 월 입주 기록(입주해 있는 달마다 월 이용료) 양쪽에 있어 연습실 매출에 두 번 잡힐 수 있습니다. 한쪽이 끝났으면 구독을 해지하거나 입주를 퇴실 처리해 주세요.`,
        href: '/admin/revenue?line=practice',
      });
    }
  } catch (error) {
    skip('연습실 구독·입주 이중 집계', error);
  }

  return issues;
};
