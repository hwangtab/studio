import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { fundingPledges, orders, payments, refunds } from '../../db/schema';
import { confirmPayment, fetchPayment, type TossPayment } from '../booking/toss';
import { sendFundingCancelledEmails, sendFundingConfirmedEmails } from './email';
import { getFundingProject } from './projects';
import { findFundingOrderByOrderNo, type FundingOrder } from './service';
import { SEND_INFLIGHT, SEND_PENDING } from '../ops/notificationSentinel';

export type FundingConfirmOutcome =
  | { ok: true; orderNo: string; manageToken: string; projectSlug: string; emailSent?: boolean }
  | { ok: false; code: 'not_found' | 'amount_mismatch' | 'invalid_state' | 'hold_expired' | 'toss_rejected' | 'recording_failed'; message: string };

/** 토스가 "이미 승인된 결제"에 재승인을 요청받았을 때 돌려주는 코드. 실패가 아니라 지연 신호다. */
const ALREADY_PROCESSED_CODE = 'ALREADY_PROCESSED_PAYMENT';

/**
 * "이 주문의 결제가 실제로 거절됐다"고 단정할 수 있는 토스 코드 — **allowlist**다.
 *
 * 예전에는 반대로 denylist(NOT_FOUND_PAYMENT 계열만 제외)였다. 그러면 목록 밖의 어떤 코드든
 * (INVALID_REQUEST·UNAUTHORIZED_KEY·FORBIDDEN_REQUEST…) 주문을 failed로 낙인한다 —
 * 주문번호는 비밀이 아니므로 제3자가 success URL을 열어 남의 후원을 망가뜨릴 수 있고,
 * 중단 전에 만들어진 무통장 주문은 failed가 되면 되살릴 경로가 없다. allowlist면 모르는 코드는 주문을 건드리지 않고 pending으로 남아
 * 홀드 만료나 웹훅이 결론을 낸다 — 과소 낙인은 스스로 치유되고, 과대 낙인은 아니다.
 *
 * 접두사로 보는 이유: 토스 거절 코드는 카드사/계좌 사유별로 계속 늘어나는 계열이라
 * (REJECT_CARD_COMPANY·INVALID_CARD_EXPIRATION·EXCEED_MAX_DAILY_PAYMENT_COUNT…)
 * 개별 열거는 곧 낡는다. 계열 밖 코드는 낙인하지 않는 쪽이 안전하다.
 * lib/booking/confirm.ts에 같은 판단이 복제돼 있다(모듈 그래프를 섞지 않으려는 의도적 중복 —
 * ALREADY_PROCESSED_CODE도 같은 이유로 양쪽에 있다).
 */
const DECLINE_CODE_PATTERN =
  /^(REJECT_|INVALID_REJECT_CARD|EXCEED_MAX_|INVALID_CARD|INVALID_STOPPED_CARD$|INVALID_ACCOUNT_INFO|NOT_ENOUGH_BALANCE$|NOT_AVAILABLE_BANK$|CARD_PROCESSING_ERROR$|PAY_PROCESS_(CANCELED|ABORTED)$)/;

/** 고객 결제수단이 실제로 거절된 경우인가 — 참일 때만 orders.status를 failed로 낙인한다. */
const isCustomerDecline = (code: string): boolean => DECLINE_CODE_PATTERN.test(code);

/**
 * 되살림 흔적에 실제로 쓰이는 태그 — 아래 `tag` 계산(options.trustedByWebhook 분기)과
 * 이 배열이 어긋나면 admin-serialize.test.ts의 대조 테스트가 잡는다. 이 파일이
 * REVIEW_MEMO_PREFIXES(admin-serialize.ts)의 부분집합을 실제로 쓰고 있다는 보증은
 * 여기 export한 이 상수를 그 테스트가 직접 가져다 확인하는 형태로만 성립한다.
 */
export const REVIVAL_NOTE_TAGS = ['[웹훅]', '[지연승인]'] as const;

