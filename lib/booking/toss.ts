const TOSS_API = 'https://api.tosspayments.com/v1';
const REQUEST_TIMEOUT_MS = 12000; // resend.ts와 같은 기준

export interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string; // 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | ...
  totalAmount: number;
  method?: string;
  approvedAt?: string;
  receipt?: { url: string };
  cancels?: Array<{ transactionKey: string; cancelAmount: number }>;
}

export type TossResult =
  | { ok: true; payment: TossPayment }
  | { ok: false; code: string; message: string };

const authHeader = (): string => {
  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) throw new Error('TOSS_SECRET_KEY가 설정되지 않았습니다.');
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
};

const request = async (
  path: string,
  init?: { method?: string; body?: unknown; idempotencyKey?: string },
): Promise<TossResult> => {
  let auth: string;
  try {
    auth = authHeader();
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      message: error instanceof Error ? error.message : 'TOSS_SECRET_KEY가 설정되지 않았습니다.',
    };
  }
  try {
    const res = await fetch(`${TOSS_API}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        // 토스는 모든 POST API에서 Idempotency-Key 헤더를 받는다(최대 300자, 첫 요청일로부터
        // 15일 유효). 키 + API 키 + 요청 주소 + HTTP 메서드가 같으면 최초 응답을 재사용한다.
        // https://docs.tosspayments.com/reference/using-api/authorization
        ...(init?.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? 'UNKNOWN'), message: String(json.message ?? '결제사 오류') };
    }
    return { ok: true, payment: json as TossPayment };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : '네트워크 오류' };
  }
};

/**
 * 가상계좌 결제인가 — `method`(한글 '가상계좌')와 미입금 상태(WAITING_FOR_DEPOSIT)를 함께 본다.
 *
 * **우리는 가상계좌를 쓸 수 없다(2026-09-11 확인).** 환불이 불가능하기 때문이다: 토스는
 * 가상계좌 취소에 refundReceiveAccount(은행·계좌번호·예금주)를 필수로 요구하는데, 우리는
 * 그 값을 받는 화면도 저장하는 자리도 없다. 그런데 코드에는 결제수단 제한이 없어
 * (위젯은 콘솔에서 개통된 수단을 그대로 보여준다) 가상계좌가 열리는 순간 조용히 흘러들었다:
 * 승인 응답이 WAITING_FOR_DEPOSIT이라 confirm은 pending으로 두고, 입금 뒤 DONE 웹훅이
 * 확정하며, 그 후원의 취소·환불은 전부 502로 끝난다(약관 제10조의 3영업일 환불을 제품
 * 안에서 이행할 수단이 없다).
 *
 * 그래서 **쓸 수 없는 수단을 조용히 받아들이지 않는다** — 승인 단계에서 명시적으로 거절하고,
 * 이미 들어온 건은 관리자 화면이 드러낸다(admin-serialize의 virtualAccountPayment).
 */
const VIRTUAL_ACCOUNT_METHODS = ['가상계좌', 'VIRTUAL_ACCOUNT', 'VIRTUAL ACCOUNT', 'virtualAccount'];
export const VIRTUAL_ACCOUNT_ERROR_CODE = 'VIRTUAL_ACCOUNT_UNSUPPORTED';

/**
 * 취소 실패 문구는 **보는 사람에 따라 다르다.**
 *
 * 이 코드는 고객 셀프 취소 응답에도 그대로 실린다(cancel.ts → toss_failed → 409 본문).
 * 그래서 기본값은 고객용이고, 운영 지시("토스 콘솔에서…")는 관리자 요청일 때만
 * 호출자가 바꿔 단다. 예전엔 운영자용 한 벌뿐이라, 후원자가 관리 링크에서 취소를 누르면
 * 내부 운영 절차가 그대로 노출됐다.
 */
export const VIRTUAL_ACCOUNT_CANCEL_CUSTOMER_MESSAGE =
  '이 결제수단은 화면에서 취소할 수 없습니다. 010-4255-7893으로 연락 주시면 환불해 드립니다.';
export const VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE =
  '가상계좌 결제는 화면에서 환불할 수 없습니다. 고객에게 환불받을 계좌(은행·계좌번호·예금주)를 받아 토스 콘솔에서 직접 취소해 주세요.';

export const isVirtualAccountMethod = (method: string | null | undefined): boolean =>
  typeof method === 'string' && VIRTUAL_ACCOUNT_METHODS.some((m) => m.toLowerCase() === method.trim().toLowerCase());

/** 승인 응답이 가상계좌인가 — method가 비어 오는 경우를 대비해 미입금 상태도 함께 본다. */
export const isVirtualAccountPayment = (payment: Pick<TossPayment, 'method' | 'status'>): boolean =>
  isVirtualAccountMethod(payment.method) || payment.status === 'WAITING_FOR_DEPOSIT';

export const confirmPayment = async (input: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult> => {
  const result = await request('/payments/confirm', { method: 'POST', body: input });
  /**
   * 아직 돈이 움직이지 않은 가상계좌 승인(WAITING_FOR_DEPOSIT)은 여기서 끊는다 — 주문은
   * pending으로 남고 홀드 만료로 정리된다. 호출자(confirm.ts)가 이미 `status !== 'DONE'`을
   * 거절하지만, 그 판정은 "왜 거절했는지"를 남기지 않아 운영자가 원인을 알 수 없었다.
   *
   * **이미 입금된(DONE) 가상계좌는 통과시킨다.** 받은 돈을 미기록으로 남기는 쪽이 훨씬 나쁘다 —
   * 그 건은 기록한 뒤 관리자 화면의 경고로 드러내고 토스 콘솔에서 손으로 환불한다.
   */
  if (result.ok && result.payment.status !== 'DONE' && isVirtualAccountPayment(result.payment)) {
    /**
     * 고객용 문구를 여기서 따로 만들지 않는다 — 호출자(confirm.ts)는 거절 계열(allowlist,
     * DECLINE_CODE_PATTERN)이 아닌 코드의 message를 **고객에게 보여주지 않고** 자기 GENERIC
     * 문구로 바꾼다. 그래서 여기 적는 문구는 어떤 사용자에게도 닿지 않는다. 안 닿는 문구를
     * 남겨 두면 다음 사람이 닿는 줄 알고 고치므로, 설명은 이 로그 한 곳에만 둔다.
     */
    console.error('[toss] 지원하지 않는 결제수단(가상계좌) 승인 시도 — 확정하지 않는다. 고객에겐 일반 문구가 나간다', {
      paymentKey: input.paymentKey, orderId: input.orderId,
      method: result.payment.method, status: result.payment.status,
    });
    return { ok: false, code: VIRTUAL_ACCOUNT_ERROR_CODE, message: '가상계좌는 지원하지 않는 결제수단입니다.' };
  }
  return result;
};

/**
 * 결제를 취소(환불)한다.
 *
 * idempotencyKey는 반드시 넘길 것 — 응답만 늦은 타임아웃(NETWORK_ERROR)과 진짜 실패를
 * 호출자가 구분할 수 없기 때문이다. 같은 키로 다시 오면 토스가 최초 취소의 응답을 재사용해
 * 돈이 두 번 나가지 않는다(cancel.ts의 refundIdempotencyKey 참조).
 */
export const cancelPayment = (input: {
  paymentKey: string;
  cancelReason: string;
  cancelAmount: number;
  idempotencyKey?: string;
  /**
   * 이 결제의 payments.method. 가상계좌면 토스가 refundReceiveAccount를 필수로 요구하는데
   * 우리는 그 값을 받는 화면도 저장하는 자리도 없다 — 요청을 보내 봐야 거절되고, 그 원문이
   * 고객 화면에 그대로 노출된다. 아예 부르지 않고 운영자가 알아볼 수 있는 문구로 끝낸다.
   *
   * 선택 인자로 둔다: 모르는 호출자(booking/confirm.ts의 지연 승인 자동 취소)는 종전대로
   * 요청을 보내고 토스의 판단을 따른다. 값을 넘길 수 있는 자리(cancel.ts 두 곳)에서는 넘긴다.
   */
  paymentMethod?: string | null;
}): Promise<TossResult> => {
  if (isVirtualAccountMethod(input.paymentMethod)) {
    console.error('[toss] 가상계좌 결제의 취소 요청 — 환불계좌를 받을 수 없어 부르지 않는다', {
      paymentKey: input.paymentKey, cancelAmount: input.cancelAmount,
    });
    return Promise.resolve({
      ok: false,
      code: VIRTUAL_ACCOUNT_ERROR_CODE,
      // 기본값은 **고객용**이다 — 이 message는 셀프 취소 응답 본문에 그대로 실린다.
      // 관리자 요청이면 호출자가 VIRTUAL_ACCOUNT_CANCEL_ADMIN_MESSAGE로 바꿔 단다.
      message: VIRTUAL_ACCOUNT_CANCEL_CUSTOMER_MESSAGE,
    });
  }
  return request(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
    method: 'POST',
    body: { cancelReason: input.cancelReason, cancelAmount: input.cancelAmount },
    idempotencyKey: input.idempotencyKey,
  });
};

export const fetchPayment = (paymentKey: string): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(paymentKey)}`);
