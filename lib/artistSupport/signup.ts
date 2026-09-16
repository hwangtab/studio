import { getArtistSupportTier } from '../../data/pricing';
import { getSupportedArtist } from '../../data/artists';

/**
 * 후원자가 폼에서 보내는 값. 금액은 받지 않는다 — 등급 id만 받고 서버가 상수에서 계산한다.
 */
export interface ArtistSupportSignupPayload {
  artistSlug: string;
  tierId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  displayName: string;
  displayConsent: boolean;
}

export type SignupValidation =
  | { ok: true; value: ArtistSupportSignupPayload }
  | { ok: false; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/**
 * 결제일 상한. 29~31일 가입자는 28일로 고정한다(스펙 §4 가정 11) — 그 날이 없는 달마다
 * 말일로 당겨지는 것보다 매달 같은 날이 예측하기 쉽다. 연습실·레슨은 계약서 결제일을
 * 그대로 쓰므로 이 규칙은 아티스트 구독에만 적용된다.
 */
export const MAX_SIGNUP_BILLING_DAY = 28;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * 폼 값 검증. 존재·형식만 본다 — "그 아티스트가 후원을 열었는가"는 createSubscription이
 * 다시 확인한다(그쪽이 정본이고, 여기서 한 번 더 보는 것은 사람이 읽는 오류 문구를 위해서다).
 */
export const validateArtistSupportSignup = (body: unknown): SignupValidation => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  }
  const b = body as Record<string, unknown>;

  const artistSlug = str(b.artistSlug);
  if (!artistSlug || !getSupportedArtist(artistSlug)) return { ok: false, message: '아티스트를 찾을 수 없습니다.' };

  const tierId = str(b.tierId);
  if (!tierId || !getArtistSupportTier(tierId)) return { ok: false, message: '구독 등급을 골라 주세요.' };

  const customerName = str(b.customerName);
  if (customerName.length < 1 || customerName.length > 50) return { ok: false, message: '이름을 입력해 주세요.' };

  const customerEmail = str(b.customerEmail);
  if (!EMAIL.test(customerEmail) || customerEmail.length > 254) return { ok: false, message: '이메일 주소를 확인해 주세요.' };

  // 휴대폰은 선택이다(스펙 §8.1). 비워 두면 카드 등록·해지 안내가 메일로만 간다.
  const customerPhone = str(b.customerPhone);
  if (customerPhone && !/^[0-9+\-\s()]{8,20}$/.test(customerPhone)) return { ok: false, message: '전화번호 형식을 확인해 주세요.' };

  const displayConsent = b.displayConsent === true;
  const displayName = str(b.displayName) || customerName;
  if (displayName.length > 30) return { ok: false, message: '표시 이름은 30자 이내로 적어 주세요.' };

  // 약관·자동결제 동의는 체크 한 번이 아니라 "구독 시작하기를 누르는 행위"로 받는다 —
  // 카드 등록 화면(pages/[locale]/subscribe/[id].tsx)이 같은 판단을 이미 하고 있고, 그 화면에
  // 규정 전문이 펼쳐진다. 여기서 별도 동의값을 요구하면 두 화면이 서로 다른 동의를 받게 된다.

  return {
    ok: true,
    value: { artistSlug, tierId, customerName, customerEmail, customerPhone, displayName, displayConsent },
  };
};

/** 가입일(KST)의 일(日)을 결제일로. 29~31일은 28일. */
export const billingDayForSignup = (now: Date): number => {
  const kstDay = new Date(now.getTime() + KST_OFFSET_MS).getUTCDate();
  return Math.min(kstDay, MAX_SIGNUP_BILLING_DAY);
};
