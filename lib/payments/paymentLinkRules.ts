import { kstDateString } from '../booking/kst';

/**
 * 결제 링크의 **순수 규칙**(slug 형태·입력 한도·입력 검증) — 클라이언트 번들(관리자 화면)이 값으로 가져가므로 서버 모듈(DB·node:crypto)을
 * import하지 않는다. DB 조회·발급·닫기는 lib/payments/paymentLinks.ts.
 */

export const PAYMENT_LINK_SLUG_PATTERN = /^[0-9a-f]{24}$/;

/** 오타·자릿수 실수를 거르는 상한·하한 — 정말 필요하면 여기를 고친다. */
export const PAYMENT_LINK_LIMITS = { itemNameMax: 60, memoMax: 200, minAmount: 1_000, maxAmount: 50_000_000, maxSessionHours: 12 } as const;

export interface PaymentLinkInput {
  itemName: string;
  totalAmount: number;
  expiresOn: string | null;
  memo: string | null;
  /** 이용 일시(초) — 없으면 일시 없는 링크. 관리자 "이번 주 세션"·예약 목록에 이 시각으로 보인다. */
  sessionAt: number | null;
  /** 이용 시간(시간 수) — `sessionAt`이 있을 때만. 슬롯 차단의 길이. */
  sessionHours: number | null;
  /** 이용 시간대를 "예약 불가 블록"으로 막을지(웹 이중 예약 방지). `sessionAt`이 있을 때만 의미가 있고 기본은 막는다. */
  blockSlot: boolean;
}

const isRealDate = (ymd: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
};

/**
 * 이용 일시 입력 → 초. `YYYY-MM-DD HH:mm` 또는 `YYYY-MM-DDTHH:mm`(`datetime-local`), **한국시간**으로 읽는다. 형식이 틀리면 null.
 */
export const parseKstSessionAt = (raw: string): number | null => {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(raw.trim());
  if (!m || !isRealDate(m[1])) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  const [y, mo, d] = m[1].split('-').map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d, hour - 9, minute) / 1000);
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
  const rawSession = typeof b.sessionAt === 'string' ? b.sessionAt.trim() : '';
  const rawHours = b.sessionHours === undefined || b.sessionHours === null || b.sessionHours === '' ? null : Number(b.sessionHours);
  let sessionAt: number | null = null;
  let sessionHours: number | null = null;
  if (rawSession) {
    sessionAt = parseKstSessionAt(rawSession);
    if (sessionAt === null) return { ok: false, message: '이용 일시는 YYYY-MM-DD HH:mm(한국시간) 형식으로 적어 주세요.' };
    if (sessionAt * 1000 <= now.getTime()) return { ok: false, message: '이용 일시가 이미 지났어요.' };
    if (rawHours === null || !Number.isInteger(rawHours) || rawHours < 1 || rawHours > PAYMENT_LINK_LIMITS.maxSessionHours)
      return { ok: false, message: `이용 시간은 1~${PAYMENT_LINK_LIMITS.maxSessionHours}시간 사이의 정수로 적어 주세요.` };
    sessionHours = rawHours;
  } else if (rawHours !== null) {
    return { ok: false, message: '이용 시간만 적을 수 없어요 — 이용 일시도 함께 적어 주세요.' };
  }
  // 기본은 막는다(이중 예약이 실제 위험이다). 명시적으로 끌 때만 안 막는다.
  const blockSlot = sessionAt !== null && !(b.blockSlot === false || b.blockSlot === 'false' || b.blockSlot === 'off');
  return { ok: true, value: { itemName, totalAmount: amount, expiresOn: rawExpires || null, memo: memo || null, sessionAt, sessionHours, blockSlot } };
};
