import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { refunds } from '../../db/schema';
import { VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE, VIRTUAL_ACCOUNT_ERROR_CODE, cancelPayment } from '../booking/toss';
import { sendFundingCancelledEmails, sendFundingDepositWithdrawnOperatorEmail } from './email';
import { SEND_INFLIGHT, SEND_PENDING } from '../ops/notificationSentinel';
import { assessSelfCancel, canWithdrawBeforeDeposit, CANCEL_BLOCK_MESSAGES } from './policy';
import { cancelUnpaidBankDeposit } from './bankTransfer';
import { encryptRefundAccountNumber, markRefundAccountRefunded, safeDbErrorSummary, saveRefundAccount, validateRefundAccount } from '../payments/refundAccount';
import { isPastFundingEnd } from './projectState';
import { getFundingProjectOrFailure } from './repository';
import { liveFundingOrderStatusList, remainingRefundable } from './refundable';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';
import type { FundingProject } from './projects';

export type FundingCancelOutcome =
  /**
   * `withdrawn` — 입금 전 계좌 입금 신청을 후원자가 거뒀다(받은 돈이 없어 환불이 아니다).
   * `refund_requested` — 계좌 입금 후원의 취소를 환불 계좌와 함께 접수했다(운영자가 송금한다).
   */
  | { ok: true; mode: 'refunded' | 'refund_requested' | 'recorded' | 'withdrawn'; refundAmount: number; warnings?: string[] }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'toss_failed' | 'recording_failed' | 'temporarily_unavailable'; message: string };

const GENERIC = '취소 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const refundIdempotencyKey = (orderNo: string, amount: number): string => `refund:${orderNo}:${amount}`;

/**
 * 취소 메일 발송 + notificationError 기록. 돈은 이미 나갔으므로(또는 확정 취소됨) 메일 예외나
 * 기록 실패가 outcome을 바꿔서는 안 된다 — confirm.ts의 notificationError 패턴과 동일하게
 * 둘 다 try/catch로 감싼다.
 */
const notifyCancelled = async (
  db: ReturnType<typeof getDb>,
  order: FundingOrder,
  project: FundingProject | null,
  mode: 'refunded' | 'refund_requested' | 'recorded',
  refundAmount: number,
): Promise<void> => {
  let emailError: string | null = null;
  // 플레이스홀더 주소(수기 등록에서 연락처를 비운 건)로 가는 **고객 항목**은 발송 계층이
  // 조용히 떨어뜨린다(email.ts withoutUndeliverableCustomer). 여기서 통째로 건너뛰면
  // 운영자 사본까지 사라지는데, 수기 건의 환불은 손으로 계좌에 송금하는 작업이라 그
  // 메일이 실무의 시작점이다.
  try {
    emailError = await sendFundingCancelledEmails(order, project, mode, refundAmount);
  } catch (error) {
    console.error('[funding-cancel] 취소 메일 발송 중 예외', { orderNo: order.orderNo, error });
    emailError = error instanceof Error ? error.message : String(error);
  }
  try {
    /**
     * 성공(null)으로 덮을 때 **확정 메일 센티널은 지우지 않는다.**
     *
     * notification_error 한 칸을 확정 메일 상태(`send_pending`·`send_inflight`)와 그 밖의
     * 알림 결과가 함께 쓴다. 취소 메일이 성공했다고 null을 통째로 쓰면 "확정 메일이 아직
     * 안 나갔다"는 기록이 사라진다 — 운영 점검도 침묵하고, 그 주문에 확정 메일이 한 통도
     * 안 나갔다는 사실을 아무도 모르게 된다. 같은 가드가 관리자 환불 요청 취소
     * (pages/api/admin/funding/pledges/[id].ts)에도 있다. 센티널을 지우는 경로는 관리자
     * 화면의 메일 재발송 하나로 남긴다 — 운영자가 실제로 다시 보낸 뒤에만 지워진다.
     */
    await db.run(
      emailError === null
        ? sql`UPDATE orders SET notification_error = NULL WHERE id = ${order.id}
              AND (notification_error IS NULL OR notification_error NOT IN (${SEND_PENDING}, ${SEND_INFLIGHT}))`
        : sql`UPDATE orders SET notification_error = ${emailError} WHERE id = ${order.id}`,
    );
  } catch (error) {
    console.error('[funding-cancel] notificationError 기록 실패', { orderNo: order.orderNo, emailError, error });
  }
};

