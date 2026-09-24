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
 * 알림 한 통에 쓸 수 있는 시간.
 *
 * 이 점검은 **승인 응답을 받은 직후**, 즉 아직 우리 DB에 아무것도 기록하지 않은 자리에서
 * 돈다. 승인 진입점(`pages/[locale]/booking/success.tsx`·`pages/[locale]/funding/success.tsx`)은
 * Pages Router의 `getServerSideProps`라 `maxDuration`을 지정할 수 없고 `vercel.json`에도
 * `functions` 설정이 없어 계정 기본값으로 돈다. 그런데 토스 승인 타임아웃이 12초,
 * `sendEmail`도 12초(`lib/email/resend.ts`)다 — 새 수단의 **첫 결제**에서 Resend가 느리면
 * 둘이 겹쳐 함수 예산을 넘긴다. 그 자리는 토스가 돈을 가져갔는데 우리 기록은 없는 자리라
 * 고객은 504를 본다(DONE 웹훅이 복구하지만, 하필 가장 확인하고 싶은 건이 실패 화면으로 간다).
 *
 * 알림은 best-effort라 못 보내도 잃는 것이 없다. 그래서 3초에서 끊는다 — 무슨 수단이
 * 열렸는지는 아래 `console.error`가 이미 남겨 두므로 추적은 끊기지 않는다.
 */
const ALERT_SEND_TIMEOUT_MS = 3000;

/**
 * 이 인스턴스에서 이미 알린 수단.
 *
 * 레이트리밋이 메일은 막지만 **Turso 왕복(만료 정리 + UPSERT)은 결제마다 그대로** 친다.
 * 그 왕복이 승인 경로 위에 있으므로, 같은 인스턴스가 살아 있는 동안은 묻지 않는다.
 * 인스턴스가 바뀌면 다시 한 번 묻게 되므로 이 맵이 창을 대신하지는 않는다 — 진짜 판정은
 * `consumeRateLimit`이 하고, 이건 그 앞의 값싼 거름망이다.
 */
const alertedInThisInstance = new Map<string, number>();

/** 테스트 전용 — 모듈 상태를 비운다. */
export const resetPaymentMethodAlertMemo = (): void => {
  alertedInThisInstance.clear();
};

/**
 * 알림 발송에 상한을 씌운다. 시간을 넘기면 발송을 기다리지 않고 돌아온다 —
 * 요청이 끊기는 것이 아니라 **우리가 기다리는 것을 그만두는** 것이다.
 */
const sendWithinBudget = async (params: Parameters<typeof sendEmail>[0]): Promise<void> => {
  const timedOut = Symbol('timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      sendEmail(params),
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), ALERT_SEND_TIMEOUT_MS);
      }),
    ]);
    if (result === timedOut) {
      console.error(`[payment-method] 알림 발송이 ${ALERT_SEND_TIMEOUT_MS}ms를 넘겨 기다리지 않는다 — 결제는 정상 처리됨`);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
};

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

    const key = rateLimitKey(method);
    const lastInThisInstance = alertedInThisInstance.get(key);
    if (lastInThisInstance !== undefined && Date.now() - lastInThisInstance < ALERT_WINDOW_SECONDS * 1000) return;

    if (!(await consumeRateLimit(key, ALERT_LIMIT, ALERT_WINDOW_SECONDS))) {
      // 다른 인스턴스가 이미 보냈다 — 이 인스턴스도 창이 끝날 때까지 DB를 묻지 않는다.
      alertedInThisInstance.set(key, Date.now());
      return;
    }
    alertedInThisInstance.set(key, Date.now());

    await sendWithinBudget({
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
