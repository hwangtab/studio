import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { SEND_PENDING } from '../ops/notificationSentinel';
import { deliverConfirmedEmailsOnce } from './confirm';
import { sendFundingDepositGuideEmails } from './email';
import { allowCustomerDepositGuideMail } from '../payments/depositGuideThrottle';
import { activePledgeLines, pledgeLines } from './pledgeLines';
import { getFundingProjectAsync } from './repository';
import { isDigitalOrder } from './shape';
import { allLinesStockCondition, findFundingOrderById, findFundingOrderByOrderNo, type FundingOrder } from './service';
import type { ResolvedPledgeLine } from './validation';
import { safeDbErrorSummary } from '../payments/refundAccount';

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
  /** `warnings` — 확정은 됐지만 운영자가 알아야 할 것(정산이 이미 기록된 프로젝트 등). 화면에 그대로 띄운다. */
  | { ok: true; emailSent?: boolean; warnings?: string[] }
  | { ok: false; code: 'not_found' | 'not_bank_transfer' | 'invalid_state' | 'sold_out' | 'project_unavailable'; message: string };

export type ProjectPayoutState = { status: 'pending' | 'paid'; paidAt: Date | null } | null;

/**
 * 이 프로젝트(slug)에 **정산이 기록돼 있는가.** 정산은 DB(개설자) 프로젝트에만 있다 — md 프로젝트는
 * 늘 null. 조회 실패도 null로 삼킨다(경고용 보조 정보다).
 *
 * 늦은 입금을 확정하면 모금액이 늘어 기록된 정산과 어긋난다 — 이체 전(pending)이면 이체 금액을
 * 고쳐야 하고, 이체 뒤(paid)면 개설자에게 추가로 보낼 몫이 생긴다. 확인창·확정 응답·헬스체크가 이 값을 본다.
 */
export const loadProjectPayoutState = async (projectSlug: string): Promise<ProjectPayoutState> => {
  try {
    const rows = await getDb().all<{ status: string; paid_at: number | null }>(sql`
      SELECT pp.status, pp.paid_at FROM funding_project_payouts pp
      JOIN funding_projects p ON p.id = pp.project_id
      WHERE p.slug = ${projectSlug} LIMIT 1
    `);
    const r = rows[0];
    if (!r) return null;
    return { status: r.status === 'paid' ? 'paid' : 'pending', paidAt: r.paid_at ? new Date(Number(r.paid_at) * 1000) : null };
  } catch (error) {
    console.error('[funding-bank-transfer] 정산 기록 조회 실패', { projectSlug, error: safeDbErrorSummary(error) });
    return null;
  }
};