export const cancelFundingPledge = async (input: {
  orderNo: string; requestedBy: 'customer' | 'admin'; reason: string; now: Date;
  /**
   * 계좌 입금 후원의 셀프 취소에 함께 받는 환불 계좌(은행·계좌번호·예금주). 검증은 여기서 한다
   * (validateRefundAccount) — 라우트는 받은 값을 그대로 넘긴다. 다른 경로에서는 쓰지 않는다.
   */
  refundAccount?: unknown;
}): Promise<FundingCancelOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '펀딩 내역을 찾을 수 없습니다.' };
  const pledge = order.fundingPledge;
  /**
   * 입금 전 계좌 입금 신청 — 후원자가 "입금 전 신청 취소"를 눌렀다. 화면(manage SSR)과 같은
   * 판정(canWithdrawBeforeDeposit)을 쓴다. 프로젝트 상태와 무관하다(받은 돈이 없다).
   */
  if (input.requestedBy === 'customer' && canWithdrawBeforeDeposit({ orderStatus: order.status, paymentMethod: pledge.paymentMethod, entrySource: pledge.entrySource })) {
    const r = await cancelUnpaidBankDeposit(order);
    if (!r.ok) return { ok: false, code: 'invalid_state', message: r.message };
    // 운영자 알림 — 실패해도 취소 결과는 그대로다.
    try {
      const { project } = await getFundingProjectOrFailure(pledge.projectSlug);
      const failure = await sendFundingDepositWithdrawnOperatorEmail(order, project);
      if (failure) console.error('[funding-cancel] 신청 취소 운영자 알림 발송 실패', { orderNo: order.orderNo, failure });
    } catch (error) {
      console.error('[funding-cancel] 신청 취소 운영자 알림 예외', { orderNo: order.orderNo, error: (error as Error).message });
    }
    return { ok: true, mode: 'withdrawn', refundAmount: 0 };
  }
  /**
   * 조회 실패와 부재를 구분한다. 예전에는 둘 다 null이라 `project ? … : 'closed'`가
   * DB가 한 번 흔들린 것을 "마감"으로 읽었고, 모금 중인 프로젝트의 후원자가 셀프 취소를
   * 잃었다. 일시 오류는 일시 오류로 답한다 — 잠시 뒤 다시 누르면 된다.
   */
  const { project, lookupFailed } = await getFundingProjectOrFailure(pledge.projectSlug);
  if (lookupFailed && input.requestedBy === 'customer') {
    return { ok: false, code: 'temporarily_unavailable', message: '지금은 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
  }
  // 부분환불 건은 관리자만 다룰 수 있다 — 남은 금액 계산이 걸려 있어 고객 셀프 취소에 맡기지 않는다.
  if (order.status === 'partially_refunded' && input.requestedBy !== 'admin') {
    return { ok: false, code: 'invalid_state', message: '일부 환불된 펀딩은 문의해 주세요.' };
  }
  if (order.status !== 'paid' && !(order.status === 'partially_refunded' && input.requestedBy === 'admin')) {
    return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES.not_paid };
  }
  if (input.requestedBy === 'customer') {
    const verdict = assessSelfCancel({
      orderStatus: order.status,
      // 프로젝트를 못 읽으면 마감으로 본다(fail-closed).
      fundingEnded: project ? isPastFundingEnd(project, input.now) : true,
      fulfillmentStatus: pledge.fulfillmentStatus,
      paymentMethod: pledge.paymentMethod,
      entrySource: pledge.entrySource,
      downloadedAt: pledge.downloadedAt ?? null,
    });
    if (!verdict.ok) return { ok: false, code: 'invalid_state', message: CANCEL_BLOCK_MESSAGES[verdict.code] };
  }
  const db = getDb();
  // 토스 취소를 걸 결제 행 — 여러 행이 있을 수 있으므로(재승인·분할) done 환불이 아직
  // 잔액을 다 덮지 않은 행을 고른다. 그런 행이 없으면 가장 마지막 결제 행을 쓴다
  // (syncFundingCancelledFromToss도 paymentKey로 행을 고르므로 payments[0] 고정은 위험하다).
  const doneRefundedOn = (p: (typeof order.payments)[number]): number =>
    (p.refunds ?? []).filter((r) => r.status === 'done').reduce((sum, r) => sum + r.amount, 0);
  const payment =
    order.payments.find((p) => doneRefundedOn(p) < order.totalAmount) ?? order.payments[order.payments.length - 1];

  // 이미 done으로 기록된 환불을 **모든 결제 행에서** 뺀 잔액만 취소한다 — payments[0]만 보면
  // 웹훅이 다른 행에 기록한 환불이 빠져 이중 환불이 되고, 잔액이 0인데도 토스를 부르게 된다.
  const refundAmount = remainingRefundable(order);

  if (pledge.paymentMethod === 'toss' && !payment) {
    return { ok: false, code: 'invalid_state', message: '결제 기록이 없는 펀딩입니다. 관리자에게 문의해 주세요.' };
  }

  /**
   * 계좌 입금(온라인 계좌 입금·관리자 수기 등록)은 토스에 취소할 결제가 없다. 돈은 운영자가 계좌로
   * 직접 돌려준다.
   *
   * - **후원자**(온라인 계좌 입금만 — 수기 건은 위 assessSelfCancel이 offline_payment로 막았다):
   *   환불 계좌를 받아 취소를 **접수**한다. 주문은 paid 그대로 두고 `refund_requested_at`을 찍는다 —
   *   그 표식이 관리자 배너·헬스체크(3영업일 기한)·발송 금지(CSV shipHold·발송 상태 API)를 켠다.
   * - **관리자**: 송금을 마친 뒤 누르는 "송금 완료(환불 기록)" — 주문을 refunded로 기록한다.
   */
  if (pledge.paymentMethod === 'bank_transfer') {
    if (input.requestedBy === 'customer') {
      const account = validateRefundAccount(input.refundAccount);
      if (!account.ok) return { ok: false, code: 'invalid_state', message: account.message };
      let accountNumberEnc: string;
      try {
        accountNumberEnc = encryptRefundAccountNumber(account.value.accountNumber);
      } catch (error) {
        // 키가 없는 배포 — 평문으로 저장하는 길은 없다. 값은 로그에 적지 않는다.
        console.error('[funding-cancel] 환불 계좌 암호화 실패 — 접수하지 않는다', { orderNo: order.orderNo, error: error instanceof Error ? error.name : 'unknown' });
        return { ok: false, code: 'temporarily_unavailable', message: '지금은 환불 계좌를 접수할 수 없습니다. 010-4255-7893으로 연락 주세요.' };
      }
      const requestedAt = Math.floor(input.now.getTime() / 1000);
      /**
       * 접수 표식을 먼저 **선점**하고, 이긴 요청만 계좌를 쓴다. 표식 UPDATE의 WHERE가 경합 가드다 —
       * 이미 접수됐거나, 그 사이 발송 준비·내려받기가 시작됐거나, 결제 상태가 바뀌었으면 0행(토스
       * 경로의 선점과 같은 축). 한 batch로 묶고 "방금 이 시각으로 접수됐다"를 계좌 INSERT의 조건으로
       * 걸면, 같은 초에 두 번 누른 두 번째 요청이 표식은 못 얻고도 그 조건을 통과해 계좌를 덮어쓴다
       * (테스트로 재현했다). 그래서 선점 결과를 보고 나서 쓴다. 계좌 쓰기가 실패하면 표식을 되돌린다.
       */
      const db0 = getDb();
      let claimed = 0;
      try {
        const claim = await db0.run(sql`
          UPDATE funding_pledges
          SET refund_requested_at = ${requestedAt}, updated_at = unixepoch()
          WHERE id = ${pledge.id}
            AND refund_requested_at IS NULL
            AND fulfillment_status = 'none' AND downloaded_at IS NULL
            AND EXISTS (SELECT 1 FROM orders WHERE id = ${order.id} AND status = 'paid')`);
        claimed = Number(claim.rowsAffected ?? 0);
      } catch (error) {
        console.error('[funding-cancel] 취소 접수 선점 실패', { orderNo: order.orderNo, error: safeDbErrorSummary(error) });
        return { ok: false, code: 'temporarily_unavailable', message: '지금은 취소를 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
      }
      if (claimed > 0) {
        try {
          await saveRefundAccount(
            { kind: 'funding', orderNo: order.orderNo },
            { bankName: account.value.bankName, accountNumberEnc, accountHolder: account.value.accountHolder, requestedAt: input.now },
          );
        } catch (error) {
          // 표가 없거나(0048 미적용) DB 장애 — 계좌 없는 접수를 남기지 않게 표식을 되돌린다.
          // 오류 객체를 통째로 찍지 않는다 — drizzle 메시지에 바인딩 값(계좌번호 암호문·예금주)이 실린다.
          console.error('[funding-cancel] 환불 계좌 저장 실패 — 접수를 되돌린다', { orderNo: order.orderNo, error: safeDbErrorSummary(error) });
          await db0.run(sql`UPDATE funding_pledges SET refund_requested_at = NULL WHERE id = ${pledge.id} AND refund_requested_at = ${requestedAt}`)
            .catch((revertError: unknown) => console.error('[funding-cancel] 접수 되돌리기 실패 — 관리자 화면에서 환불 요청 취소 필요', { orderNo: order.orderNo, error: safeDbErrorSummary(revertError) }));
          return { ok: false, code: 'temporarily_unavailable', message: '지금은 취소를 접수할 수 없습니다. 잠시 후 다시 시도해 주세요.' };
        }
      }
      if (claimed === 0) return { ok: false, code: 'invalid_state', message: '이미 취소 요청이 접수되었거나 지금은 취소할 수 없는 상태입니다. 새로고침해 주세요.' };
      await notifyCancelled(db0, order, project, 'refund_requested', refundAmount);
      return { ok: true, mode: 'refund_requested', refundAmount };
    }
    if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };
    const claim = await db.run(
      sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status IN (${liveFundingOrderStatusList()})`,
    );
    if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리된 펀딩입니다.' };
    // 송금을 마쳤다는 기록 — 결제 공용 환불 계좌 표의 refunded_at(계좌가 없는 수기 건이면 아무 일도 없다).
    await markRefundAccountRefunded({ kind: 'funding', orderNo: order.orderNo }, input.now);
    await notifyCancelled(db, order, project, 'recorded', refundAmount);
    /**
     * 취소 요청 **뒤에** 내려받기가 찍혔으면 기록은 하되 알린다. 지금은 요청 뒤 내려받기를 막지만
     * (pages/api/funding/download.ts의 refund_requested_at 가드), 그 전에 생긴 행이나 경합이 남긴
     * 행을 운영자가 보고 판단해야 한다 — 화면 확인창이 먼저 알리고, 여기는 서버 쪽 한 번 더다.
     */
    const downloadedAfterRequest = Boolean(
      pledge.refundRequestedAt && pledge.downloadedAt && pledge.downloadedAt.getTime() > pledge.refundRequestedAt.getTime(),
    );
    return {
      ok: true, mode: 'recorded', refundAmount,
      ...(downloadedAfterRequest ? { warnings: ['이 후원자는 취소를 요청한 뒤 음원을 내려받았습니다 — 환불 기록은 했습니다. 청약철회 제한 여부를 확인해 주세요.'] } : {}),
    };
  }

  // 잔액이 0이면 토스를 아예 부르지 않는다 — 부르면 취소 금액 0(또는 초과)으로 거절되거나,
  // 잔액이 남은 것처럼 계산된 금액이 이중으로 나간다.
  if (refundAmount <= 0) return { ok: false, code: 'invalid_state', message: '환불할 잔액이 없습니다.' };

  // 토스: 선점 → 취소 API → 기록. 실패 시 되돌림(예약 cancel.ts와 같은 순서).
  //
  // 셀프 취소는 "발송 준비 전"이라는 조건을 선점 WHERE에 함께 건다 — assessSelfCancel이 읽기
  // 시점에만 보므로, 판정과 선점 사이에 관리자가 발송 준비로 넘기면 환불과 발송이 둘 다
  // 성립한다(돈은 나가고 리워드도 나간다). 관리자 취소는 발송 중에도 허용해야 하므로 제외한다.
  //
  // 내려받기도 같은 이유로 함께 건다 — manage 화면이 내려받기 버튼과 취소 버튼을 나란히
  // 띄우므로, 읽은 뒤 선점 전에 download.ts가 downloaded_at을 찍으면 파일은 나가고 돈도
  // 전액 돌아간다. assessSelfCancel이 읽기 시점에 보는 두 가드를 둘 다 옮겨야 한다.
  const selfCancelGuard =
    input.requestedBy === 'customer'
      ? sql` AND EXISTS (SELECT 1 FROM funding_pledges WHERE order_id = ${order.id} AND fulfillment_status = 'none' AND downloaded_at IS NULL)`
      : sql.empty();
  const claim = await db.run(
    sql`UPDATE orders SET status = 'refunded', updated_at = unixepoch() WHERE id = ${order.id} AND status = ${order.status}${selfCancelGuard}`,
  );
  if (Number(claim.rowsAffected) === 0) return { ok: false, code: 'invalid_state', message: '이미 처리 중이거나 취소된 펀딩입니다.' };
  const toss = await cancelPayment({
    paymentKey: payment!.paymentKey, cancelReason: input.reason, cancelAmount: refundAmount,
    idempotencyKey: refundIdempotencyKey(order.orderNo, refundAmount),
    // 가상계좌면 토스를 부르지 않고 운영자가 알아볼 수 있는 문구로 끝낸다 — 부르면 토스가
    // refundReceiveAccount 누락으로 거절하고 그 원문이 고객 화면에 그대로 나간다.
    paymentMethod: payment!.method,
  });
  if (!toss.ok) {
    /**
     * 되돌리기 전에 **그 사이 진짜 환불이 기록됐는지**를 본다.
     *
     * 토스 호출은 12초에 타임아웃하는데(booking/toss.ts), 그 실패는 "취소가 거절됐다"와
     * "취소는 됐는데 응답만 늦었다"를 구분하지 못한다. 후자라면 토스가 보낸 CANCELED 웹훅이
     * 먼저 도착해 `syncFundingCancelledFromToss`가 done 환불 행을 남긴다. 그 상태에서
     * 되돌리면 **환불이 끝난 건이 paid로 살아난다** — 공개 모금액에 환불된 돈이 남고,
     * 그 사람이 음원을 계속 받고, 재취소는 잔액 0이라 막힌다. 스스로 낫지 않는다.
     *
     * 선점 WHERE의 `status = 'refunded'`만으로는 내가 찍은 refunded와 웹훅이 찍은 refunded를
     * 구분할 수 없다 — 둘이 같은 값이다. 그래서 **지금 DB의 done 환불 합계로 잔액을 다시
     * 계산한다.** 잔액이 0이면 전액이 실제로 돌아갔으므로 refunded가 맞고 그대로 둔다. 잔액이
     * 남으면 이 주문은 refunded가 아니다 — 되돌린다.
     *
     * 예전엔 "done 환불 **건수**가 읽은 때와 같은가"로 봤다. 그러면 그 사이 줄 단위 환불
     * (lineRefund.ts)이나 토스 콘솔 부분 취소가 기록된 경우에도 되돌림이 0행이 되어, 일부만
     * 환불된 주문이 refunded로 굳었다 — refunded는 이 함수가 다시 받지 않으므로 화면에서
     * 복구할 길도 없다. 되돌릴 때 done 환불이 하나라도 있으면 partially_refunded로 둔다.
     */
    const doneSumNowForRevert = sql`COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ${order.id}) AND status = 'done'), 0)`;
    try {
      const reverted = await db.run(
        sql`UPDATE orders
            SET status = CASE WHEN ${doneSumNowForRevert} > 0 THEN 'partially_refunded' ELSE ${order.status} END,
                updated_at = unixepoch()
            WHERE id = ${order.id} AND status = 'refunded'
              AND ${doneSumNowForRevert} < total_amount`,
      );
      if (Number(reverted.rowsAffected) === 0) {
        console.error('[funding-cancel] 선점을 되돌리지 않았다 — 그 사이 전액 환불이 기록됐다(웹훅 대사로 추정)', {
          orderNo: order.orderNo,
        });
      }
    } catch (revertError) {
      console.error('[funding-cancel] 선점 revert 실패 — 수동 복구 필요', { orderNo: order.orderNo, error: revertError });
    }
    await db.insert(refunds).values({ paymentId: payment!.id, amount: refundAmount, reason: input.reason, requestedBy: input.requestedBy, status: 'failed' });
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    console.error('[funding-cancel] 토스 취소 실패', { orderNo: order.orderNo, code: toss.code, message: toss.message });
    // 이 message는 **후원자 셀프 취소 응답 본문에 그대로 실린다.** 가상계좌 거절의 기본
    // 문구는 고객용이고(toss.ts), 운영 지시는 관리자가 요청했을 때만 바꿔 단다.
    const adminOnly = toss.code === VIRTUAL_ACCOUNT_ERROR_CODE && input.requestedBy === 'admin';
    return {
      ok: false, code: 'toss_failed',
      message: internal ? GENERIC : adminOnly ? VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE : toss.message,
    };
  }
  /**
   * 우리가 읽은 뒤 **그 사이 기록된 done 환불만큼 덜어 낸다.** 토스 응답이 늦는 사이 CANCELED
   * 웹훅이 먼저 도착하면 `syncFundingCancelledFromToss`가 이 취소를 이미 적는다. 전액을 또
   * 적으면 원장이 두 배가 되고 매출 장부의 순매출이 음수가 된다. 조건과 금액을 한 문장에
   * 실어 웹훅의 델타 INSERT와 서로 직렬화되게 한다(lineRefund.ts와 같은 관례).
   *
   * 기준은 토스 `cancels` 합계가 아니라 읽은 시점의 기록 합계다 — 수기로 기록된 부분 환불은
   * 토스 누적 취소액에 없고, 환불 행이 다른 결제 행에 붙어 있을 수 있어 주문 전체로 센다.
   * 0행이면 웹훅이 이미 기록했고 취소 메일도 그쪽이 보냈다.
   */
  const doneSumBefore = order.payments.reduce(
    (sum, p) => sum + (p.refunds ?? []).filter((r) => r.status === 'done').reduce((s, r) => s + r.amount, 0),
    0,
  );
  const doneSumNow = sql`COALESCE((SELECT SUM(amount) FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE order_id = ${order.id}) AND status = 'done'), 0)`;
  let recorded: boolean;
  try {
    const inserted = await db.run(sql`
      INSERT INTO refunds (id, payment_id, amount, reason, requested_by, toss_transaction_key, status)
      SELECT lower(hex(randomblob(16))), ${payment!.id}, ${refundAmount} - (${doneSumNow} - ${doneSumBefore}),
             ${input.reason}, ${input.requestedBy}, ${toss.payment.cancels?.[toss.payment.cancels.length - 1]?.transactionKey ?? null}, 'done'
      WHERE ${refundAmount} > ${doneSumNow} - ${doneSumBefore}
    `);
    recorded = Number(inserted.rowsAffected) > 0;
  } catch (error) {
    console.error('[funding-cancel] 환불 완료, 기록 실패 — 웹훅 CANCELED 동기화가 보정', { orderNo: order.orderNo, error });
    return { ok: false, code: 'recording_failed', message: '환불은 완료되었으나 기록이 지연되고 있습니다. 010-4255-7893으로 확인 부탁드립니다.' };
  }
  if (recorded) await notifyCancelled(db, order, project, 'refunded', refundAmount);
  return { ok: true, mode: 'refunded', refundAmount };
};
