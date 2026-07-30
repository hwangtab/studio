/**
 * 서명자 본인 확인.
 *
 * 이메일 링크만으로는 그 링크를 받은 사람이 계약 당사자인지 알 수 없다. 계약서에 적힌
 * 연락처의 뒷자리를 맞추게 하면, 링크를 우연히 또는 부당하게 알게 된 제3자를 걸러낼 수
 * 있다. 휴대폰 본인인증만큼 강하지는 않지만, 아무 확인이 없는 것과는 다르다.
 */

/** 확인에 쓰는 자릿수. 계약서 서명란 안내와 함께 맞춰야 한다. */
export const IDENTITY_DIGITS = 4;

/** 전화번호에서 숫자만 남긴다 — 입력·저장 형식(하이픈·공백)이 달라도 같게 본다. */
const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * 계약서에 적힌 연락처의 뒷자리를 돌려준다. 번호가 짧아 뒷자리를 만들 수 없으면 null.
 */
export const getIdentityDigits = (phone: string): string | null => {
  const digits = digitsOnly(phone);
  if (digits.length < IDENTITY_DIGITS) return null;
  return digits.slice(-IDENTITY_DIGITS);
};

export type IdentityCheck =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'mismatch' | 'unverifiable' };

/**
 * 서명자가 입력한 뒷자리를 계약서의 연락처와 대조한다.
 *
 * 계약서의 번호 자체가 이상해 확인할 수 없는 경우('unverifiable')와 입력이 틀린 경우
 * ('mismatch')를 구분한다 — 전자는 관리자가 계약을 고쳐야 하고, 후자는 서명자가 다시
 * 입력하면 된다.
 */
export const verifyIdentityDigits = (input: unknown, contractPhone: string): IdentityCheck => {
  if (typeof input !== 'string') return { ok: false, reason: 'malformed' };

  const entered = digitsOnly(input);
  if (entered.length !== IDENTITY_DIGITS) return { ok: false, reason: 'malformed' };

  const expected = getIdentityDigits(contractPhone);
  if (!expected) return { ok: false, reason: 'unverifiable' };

  return entered === expected ? { ok: true } : { ok: false, reason: 'mismatch' };
};