/** 웹훅·지연 승인이 만료/실패 주문을 되살렸을 때 관리자 화면에 남기는 흔적. */
export const revivalNote = (tag: string, from: 'expired' | 'failed'): string =>
  from === 'expired'
    ? `${tag} 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요`
    : `${tag} failed 처리 후 승인 확인 — 재고 초과 가능, 확인 필요`;

/**
 * 확정 메일 상태를 notificationError에 싣는 **두 단계 센티널** (lib/booking/confirm.ts와 같은 장치 —
 * 자세한 근거는 그쪽 SEND_PENDING 주석에 있다).
 *
 * - `send_pending` — batch(주문 paid 전이)와 같은 트랜잭션에 써 넣는다. 웹훅 재도착이 이 값을
 *   보면 메일을 대신 보낸다.
 * - `send_inflight` — 선점에 성공한 실행이 바꿔 놓는 값. 경쟁자를 막으면서도 **비어 있지 않다**.
 *
 * 선점 값을 NULL로 두면 발송 구간(0.3~1.5초)에서 죽었을 때 주문은 paid인데 확정 메일 0통,
 * 고객은 관리 링크도 없는 상태가 되고 healthCheck(`isNotNull(orders.notificationError)`)는
 * 침묵한다 — 무증상 사고다. inflight를 남기면 즉시 잡히고 관리자 화면에서 복구할 수 있다.
 * 정상 종료 시 발송 결과(성공 null / 실패 사유)가 덮어쓴다.
 */

/**
 * libSQL 결과의 rowsAffected — 판정 불가는 undefined로 돌려 "정상"으로 흘려보낸다.
 * lib/booking/confirm.ts의 같은 이름 함수와 같은 규약이다(모듈 그래프를 섞지 않으려는
 * 의도적 복제 — ALREADY_PROCESSED_CODE·DECLINE_CODE_PATTERN과 같은 이유).
 */
const rowsAffectedOf = (result: unknown): number | undefined => {
  if (!result || typeof result !== 'object' || !('rowsAffected' in result)) return undefined;
  const n = Number((result as { rowsAffected: unknown }).rowsAffected);
  return Number.isFinite(n) ? n : undefined;
};

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

/**
 * 확정 메일을 **정확히 한 번** 보낸다 — 발송권을 센티널 선점으로 정한다.
 *
 * 취소 가드와 같은 패턴이다(읽어서 검사하지 않고 `UPDATE … WHERE notification_error =
 * 'send_pending'`으로 하나만 이기게 한다). 이게 없으면 SSR 확정이 메일(0.3~1.5초)을 보내는
 * 동안 **바로 그 승인이 유발한** 토스 DONE 웹훅이 1~3초 안에 도착해, status='paid' + 센티널을
 * 보고 확정 메일을 한 통 더 보낸다. rowsAffected 1을 받은 쪽만 발송한다.
 *
 * undefined는 "이번 호출이 보내지 않았다"는 뜻이다(success()의 emailSent 의미 그대로).
 */
