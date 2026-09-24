/**
 * 모르는 결제수단이 들어오면 운영자에게 알린다.
 *
 * 콘솔에서 수단을 하나 열면 처리방침 1항의 고지가 그 순간부터 불완전해지는데, 코드에
 * 수단 제한이 없어 아무도 모른 채 지나간다(`lib/payments/knownMethods.ts` 머리주석).
 * 이 함수가 그 사건을 드러낸다.
 *
 * **결제를 막지 않는다.** 이미 승인된 돈이라 여기서 실패를 만들면 받은 돈이 미기록으로
 * 남는다 — 저장소가 여러 곳에서 지켜 온 판단이다(후속 실패는 삼키되 기록한다). 그래서
 * 이 함수는 어떤 경우에도 throw하지 않고, 호출자는 반환값을 보지 않아도 된다.
 */
import { consumeRateLimit } from '../booking/rate-limit';
import { sendEmail } from '../email/resend';
import { OPERATOR_EMAIL } from '../operatorContact';
import { isUnknownPaymentMethod } from './knownMethods';

/**
 * 같은 수단 하나에 하루 한 통.
 *
 * 새 수단이 개통되면 그 뒤의 **모든** 결제가 이 경로를 지난다 — 창이 없으면 결제 건수만큼
 * 메일이 쏟아지고, 그러면 운영자가 메일을 읽지 않게 되어 정작 다음 경보가 묻힌다
 * (헬스체크가 "이상 없음"을 안 보내는 것과 같은 이유). 하루면 사람이 반응하기 충분하고,
 * 고쳐지지 않으면 다음 날 다시 온다.
 */
const ALERT_WINDOW_SECONDS = 24 * 60 * 60;
const ALERT_LIMIT = 1;

/**
 * 레이트리밋 키의 접두사.
 *
 * 기존 키(`webhook:ip:*`, `booking_create:ip:*`, `contact:*`, 계약 다운로드)와 겹치지
 * 않는 이름이다. 수단별로 따로 세므로 두 수단이 동시에 열려도 각각 한 통씩 온다.
 */
const RATE_LIMIT_PREFIX = 'payment_method_drift:';

/** 키에 그대로 쓸 수 없는 값(공백·과도한 길이)을 다듬는다. 값 자체는 메일 본문에 온전히 싣는다. */
const rateLimitKey = (method: string): string =>
  `${RATE_LIMIT_PREFIX}${method.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 64)}`;

export interface PaymentMethodAlertInput {
  method?: string | null;
  /** 어느 경로에서 받은 응답인가 — 'booking/funding 승인', '정기결제 회차' 등. */
  context: string;
  /** 추적용 식별자. 개인정보가 아니다. */
  orderId?: string | null;
  paymentKey?: string | null;
  status?: string | null;
}

/**
 * 승인·재조회 응답의 결제수단을 점검한다.
 *
 * ⚠ **응답 본문을 싣지 않는다.** 가상계좌·휴대폰 결제의 응답에는 구매자명·입금자명·
 * 계좌번호·휴대폰 번호가 하위 객체로 들어 있다(`lib/privacy/orderRetention.ts`의
 * `purgeExpiredPaymentRawResponses` 주석). 운영자가 알아야 하는 것은 **무엇이 열렸는가**
 * 뿐이므로 `method` 값과 추적용 식별자만 보낸다.
 */
export const checkPaymentMethod = async (input: PaymentMethodAlertInput): Promise<void> => {
  try {
    if (!isUnknownPaymentMethod(input.method)) return;
    const method = String(input.method).trim();

    // 로그는 창과 무관하게 매번 남긴다 — 메일은 하루 한 통이지만, 나중에 "언제부터
    // 몇 건이었나"를 되짚을 근거는 건별로 있어야 한다.
    console.error('[payment-method] 처리방침이 설명하지 않는 결제수단 승인', {
      method, context: input.context, orderId: input.orderId, paymentKey: input.paymentKey, status: input.status,
    });

    if (!(await consumeRateLimit(rateLimitKey(method), ALERT_LIMIT, ALERT_WINDOW_SECONDS))) return;

    await sendEmail({
      to: OPERATOR_EMAIL,
      subject: `[Studio NOL] 처리방침에 없는 결제수단 — ${method}`,
      text: [
        `결제수단 "${method}"으로 결제가 승인됐습니다. 우리가 아는 목록에 없는 값입니다.`,
        '',
        `경로: ${input.context}`,
        `주문: ${input.orderId ?? '-'}`,
        `paymentKey: ${input.paymentKey ?? '-'}`,
        `상태: ${input.status ?? '-'}`,
        '',
        '무엇을 해야 하나:',
        '  1. 토스 콘솔에서 이 수단을 열어 둘 것인지 정한다. 닫으면 여기서 끝난다.',
        '  2. 계속 받을 것이라면, 그 수단의 승인 응답에 무엇이 실리는지 확인해',
        '     개인정보 처리방침 1항에 반영하고 lib/payments/knownMethods.ts 목록에 더한다.',
        '     (처리방침 ko 본문은 펀딩 동의 문서라 FUNDING_TERMS_VERSION을 먼저 올려야 한다.)',
        '',
        '결제 자체는 정상 처리됐습니다. 이 메일은 같은 수단에 대해 하루 한 번만 옵니다.',
      ].join('\n'),
    });
  } catch (error: unknown) {
    // 알림이 실패해도 결제 처리가 깨지면 안 된다.
    console.error('[payment-method] 결제수단 점검 실패(결제는 정상 처리됨):', error);
  }
};