export const payoutWarningOf = (state: ProjectPayoutState): string | null =>
  state === null
    ? null
    : state.status === 'paid'
      ? '이 프로젝트는 정산을 이미 이체했습니다 — 이 입금을 확정하면 개설자에게 추가로 보낼 몫이 생깁니다. 정산 패널에서 차액을 확인해 주세요.'
      : '이 프로젝트는 정산이 기록됐습니다 — 확정하면 개설자에게 보낼 금액이 늘어납니다. 이체 전에 정산 패널의 계산값을 다시 확인해 주세요.';

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
  /**
   * **한정 리워드 재검증.** 새 계좌 입금은 한정 리워드를 받지 않지만(bankTransferBlockReason),
   * 2026-09-11 이전의 무통장 행은 한정 리워드를 담을 수 있었다. 그런 행을 늦게 확정하면 그 사이
   * 팔린 재고 위로 올라간다 — 온라인 생성과 같은 재고 식(allLinesStockCondition, 자기 주문 제외)을
   * 전이 UPDATE의 WHERE에 싣는다. 프로젝트를 못 읽으면 어느 리워드가 한정인지 모르므로 확정하지
   * 않는다(fail-closed — 잠시 뒤 다시 누르면 된다).
   */
  if (!project) {
    return { ok: false, code: 'project_unavailable', message: '프로젝트 정보를 읽지 못해 재고를 확인할 수 없습니다. 잠시 뒤 다시 눌러 주세요.' };
  }
  const lines = activePledgeLines(pledgeLines(order.fundingPledge));
  const resolved: ResolvedPledgeLine[] = lines.flatMap((l) => {
    const reward = project.rewards.find((r) => r.id === l.rewardId);
    return reward ? [{ reward, quantity: l.quantity }] : [];
  });
  const stockCondition = allLinesStockCondition(project.slug, resolved, input.now, order.orderNo);
  // 프로젝트를 못 읽으면 채우지 않는다 — 배송 리워드에 잘못 찍는 것이 안 찍는 것보다 나쁘다(confirm.ts).
  const digital = isDigitalOrder(project, lines.map((l) => l.rewardId));
  const now = epoch(input.now);
  const db = getDb();
  const [claim] = await db.batch([
    db.run(sql`
      UPDATE orders SET status = 'paid', notification_error = ${SEND_PENDING}, updated_at = unixepoch()
      WHERE id = ${order.id} AND status IN ('pending', 'expired')
        AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND payment_method = 'bank_transfer')
        AND ${stockCondition}
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
    // 상태는 그대로인데 0행이면 재고 조건이 막은 것이다 — 운영자에게 사유를 말한다.
    const again = await findFundingOrderById(order.id);
    if (again && (again.status === 'pending' || again.status === 'expired') && resolved.some((l) => l.reward.totalQuantity !== null)) {
      const limited = resolved.filter((l) => l.reward.totalQuantity !== null).map((l) => l.reward.title).join(', ');
      return {
        ok: false, code: 'sold_out',
        message: `한정 리워드(${limited})의 남은 수량이 모자라 확정할 수 없습니다. 후원자와 리워드 변경이나 환불을 협의해 주세요(받은 돈이 있으면 계좌로 돌려줘야 합니다).`,
      };
    }
    return { ok: false, code: 'invalid_state', message: '이미 확인됐거나 입금을 확인할 수 있는 상태가 아닙니다. 새로고침해 주세요.' };
  }
  const fresh = (await findFundingOrderById(order.id)) ?? order;
  const emailSent = await deliverConfirmedEmailsOnce(fresh);
  const payoutWarning = payoutWarningOf(await loadProjectPayoutState(order.fundingPledge.projectSlug));
  return { ok: true, emailSent, ...(payoutWarning ? { warnings: [payoutWarning] } : {}) };
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
  /**
   * `notification_error`도 함께 비운다. 입금 안내 메일이 실패해 사유가 남아 있었다면, 닫힌 신청에는
   * 보낼 메일이 없는데 재발송 버튼(입금 안내·확정 메일)은 둘 다 409라 헬스체크 경보를 끌 길이 없다.
   * pending 계좌 입금에는 확정 메일 센티널이 들어 있을 수 없다(센티널은 paid 전이와 같은 문장에서만 쓴다).
   */
  const result = await getDb().run(sql`
    UPDATE orders SET status = 'expired', notification_error = NULL, updated_at = unixepoch()
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
export const deliverDepositGuide = async (
  orderNo: string,
  opts: { throttleCustomer?: boolean } = {},
): Promise<string | null> => {
  const order = await findFundingOrderByOrderNo(orderNo);
  if (!order?.fundingPledge) return 'not_found';
  let emailError: string | null;
  try {
    const skipCustomer = opts.throttleCustomer ? !(await allowCustomerDepositGuideMail(order.customerEmail)) : false;
    emailError = await sendFundingDepositGuideEmails(order, await getFundingProjectAsync(order.fundingPledge.projectSlug), { skipCustomer });
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
    // 바인딩 값에 후원자 이름이 실린다 — 요지만 남긴다.
    console.error('[funding-bank-transfer] 같은 이름 신청 조회 실패', { orderId: order.id, error: safeDbErrorSummary(error) });
    return [];
  }
};
