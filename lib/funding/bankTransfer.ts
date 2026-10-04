import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SEND_PENDING } from '../ops/notificationSentinel';
import { deliverConfirmedEmailsOnce } from './confirm';
import { sendFundingDepositGuideEmails } from './email';
import { activePledgeLines, pledgeLines } from './pledgeLines';
import { getFundingProjectAsync } from './repository';
import { isDigitalOrder } from './shape';
import { findFundingOrderById, findFundingOrderByOrderNo, type FundingOrder } from './service';

/**
 * 계좌 입금(무통장) 후원의 운영 전이 — 입금 확인 · 미입금 취소 · 입금 안내 발송.
 *
 * 생성은 온라인 후원과 같은 `createFundingPledge`이고(lib/funding/service.ts), 여기에는 생성 뒤에
 * 사람이 누르는 일만 있다. 규칙의 근거는 lib/funding/bankAccount.ts 머리 주석.
 */

const rowsAffectedOf = (result: unknown): number => {
  const n = Number((result as { rowsAffected?: unknown } | undefined)?.rowsAffected ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const epoch = (d: Date): number => Math.floor(d.getTime() / 1000);

export type BankDepositOutcome =
  | { ok: true; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'not_bank_transfer' | 'invalid_state'; message: string };

/**
 * **입금 확인** — 운영자가 통장에서 입금을 확인하고 누른다. `pending`(그리고 늦은 입금을 위해
 * `expired`)을 `paid`로.
 *
 * - 한 번만 전이한다. `UPDATE … WHERE status IN ('pending','expired')`가 낙관적 잠금이다 — 두 번
 *   눌러도(또는 두 운영자가 동시에 눌러도) rowsAffected 1은 한쪽뿐이고, 다른 쪽은 "이미 처리됨"을
 *   받는다. 확정 메일도 그 한쪽만 보낸다.
 * - **expired도 받는다.** 미입금 취소나 후원자의 신청 취소 뒤에 돈이 들어오는 경우다. 계좌 입금은
 *   한정 리워드를 받지 않으므로(bankTransferBlockReason) 되살릴 때 재고를 다시 셀 필요가 없다.
 * - 확정 메일은 온라인 확정·수기 등록과 **같은 규약**이다 — 전이와 같은 문장에 `send_pending`
 *   센티널을 적고, `deliverConfirmedEmailsOnce`가 선점해 보낸다(lib/funding/confirm.ts). 그래서
 *   메일이 실패하면 관리자 화면·헬스체크의 '메일 실패'에 그대로 잡히고 재발송 버튼이 닫는다.
 * - 디지털 전용 리워드는 확정 순간이 전달 완료다(`delivered_at`) — confirm.ts와 같은 판정.
 *
 * 수기 등록(`entry_source='manual'`)은 이미 paid로 들어오므로 상태 조건에서 자연히 빠진다.
 */
export const confirmBankDeposit = async (input: { orderId: string; now: Date }): Promise<BankDepositOutcome> => {
  const order = await findFundingOrderById(input.orderId);
  if (!order?.fundingPledge) return { ok: false, code: 'not_found', message: '펀딩 내역을 찾을 수 없습니다.' };
  if (order.fundingPledge.paymentMethod !== 'bank_transfer') {
    return { ok: false, code: 'not_bank_transfer', message: '계좌 입금 펀딩이 아닙니다.' };
  }
  const project = await getFundingProjectAsync(order.fundingPledge.projectSlug);
  // 프로젝트를 못 읽으면 채우지 않는다 — 배송 리워드에 잘못 찍는 것이 안 찍는 것보다 나쁘다(confirm.ts).
  const digital = isDigitalOrder(project, activePledgeLines(pledgeLines(order.fundingPledge)).map((l) => l.rewardId));
  const now = epoch(input.now);
  const db = getDb();
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = 'paid', notification_error = ${SEND_PENDING}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status IN ('pending', 'expired')
        AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND payment_method = 'bank_transfer')
    `),
    // 위 전이가 0행이면 이것도 0행이다 — paid_at이 아직 없고 주문이 방금 paid가 된 경우만.
    db.run(sql`
      UPDATE funding_pledges
      SET paid_at = ${now}, delivered_at = ${digital ? now : null}, updated_at = unixepoch()
      WHERE order_id = ${order.id} AND paid_at IS NULL
        AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid' AND notification_error = ${SEND_PENDING})
    `),
  ]);
  if (rowsAffectedOf(claim) === 0) {
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아닙니다. 새로고침해 주세요.' };
  }
  const fresh = (await findFundingOrderById(order.id)) ?? order;
  return { ok: true, emailSent: await deliverConfirmedEmailsOnce(fresh) };
};

/**
 * **입금 전 신청을 닫는다** — 관리자 "미입금 취소"와 후원자의 "입금 전 신청 취소"가 같은 전이를 쓴다
 * (`pending` → `expired`). 받은 돈이 없으니 환불이 아니고, 후원자에게 메일을 보내지 않는다 —
 * 늦게 입금한 사람에게 "취소됨"이 가는 것이 SAF2026에서 난 사고다. 늦은 입금이 들어오면 운영자가
 * 같은 건에서 "입금 확인"을 누르면 된다(expired도 받는다).
 *
 * 온라인 계좌 입금만 받는다 — 토스 결제 대기는 홀드가 스스로 닫는다.
 */
export const cancelUnpaidBankDeposit = async (order: Pick<FundingOrder, 'id'>): Promise<BankDepositOutcome> => {
  const result = await getDb().run(sql`
    UPDATE orders SET status = 'expired', updated_at = unixepoch()
    WHERE id = ${order.id} AND status = 'pending'
      AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND payment_method = 'bank_transfer' AND entry_source = 'online')
  `);
  if (rowsAffectedOf(result) === 0) {
    return { ok: false, code: 'invalid_state', message: '입금 대기 중인 계좌 입금 신청이 아닙니다. 새로고침해 주세요.' };
  }
  return { ok: true };
};

/**
 * 입금 안내 메일을 보내고 결과를 `notification_error`에 남긴다(실패 사유 / 성공이면 비움).
 * 관리자 화면이 그 값을 보고 "입금 안내 재발송"을 권한다. 예외는 삼킨다 — 신청은 이미 만들어졌고,
 * 계좌는 신청 직후 화면에도 나온다.
 */
export const deliverDepositGuide = async (orderNo: string): Promise<string | null> => {
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge) return 'not_found';
  let emailError: string | null;
  try {
    emailError = await sendFundingDepositGuideEmails(order, await getFundingProjectAsync(order.fundingPledge.projectSlug));
  } catch (error) {
    console.error('[funding-bank-transfer] 입금 안내 메일 발송 중 예외', { orderNo, error });
    emailError = error instanceof Error ? error.message : String(error);
  }
  try {
    await getDb().run(sql`UPDATE orders SET notification_error = ${emailError} WHERE id = ${order.id} AND status = 'pending'`);
  } catch (error) {
    console.error('[funding-bank-transfer] notificationError 기록 실패', { orderNo, emailError, error });
  }
  return emailError;
};

export interface SameNameDepositCandidate {
  id: string;
  orderNo: string;
  status: string;
  projectSlug: string;
  totalAmount: number;
  createdAt: string;
}

/**
 * 같은 이름으로 들어온 **다른** 계좌 입금 신청 중 아직 입금 확인 전(pending)이거나 닫힌(expired) 것.
 *
 * 관리자 후원 상세에 후보로 띄운다 — 통장의 입금 한 건을 두 신청에 이중으로 확인하거나, 이미 신청이
 * 있는데 수기 등록을 새로 만드는 사고를 막는다(SAF2026 2026-09-08: 다른 프로젝트 신청자의 입금이
 * 엉뚱한 프로젝트 수기 후원으로 5건 등록됐다). 그래서 **프로젝트로 좁히지 않는다.** 이름은 정확히
 * 같을 때만 본다(앞뒤 공백 무시) — 부분 일치는 동명이인 오매칭만 키운다. 최신순 10건.
 * 조회 실패는 빈 목록으로 삼킨다 — 보조 정보라 상세 화면을 막으면 안 된다.
 */
export const findSameNameBankDeposits = async (order: Pick<FundingOrder, 'id' | 'customerName'>): Promise<SameNameDepositCandidate[]> => {
  try {
    const rows = await getDb().all<{ id: string; order_no: string; status: string; project_slug: string; total_amount: number; created_at: number }>(sql`
      SELECT o.id, o.order_no, o.status, fp.project_slug, o.total_amount, o.created_at
      FROM orders o JOIN funding_pledges fp ON fp.order_id = o.id
      WHERE o.type = 'funding' AND o.id != ${order.id}
        AND TRIM(o.customer_name) = TRIM(${order.customerName})
        AND fp.payment_method = 'bank_transfer' AND fp.entry_source = 'online'
        AND o.status IN ('pending', 'expired')
      ORDER BY o.created_at DESC LIMIT 10
    `);
    return rows.map((r) => ({
      id: r.id, orderNo: r.order_no, status: r.status, projectSlug: r.project_slug,
      totalAmount: Number(r.total_amount), createdAt: new Date(Number(r.created_at) * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('[funding-bank-transfer] 같은 이름 신청 조회 실패', { orderId: order.id, error });
    return [];
  }
};
