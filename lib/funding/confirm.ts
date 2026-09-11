import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, payments, refunds } from '../../db/schema';
import { confirmPayment, fetchPayment, type TossPayment } from '../booking/toss';
import { sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';

export type FundingConfirmOutcome =
  | { ok: true; orderNo: string; manageToken: string; projectSlug: string; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'hold_expired' | 'toss_rejected' | 'recording_failed'; message: string };

/** 토스가 "이미 승인된 결제"에 재승인을 요청받았을 때 돌려주는 코드. 실패가 아니라 지연 신호다. */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

/**
 * "그 paymentKey로는 결제 자체가 없다"는 토스 거절 코드들.
 *
 * 토스 confirm은 paymentKey·orderId·amount 세 값이 모두 맞아야 승인한다 — 아무 문자열이나
 * paymentKey로 넣거나 남의 주문번호를 붙이면 여기로 떨어진다. 정상 고객 흐름에서는 나올 수
 * 없는 코드다(결제창이 발급한 paymentKey를 그대로 넘기므로).
 *
 * 이걸 일반 거절로 취급해 주문을 failed로 낙인하면, 제3자가 주문번호만 알고 아무 paymentKey나
 * 넣어 남의 후원을 망가뜨릴 수 있다 — 특히 무통장 12시간 홀드 주문은 failed가 되는 순간
 * 관리자 입금 확인(bank-transfer.ts는 pending·expired만 claim)이 영구히 막힌다.
 * 그래서 이 계열은 주문 상태를 건드리지 않는다.
 */
const PAYMENT_ABSENT_CODES = new Set(['NOT_FOUND_PAYMENT', 'NOT_FOUND_PAYMENT_SESSION']);

/**
 * "확정은 됐는데 확정 메일을 아직 못 보냈다"는 센티널.
 *
 * batch(주문 paid 전이)와 같은 트랜잭션에 함께 써 넣고, 메일 발송이 끝나야 지운다. 예전엔
 * batch 직후 메일 단계에서 프로세스가 죽으면(타임아웃·배포 중 종료) 확정 메일이 영영 나가지
 * 않았다 — 뒤이어 오는 웹훅 재시도는 status가 이미 paid라 조기 반환했기 때문이다.
 * 이제 웹훅은 이 센티널이 남아 있으면 메일만 다시 보낸다.
 */
const SEND_PENDING = 'send_pending';

/** 확정 메일 발송. 예외를 삼켜 문자열로 바꾼다 — 결제는 이미 끝났으므로 confirm 결과를 뒤집으면 안 된다. */
const deliverConfirmedEmails = async (order: FundingOrder): Promise<string | null> => {
  try {
    return await sendFundingConfirmedEmails(order, getFundingProject(order.fundingPledge?.projectSlug ?? ''));
  } catch (error) {
    console.error('[funding-confirm] 확정 메일 발송 중 예외', { orderNo: order.orderNo, error });
    return error instanceof Error ? error.message : String(error);
  }
};

/** 메일 결과를 notificationError에 확정 기록 — 성공이면 null로 센티널을 지운다. */
const recordEmailResult = async (orderId: string, orderNo: string, emailError: string | null): Promise<void> => {
  try {
    await getDb().update(orders).set({ notificationError: emailError }).where(eq(orders.id, orderId));
  } catch (error) {
    console.error('[funding-confirm] notificationError 기록 실패', { orderNo, emailError, error });
  }
};

const GENERIC = '결제 승인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
const EXPIRED = '결제 대기 시간이 만료된 후원입니다. 다시 후원해 주세요.';
const RECORDING_FAILED = '결제는 완료되었으나 후원 확정 처리가 지연되고 있습니다. 몇 분 내 자동 확정되며, 지속되면 010-4255-7893으로 연락 주세요.';

const success = (order: FundingOrder, emailSent?: boolean): FundingConfirmOutcome => ({
  ok: true,
  orderNo: order.orderNo,
  manageToken: order.manageToken,
  projectSlug: order.fundingPledge?.projectSlug ?? '',
  ...(emailSent === undefined ? {} : { emailSent }),
});

export const confirmFundingPledge = async (
  input: { orderNo: string; paymentKey: string; amount: number },
  options: { trustedByWebhook?: boolean } = {},
): Promise<FundingConfirmOutcome> => {
  const order = await findFundingOrderByOrderNo(input.orderNo);
  if (!order || !order.fundingPledge) return { ok: false, code: 'not_found', message: '후원을 찾을 수 없습니다.' };

  // 무통장 후원은 토스 승인 경로를 애초에 타지 않는다 — 결제창도, paymentKey도 없다.
  // 그런데 주문번호는 비밀이 아니라서(확정·입금안내 메일, 화면, fail URL에 평문) 제3자가
  // 무통장 주문번호로 success URL을 열 수 있었다. 그러면 토스가 거절하고, 그 거절이 주문을
  // failed로 낙인해 고객이 실제로 입금해도 관리자 입금 확인이 막힌다.
  // 웹훅은 무통장 주문번호로 오지 않지만(토스에 결제 자체가 없다), 신뢰 경로는 건드리지 않는다.
  if (!options.trustedByWebhook && order.fundingPledge.paymentMethod === 'bank_transfer') {
    console.error('[funding-confirm] 무통장 후원에 토스 승인 요청 — 주문 상태를 건드리지 않고 거부', { orderNo: order.orderNo });
    return { ok: false, code: 'invalid_state', message: '무통장 입금 후원은 결제 승인 대상이 아닙니다.' };
  }

  if (order.status === 'paid') {
    if (options.trustedByWebhook) {
      // 웹훅은 fetchPayment로 DONE + 금액을 이미 재검증하고 온 신뢰 경로다.
      // 다만 확정 메일 센티널이 남아 있으면 "확정은 됐는데 메일이 안 나간" 주문이므로,
      // 여기서 조기 반환하지 않고 메일만 다시 보낸다(H — 복구 경로가 닫히지 않게).
      if (order.notificationError !== SEND_PENDING) return success(order);
      console.error('[funding-confirm] 확정 메일 미발송 센티널 발견 — 웹훅 경로에서 재발송', { orderNo: order.orderNo });
      const emailError = await deliverConfirmedEmails(order);
      await recordEmailResult(order.id, order.orderNo, emailError);
      return success(order, emailError === null);
    }
    // success 페이지 새로고침 멱등성 — 단, 소유 증명이 있을 때만이다.
    // success()는 manageToken을 그대로 담고, success.tsx는 그 토큰으로 manage URL을 만들어
    // HTML에 박는다. 주문번호는 비밀이 아니므로(메일·화면·영수증·fail URL에 평문) 여기서
    // paymentKey를 안 보면 `?paymentKey=아무거나&orderId=<주문번호>&amount=1` 한 번으로
    // 남의 관리 토큰이 발급된다 — 개인정보 전체 열람 + 전액 강제 환불이 가능한 자격증명이다.
    // 진짜 고객의 새로고침은 결제창이 붙여 준 실제 paymentKey를 URL에 그대로 갖고 있다.
    const provesOwnership =
      input.amount === order.totalAmount && order.payments.some((p) => p.paymentKey === input.paymentKey);
    if (!provesOwnership) {
      console.error('[funding-confirm] 확정된 후원에 소유 증명 없는 접근 — 관리 토큰을 발급하지 않는다', {
        orderNo: order.orderNo, paymentKey: input.paymentKey,
      });
      return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 후원입니다.' };
    }
    return success(order);
  }
  // 웹훅 경로는 expired도 받는다 — expireStalePledges가 먼저 돌아 expired가 된 뒤 DONE 웹훅이
  // 오는 것이 이 사고의 실제 형태다. 여기서 거부하면(비-transient) 200으로 끝나 승인된 돈이
  // 영구 미기록으로 남는다. batch UPDATE도 pending·expired 둘 다 커버한다.
  // failed·refunded·partially_refunded는 웹훅이라도 거부한다 — 이미 다른 결론이 난 주문이다.
  // failed도 웹훅 경로에서는 받는다 — 네트워크·설정 오류로 failed가 찍힌 주문이라도 웹훅은
  // fetchPayment로 DONE + 금액을 재검증한 뒤에 온다. 거부하면 승인된 돈이 영구 미기록으로 남는다.
  const acceptableStatuses = options.trustedByWebhook ? ['pending', 'expired', 'failed'] : ['pending'];
  if (!acceptableStatuses.includes(order.status)) {
    if (options.trustedByWebhook) {
      console.error('[funding-confirm] 웹훅이 확정 불가 상태의 주문을 만남 — 수동 대사 필요', {
        orderNo: order.orderNo, paymentKey: input.paymentKey, status: order.status,
      });
    }
    return { ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 후원입니다.' };
  }

  // 서버가 저장한 금액이 유일한 진실 — 다르면 토스를 부르지도 않는다(위변조 차단).
  if (input.amount !== order.totalAmount) {
    if (options.trustedByWebhook) {
      console.error('[funding-confirm] 웹훅 금액 불일치 — 수동 대사 필요', {
        orderNo: order.orderNo, paymentKey: input.paymentKey, status: order.status,
      });
    }
    return { ok: false, code: 'amount_mismatch', message: '결제 금액이 후원 내용과 일치하지 않습니다.' };
  }

  // 홀드 만료도 스스로 적용한다 — expireStalePledges는 lazy 호출이라 만료 후에도 pending으로
  // 남아 있을 수 있다. 만료 확인 없이 승인을 부르면 이미 다른 후원자가 같은 재고를 가져간
  // 뒤에도 이 결제가 확정될 수 있다.
  // 단, 웹훅 경로는 예외다 — 토스 재조회로 DONE + 금액까지 확인된 "이미 받은 돈"이라,
  // 재고 경합보다 미기록(승인됐는데 pledge가 없는 상태)이 훨씬 나쁘다. 재고 초과는 운영자가
  // 관리자 화면에서 보고 처리할 수 있지만, 유실된 결제는 고객이 먼저 발견한다.
  if (!options.trustedByWebhook && order.fundingPledge.holdExpiresAt.getTime() < Date.now()) {
    console.error('[funding-confirm] 홀드 만료 주문의 승인 요청 — 토스를 부르지 않고 거부', { orderNo: order.orderNo });
    return { ok: false, code: 'hold_expired', message: EXPIRED };
  }

  const db = getDb();
  const toss = await confirmPayment({ paymentKey: input.paymentKey, orderId: order.orderNo, amount: input.amount });

  let approved: TossPayment;
  if (toss.ok) {
    // 200이 곧 DONE은 아니다 — 가상계좌는 승인 응답이 WAITING_FOR_DEPOSIT(입금 0원)으로 온다.
    // 그대로 확정하면 돈이 안 들어온 후원이 paid가 되고, 확정 메일이 나가고, 한정 리워드
    // 재고가 소진된다. 게다가 뒤따르는 EXPIRED 웹훅에는 처리 경로가 없어 영구 paid로 남는다.
    // 주문은 pending으로 남겨 둔다 — 실제 입금이 일어나면 DONE 웹훅이 정상 경로로 확정한다.
    if (toss.payment.status !== 'DONE') {
      console.error('[funding-confirm] 승인 응답이 DONE이 아님 — 확정하지 않는다', {
        orderNo: order.orderNo, paymentKey: input.paymentKey, status: toss.payment.status,
      });
      return { ok: false, code: 'toss_rejected', message: GENERIC };
    }
    approved = toss.payment;
  } else if (toss.code === ALREADY_PROCESSED_CODE) {
    // 토스는 이미 승인된 결제의 재승인을 거절한다 — "우리 DB만 뒤처졌다"는 신호다. 페이로드가
    // 아니라 재조회 결과만 믿는다.
    const refetched = await fetchPayment(input.paymentKey);
    if (!refetched.ok || refetched.payment.status !== 'DONE' || refetched.payment.orderId !== order.orderNo || refetched.payment.totalAmount !== order.totalAmount) {
      console.error('[funding-confirm] 이미 처리된 결제의 재조회 검증 실패', { orderNo: order.orderNo, paymentKey: input.paymentKey });
      return { ok: false, code: 'toss_rejected', message: GENERIC };
    }
    approved = refetched.payment;
  } else {
    // CONFIG_ERROR·NETWORK_ERROR는 "토스가 거절했다"가 아니라 "물어보지도 못했다"이다. 실제로는
    // 승인이 성사됐을 수 있으므로 failed로 확정하면 안 된다 — failed로 찍으면 뒤늦게 오는 웹훅
    // DONE 복구가 막힌다. pending으로 두면 홀드 만료 또는 웹훅이 결론을 낸다.
    const internal = toss.code === 'CONFIG_ERROR' || toss.code === 'NETWORK_ERROR';
    // 결제 미존재 계열도 failed로 찍지 않는다 — 그 주문의 결제가 거절된 게 아니라, 아예 없는
    // 결제를 승인하려 한 것이다(제3자가 주문번호만 알고 아무 paymentKey나 넣은 경우가 전형).
    // 남의 주문을 failed로 만들어 복구 경로를 닫는 방해 공격을 여기서 끊는다.
    const absent = PAYMENT_ABSENT_CODES.has(toss.code);
    const markedFailed = !internal && !absent;
    if (markedFailed) {
      await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    }
    console.error('[funding-confirm] 토스 승인 거부', {
      orderNo: order.orderNo, tossCode: toss.code, tossMessage: toss.message, markedFailed,
    });
    return { ok: false, code: 'toss_rejected', message: internal || absent ? GENERIC : toss.message };
  }

  const now = new Date();
  try {
    // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
    // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
    const batchResult = await db.batch([
      db.insert(payments).values({
        orderId: order.id,
        paymentKey: approved.paymentKey,
        method: approved.method ?? null,
        approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
        receiptUrl: approved.receipt?.url ?? null,
        rawResponse: JSON.stringify(approved),
      }),
      // 'expired'까지 대상에 넣는다 — 토스 승인 왕복(수 초) 동안 expireStalePledges나 다른
      // 요청의 자기 홀드 해제가 이 주문을 expired로 바꿀 수 있는데, 그때 UPDATE가 0행이면
      // 돈만 받고 pending도 paid도 아닌 주문이 남는다.
      // notificationError에 센티널을 함께 쓴다 — 아래 메일 단계에서 프로세스가 죽어도
      // 웹훅 재시도가 "메일이 아직 안 나갔다"를 읽고 재발송할 수 있어야 한다.
      db.update(orders)
        .set({ status: 'paid', updatedAt: now, notificationError: SEND_PENDING })
        .where(and(eq(orders.id, order.id), inArray(orders.status, ['pending', 'expired', 'failed']))),
      db.update(fundingPledges).set({ paidAt: now, updatedAt: now }).where(eq(fundingPledges.orderId, order.id)),
    ]);
    // 그래도 0행이면 paid가 아닌 제3의 상태(failed·refunded 등)로 이미 옮겨간 것 — 결제는
    // 됐는데 기록은 못 한 상태이므로 성공으로 답하지 않는다.
    // 주의: payments INSERT는 같은 batch에서 이미 커밋됐다(여기서 되돌리지 않는다 — 승인된
    // 결제의 기록을 지우는 쪽이 더 위험하다). 그래서 이 주문은 "payments는 있는데 상태는
    // paid가 아닌" 상태로 남고, 드러나는 경로는 관리자 목록의 mismatch 배지뿐이다.
    // 만료된 주문을 웹훅이 되살렸다면 재고를 초과했을 수 있다 — 운영자가 관리자 화면에서
    // 볼 수 있도록 흔적을 남긴다. 로그만으로는 아무도 보지 않는다.
    if (order.status === 'expired' || order.status === 'failed') {
      const note = order.status === 'expired'
        ? '[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요'
        : '[웹훅] failed 처리 후 승인 확인 — 재고 초과 가능, 확인 필요';
      console.error('[funding-confirm] 홀드 만료 주문을 웹훅이 확정 — 재고 확인 필요', { orderNo: order.orderNo, paymentKey: approved.paymentKey });
      try {
        await db.run(
          sql`UPDATE funding_pledges SET admin_memo = COALESCE(admin_memo || char(10), '') || ${note}, updated_at = unixepoch() WHERE order_id = ${order.id}`,
        );
      } catch (memoError) {
        console.error('[funding-confirm] adminMemo 기록 실패', { orderNo: order.orderNo, error: memoError });
      }
    }
    if (Number(batchResult[1]?.rowsAffected ?? 0) === 0) {
      console.error('[funding-confirm] 결제 승인됨, 주문 상태 전이 실패(0행) — 수동 확인 필요', {
        orderNo: order.orderNo, paymentKey: approved.paymentKey, status: order.status,
      });
      return { ok: false, code: 'recording_failed', message: RECORDING_FAILED };
    }
  } catch (error) {
    // 토스 승인은 이미 끝났다 — 이 실패가 멱등(paymentKey unique 위반)인지 진짜 DB 장애인지는
    // payments에 이 paymentKey가 이미 있는지로 가른다.
    let existing: unknown;
    try {
      existing = await db.query.payments.findFirst({ where: (t, { eq: e }) => e(t.paymentKey, approved.paymentKey) });
    } catch (lookupError) {
      console.error('[funding-confirm] 멱등 판정 조회 실패', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error: lookupError });
    }
    if (existing) return success(order);
    console.error('[funding-confirm] 결제 승인됨, DB 기록 실패 — 웹훅 복구 대기', { orderNo: order.orderNo, paymentKey: approved.paymentKey, error });
    return { ok: false, code: 'recording_failed', message: RECORDING_FAILED };
  }

  const fresh = (await findFundingOrderByOrderNo(order.orderNo)) ?? order;
  // 결제는 이미 성공했다 — 메일 예외나 기록 실패가 confirm 결과를 뒤집으면 안 된다.
  // 성공이면 null을 써서 위 batch가 심은 센티널을 지운다(실패면 사유가 센티널을 대체해
  // 관리자 화면의 '메일 실패' 목록에 잡힌다).
  const emailError = await deliverConfirmedEmails(fresh);
  await recordEmailResult(order.id, order.orderNo, emailError);
  return success(fresh, emailError === null);
};

/**
 * 토스 콘솔 등 외부에서 이미 취소된 펀딩 결제를 DB에 반영만 한다(취소 API 재호출 없음).
 *
 * lib/booking/webhook.ts의 nextOrderStatus·reconcileRefunds와 같은 로직 — 펀딩은 booking처럼
 * 별도로 선점할 하위 엔티티가 없어 orders 자체에 바로 적용한다. cancels 부재(재조회 응답에
 * 취소 내역이 없음)는 0으로 취급해 전액 환불을 날조하지 않고, 이미 기록된 done 환불 합계와
 * 대사해 델타만 INSERT한다 — 같은 이벤트가 두 번 오거나 부분 취소 뒤 전체 취소가 와도
 * 매번 이 대사 한 번으로 정확해진다(중복 INSERT도, 반영 누락도 없다).
 */
export const syncFundingCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findFundingOrderByOrderNo(payment.orderId);
  if (!order) return;
  const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
  if (!paymentRow) return;

  const cancelledTotal = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;
  if (cancelledTotal <= 0) return; // cancels 부재 — 전액 환불로 오기록하지 않는다

  const db = getDb();
  const nextStatus = cancelledTotal >= order.totalAmount ? 'refunded' : 'partially_refunded';
  // 이미 같은 상태거나 그 이상(refunded)으로 전이된 주문은 다시 잡지 않는다 — 원자적이지만
  // 결과를 좌우하지는 않는다: 아래 환불 대사가 claim 성공 여부와 무관하게 델타로 정확해진다.
  await db.run(
    sql`UPDATE orders SET status = ${nextStatus}, updated_at = unixepoch() WHERE id = ${order.id} AND status IN ('paid', 'partially_refunded')`,
  );

  const recorded = await db.query.refunds.findMany({
    where: (t, { eq: equals }) => and(equals(t.paymentId, paymentRow.id), equals(t.status, 'done')),
  });
  const refundedSum = recorded.reduce((sum, r) => sum + r.amount, 0);
  // 기록이 토스를 따라잡았다면(같은 이벤트 재도착, 또는 우리 쪽이 더 많은 경우) 할 일이 없다.
  if (cancelledTotal <= refundedSum) return;

  const delta = cancelledTotal - refundedSum;
  await db.insert(refunds).values({
    paymentId: paymentRow.id,
    amount: delta,
    reason: '토스 외부 취소 동기화',
    requestedBy: 'webhook',
    tossTransactionKey: payment.cancels?.[payment.cancels.length - 1]?.transactionKey ?? null,
    status: 'done',
  });
};