const deliverConfirmedEmailsOnce = async (order: FundingOrder): Promise<boolean | undefined> => {
  // CAS — send_pending을 send_inflight로 원자적으로 바꾼 쪽만 보낸다. 판정 불가는 보내는
  // 쪽으로 흘린다(rowsAffectedOf의 규약) — 없는 실패를 지어내 확정 메일을 통째로 막는 쪽이
  // 중복 발송보다 나쁘다.
  const claim = await getDb().run(
    sql`UPDATE orders SET notification_error = ${SEND_INFLIGHT} WHERE id = ${order.id} AND notification_error = ${SEND_PENDING}`,
  );
  if (rowsAffectedOf(claim) === 0) {
    console.error('[funding-confirm] 확정 메일을 다른 경로가 이미 선점 — 중복 발송하지 않는다', { orderNo: order.orderNo });
    return undefined;
  }
  const emailError = await deliverConfirmedEmails(order);
  await recordEmailResult(order.id, order.orderNo, emailError);
  return emailError === null;
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
      // send_inflight는 "다른 실행이 지금 보내고 있다"라 가로채지 않는다 — 그 실행이 죽어
      // 값이 남으면 healthCheck가 잡는다(SEND_PENDING 주석 참조).
      if (order.notificationError !== SEND_PENDING) return success(order);
      console.error('[funding-confirm] 확정 메일 미발송 센티널 발견 — 웹훅 경로에서 재발송', { orderNo: order.orderNo });
      return success(order, await deliverConfirmedEmailsOnce(order));
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
    // 결제수단이 실제로 거절된 계열만 failed로 낙인한다(allowlist). 그 밖의 코드는 "이 주문의
    // 결제가 거절됐다"를 뜻하지 않으므로 — 없는 결제를 승인하려 한 제3자 요청이 대표적이다 —
    // 주문 상태를 건드리지 않는다. 남의 주문의 복구 경로를 닫는 방해 공격을 여기서 끊는다.
    const declined = !internal && isCustomerDecline(toss.code);
    if (declined) {
      await db.run(sql`UPDATE orders SET status = 'failed', updated_at = unixepoch() WHERE id = ${order.id} AND status = 'pending'`);
    }
    console.error('[funding-confirm] 토스 승인 거부', {
      orderNo: order.orderNo, tossCode: toss.code, tossMessage: toss.message, markedFailed: declined,
    });
    return { ok: false, code: 'toss_rejected', message: declined ? toss.message : GENERIC };
  }

  const now = new Date();
  try {
    // payments INSERT가 맨 앞 — paymentKey unique 위반이 동시 확정의 두 번째 시도를
    // batch 전체 실패로 만든다(절반만 쓰인 상태가 남지 않는다).
    const tag = options.trustedByWebhook ? REVIVAL_NOTE_TAGS[0] : REVIVAL_NOTE_TAGS[1];
    const batchResult = await db.batch([
      db.insert(payments).values({
        orderId: order.id,
        paymentKey: approved.paymentKey,
        method: approved.method ?? null,
        approvedAt: approved.approvedAt ? new Date(approved.approvedAt) : null,
        receiptUrl: approved.receipt?.url ?? null,
        rawResponse: JSON.stringify(approved),
      }),
      // 되살림 흔적 — orders 전이보다 **먼저** 실행해 "전이 직전의 실제 status"를 읽는다.
      // 진입 시점에 읽은 order.status로 판정하면, 토스 승인 왕복(수 초) 동안 expireStalePledges가
      // 돌아 expired가 된 건을 통째로 놓친다(진입 시엔 pending이었으므로). 같은 batch = 같은
      // 트랜잭션이라 이 SELECT는 바로 아래 UPDATE가 덮어쓰기 전의 값을 본다.
      // batch 안에 두는 이유는 하나 더 있다 — 전이는 성공했는데 흔적만 유실되는 조합을 없앤다.
      db.update(fundingPledges)
        .set({
          adminMemo: sql`COALESCE(admin_memo || char(10), '') || CASE (SELECT status FROM orders WHERE id = ${order.id}) WHEN 'expired' THEN ${revivalNote(tag, 'expired')} ELSE ${revivalNote(tag, 'failed')} END`,
          updatedAt: now,
        })
        .where(
          and(
            eq(fundingPledges.orderId, order.id),
            sql`(SELECT status FROM orders WHERE id = ${order.id}) IN ('expired', 'failed')`,
          ),
        ),
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
    // 흔적이 실제로 남았는지는 batch 결과로 안다 — 진입 스냅샷이 아니라 전이 직전 상태 기준이다.
    if (Number(batchResult[1]?.rowsAffected ?? 0) > 0) {
      console.error('[funding-confirm] 만료·실패 주문을 되살려 확정 — 재고 확인 필요', {
        orderNo: order.orderNo, paymentKey: approved.paymentKey, statusAtEntry: order.status, tag,
      });
    }
    if (Number(batchResult[2]?.rowsAffected ?? 0) === 0) {
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
  // 발송권은 센티널 선점으로 정한다: 이 승인이 유발한 토스 DONE 웹훅이 메일 발송 중에
  // 도착해도 확정 메일이 두 통 나가지 않는다. 성공이면 null이 센티널을 지우고, 실패면
  // 사유가 센티널을 대체해 관리자 화면·healthCheck의 '메일 실패' 목록에 잡힌다.
  return success(fresh, await deliverConfirmedEmailsOnce(fresh));
};

/**
 * 토스 콘솔 등 외부에서 이미 취소된 펀딩 결제를 DB에 반영만 한다(취소 API 재호출 없음).
 *
 * lib/booking/webhook.ts의 nextOrderStatus·reconcileRefunds와 같은 로직 — 펀딩은 booking처럼
 * 별도로 선점할 하위 엔티티가 없어 orders 자체에 바로 적용한다. cancels 부재(재조회 응답에
 * 취소 내역이 없음)는 0으로 취급해 전액 환불을 날조하지 않고, 이미 기록된 done 환불 합계와
 * 대사해 델타만 INSERT한다 — 같은 이벤트가 두 번 오면 델타가 0이라 아무것도 쓰지 않고,
 * 부분 취소 뒤 전체 취소가 오면 차액만 채운다.
 *
 * **단, 정확해지는 것은 이 함수가 실제로 호출됐을 때뿐이다.** 웹훅 진입부(lib/booking/webhook.ts)의
 * 멱등 키가 취소 합계를 포함해야 부분취소 2회가 서로 다른 이벤트로 들어온다 — 예전엔
 * `paymentKey:status`뿐이라 두 번째 부분취소가 통째로 스킵됐고, 이 대사는 호출조차 되지 않았다.
 *
 * 델타를 실제로 기록했다면 후원자에게도 알린다 — 운영자가 토스 콘솔에서 직접 환불하면
 * 이 경로 말고는 통지가 나가지 않아, 후원자는 카드 명세서로만 취소를 알게 된다.
 */
export const syncFundingCancelledFromToss = async (payment: TossPayment): Promise<void> => {
  const order = await findFundingOrderByOrderNo(payment.orderId);
  if (!order) {
    // 예약 경로(lib/booking/webhook.ts)와 같은 규칙 — 조용한 조기 반환은 대사 단서를 지운다.
    console.error('[funding-confirm] 취소 동기화 스킵 — 후원 주문을 찾지 못함', {
      orderId: payment.orderId, paymentKey: payment.paymentKey,
    });
    return;
  }
  const paymentRow = order.payments.find((p) => p.paymentKey === payment.paymentKey) ?? order.payments[0];
  if (!paymentRow) {
    console.error('[funding-confirm] 취소 동기화 스킵 — 주문에 payments 행이 없음', {
      orderNo: order.orderNo, paymentKey: payment.paymentKey,
    });
    return;
  }

  const cancelledTotal = payment.cancels?.reduce((sum, c) => sum + c.cancelAmount, 0) ?? 0;
  if (cancelledTotal <= 0) {
    // cancels 부재 — 전액 환불로 오기록하지 않는다. 다만 무로그로 물러나지는 않는다.
    console.error('[funding-confirm] 취소 동기화 스킵 — 취소 합계 0(cancels 부재)', {
      orderNo: order.orderNo, paymentKey: payment.paymentKey, status: payment.status,
    });
    return;
  }

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

  // 기록이 실제로 늘어난 경우에만(= 여기까지 온 경우에만) 통지한다 — 같은 이벤트 재도착은
  // 위 대사에서 이미 return했으므로 같은 취소로 메일이 반복되지 않는다. 금액은 **누적 취소
  // 합계**를 적는다(델타는 우리 기록과의 차이일 뿐, 후원자가 돌려받는 금액이 아니다).
  // 메일 실패가 동기화를 뒤집으면 안 된다 — cancel.ts notifyCancelled와 같은 처리.
  let emailError: string | null = null;
  try {
    emailError = await sendFundingCancelledEmails(
      order,
      getFundingProject(order.fundingPledge?.projectSlug ?? ''),
      'recorded',
      cancelledTotal,
    );
  } catch (error) {
    console.error('[funding-confirm] 외부 취소 통지 중 예외', { orderNo: order.orderNo, error });
    emailError = error instanceof Error ? error.message : String(error);
  }
  await recordEmailResult(order.id, order.orderNo, emailError);
};
