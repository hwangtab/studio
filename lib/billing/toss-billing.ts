/**
 * 토스 빌링(자동결제) 클라이언트.
 *
 * lib/booking/toss.ts와 코드가 닮았지만 시크릿이 다르다 — 빌링은 **API 개별 연동 키**로만
 * 되고 결제위젯 키(gsk)로는 아예 호출되지 않는다. 두 키를 한 env에 섞으면 위젯 결제와
 * 빌링 중 한쪽이 조용히 죽으므로 `TOSS_BILLING_SECRET_KEY`를 따로 둔다(스펙 §9).
 */
import type { TossPayment, TossResult } from '../booking/toss';

const TOSS_API = 'https://api.tosspayments.com/v1';
const REQUEST_TIMEOUT_MS = 12000; // booking/toss.ts와 같은 기준

export type { TossPayment, TossResult };

export interface BillingCard {
  company?: string;
  numberMasked?: string;
  cardType?: string;
}

export type IssueBillingKeyResult =
  | { ok: true; billingKey: string; card: BillingCard; raw: unknown }
  | { ok: false; code: string; message: string };

const authHeader = (): string => {
  const secret = process.env.TOSS_BILLING_SECRET_KEY;
  if (!secret) throw new Error('TOSS_BILLING_SECRET_KEY가 설정되지 않았습니다.');
  return `Basic ${Buffer.from(`${secret}:`).toString('base64')}`;
};

type RawResult = { ok: true; json: Record<string, unknown> } | { ok: false; code: string; message: string };

const request = async (
  path: string,
  init: { body: unknown; idempotencyKey?: string },
): Promise<RawResult> => {
  let auth: string;
  try {
    auth = authHeader();
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      message: error instanceof Error ? error.message : 'TOSS_BILLING_SECRET_KEY가 설정되지 않았습니다.',
    };
  }
  try {
    const res = await fetch(`${TOSS_API}${path}`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
      },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? 'UNKNOWN'), message: String(json.message ?? '결제사 오류') };
    }
    return { ok: true, json };
  } catch (error) {
    // 타임아웃(AbortError)도 여기로 온다 — 호출자는 NETWORK_ERROR를 "거절"이 아니라
    // "물어보지도 못했다"로 다뤄야 한다(booking/confirm.ts와 같은 규칙).
    return { ok: false, code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : '네트워크 오류' };
  }
};

/** 카드 등록 성공 콜백의 authKey를 영구 빌링키로 바꾼다. */
export const issueBillingKey = async (input: {
  authKey: string;
  customerKey: string;
}): Promise<IssueBillingKeyResult> => {
  const result = await request('/billing/authorizations/issue', {
    body: { authKey: input.authKey, customerKey: input.customerKey },
  });
  if (!result.ok) return result;
  const json = result.json;
  const billingKey = typeof json.billingKey === 'string' ? json.billingKey : '';
  if (!billingKey) {
    return { ok: false, code: 'INVALID_RESPONSE', message: '빌링키가 응답에 없습니다.' };
  }
  const card = (json.card ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    billingKey,
    card: {
      company: typeof card.company === 'string' ? card.company : undefined,
      // 토스는 마스킹된 카드번호를 number로 준다(옛 응답은 cardNumber).
      numberMasked:
        typeof card.number === 'string'
          ? card.number
          : typeof card.cardNumber === 'string'
            ? card.cardNumber
            : undefined,
      cardType: typeof card.cardType === 'string' ? card.cardType : undefined,
    },
    raw: json,
  };
};

/**
 * 빌링키로 결제한다.
 *
 * idempotencyKey는 반드시 넘긴다 — 타임아웃(NETWORK_ERROR)과 진짜 실패를 호출자가
 * 구분할 수 없으므로, 키가 없으면 재시도가 이중 청구가 된다. 다만 **재시도마다 키가
 * 달라야** 한다(service.ts의 attempt 포함 규칙): 같은 키로 다시 부르면 토스가 최초의
 * 실패 응답을 그대로 replay해 영영 결제되지 않는다.
 */
export const chargeBillingKey = async (input: {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  idempotencyKey: string;
}): Promise<TossResult> => {
  const result = await request(`/billing/${encodeURIComponent(input.billingKey)}`, {
    idempotencyKey: input.idempotencyKey,
    body: {
      customerKey: input.customerKey,
      amount: input.amount,
      orderId: input.orderId,
      orderName: input.orderName,
      ...(input.customerEmail ? { customerEmail: input.customerEmail } : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
    },
  });
  if (!result.ok) return result;
  return { ok: true, payment: result.json as unknown as TossPayment };
};

/**
 * orderId로 결제를 재조회한다(GET /v1/payments/orders/{orderId}).
 *
 * lib/booking/toss.ts의 fetchPayment는 paymentKey로만 조회한다 — NETWORK_ERROR로 pending에
 * 남은 구독 회차는 애초에 paymentKey를 못 받았으므로(토스에 물어보지도 못한 상태) 그 함수를
 * 쓸 수 없다. cron이 다음 실행에서 "실제로는 승인됐을 수도 있는" pending 회차를 대사할 때
 * 이 함수로 orderId만 가지고 재조회한다.
 */
export const fetchPaymentByOrderId = async (orderId: string): Promise<TossResult> => {
  let auth: string;
  try {
    auth = authHeader();
  } catch (error) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      message: error instanceof Error ? error.message : 'TOSS_BILLING_SECRET_KEY가 설정되지 않았습니다.',
    };
  }
  try {
    const res = await fetch(`${TOSS_API}/payments/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, code: String(json.code ?? 'UNKNOWN'), message: String(json.message ?? '결제사 오류') };
    }
    return { ok: true, payment: json as unknown as TossPayment };
  } catch (error) {
    return { ok: false, code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : '네트워크 오류' };
  }
};
