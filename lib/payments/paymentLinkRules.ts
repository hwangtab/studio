import { kstDateString } from '../booking/kst';

/**
 * 결제 링크의 **순수 규칙**(slug 형태·입력 한도·입력 검증) — 클라이언트 번들(관리자 화면)이 값으로 가져가므로 서버 모듈(DB·node:crypto)을
 * import하지 않는다. DB 조회·발급·닫기는 lib/payments/paymentLinks.ts.
 */

export const PAYMENT_LINK_SLUG_PATTERN = /^[0-9a-f]{24}$/;

/** 오타·자릿수 실수를 거르는 상한·하한 — 정말 필요하면 여기를 고친다. */
export const PAYMENT_LINK_LIMITS = { itemNameMax: 60, memoMax: 200, minAmount: 1_000, maxAmount: 50_000_000 } as const;

export interface PaymentLinkInput {
  itemName: string;
  totalAmount: number;
  expiresOn: string | null;
  memo: string | null;
}

const isRealDate = (ymd: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
};

export const validatePaymentLinkInput = (
  body: unknown,
  now: Date = new Date(),
): { ok: true; value: PaymentLinkInput } | { ok: false; message: string } => {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const itemName = typeof b.itemName === 'string' ? b.itemName.trim() : '';
  if (!itemName || itemName.length > PAYMENT_LINK_LIMITS.itemNameMax)
    return { ok: false, message: `상품명은 1~${PAYMENT_LINK_LIMITS.itemNameMax}자로 적어 주세요.` };
  const amount = typeof b.totalAmount === 'number' ? b.totalAmount : Number(b.totalAmount);
  if (!Number.isInteger(amount) || amount < PAYMENT_LINK_LIMITS.minAmount || amount > PAYMENT_LINK_LIMITS.maxAmount)
    return { ok: false, message: `금액은 ${PAYMENT_LINK_LIMITS.minAmount.toLocaleString('ko-KR')}~${PAYMENT_LINK_LIMITS.maxAmount.toLocaleString('ko-KR')}원 사이의 정수(부가세 포함)로 적어 주세요.` };
  const rawExpires = typeof b.expiresOn === 'string' ? b.expiresOn.trim() : '';
  if (rawExpires && !isRealDate(rawExpires)) return { ok: false, message: '만료일은 YYYY-MM-DD 형식으로 적어 주세요.' };
  if (rawExpires && rawExpires < kstDateString(now)) return { ok: false, message: '만료일이 이미 지났어요.' };
  const memo = typeof b.memo === 'string' ? b.memo.trim() : '';
  if (memo.length > PAYMENT_LINK_LIMITS.memoMax) return { ok: false, message: `메모는 ${PAYMENT_LINK_LIMITS.memoMax}자 안으로 적어 주세요.` };
  return { ok: true, value: { itemName, totalAmount: amount, expiresOn: rawExpires || null, memo: memo || null } };
};
