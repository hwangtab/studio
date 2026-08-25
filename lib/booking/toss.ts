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

const request = async (path: string, init?: { method?: string; body?: unknown }): Promise<TossResult> => {
  try {
    const res = await fetch(`${TOSS_API}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
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

export const cancelPayment = (input: { paymentKey: string; cancelReason: string; cancelAmount: number }): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(input.paymentKey)}/cancel`, {
    method: 'POST',
    body: { cancelReason: input.cancelReason, cancelAmount: input.cancelAmount },
  });

export const fetchPayment = (paymentKey: string): Promise<TossResult> =>
  request(`/payments/${encodeURIComponent(paymentKey)}`);
