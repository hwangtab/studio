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

export const confirmPayment = (input: { paymentKey: string; orderId: string; amount: number }): Promise<TossResult> =>
  request('/payments/confirm', { method: 'POST', body: input });

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
}): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
    method: 'POST',
    body: { cancelReason: input.cancelReason, cancelAmount: input.cancelAmount },
    idempotencyKey: input.idempotencyKey,
  });

export const fetchPayment = (paymentKey: string): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(paymentKey)}`);
