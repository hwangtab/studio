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

/**
 * 서명 화면에 보여 줄 계약서에서 확인 값을 가린다.
 *
 * 서명 페이지는 계약서 전문을 보여 주고, 그 안에는 이용자 연락처가 그대로 적혀 있다.
 * 뒷자리를 묻는데 같은 화면에 답이 있으면, 링크를 알게 된 제3자도 읽어서 입력하면 된다
 * — 본인 확인이 걸러내려던 대상을 전혀 막지 못한다.
 *
 * DB에 보관하는 계약 본문은 그대로 두고 화면 표시만 가린다. 서명 후 발급되는 계약서에는
 * 전체 번호가 기재된다.
 */
export const maskIdentityDigits = (phone: string): string => {
  const trimmed = phone.trim();

  // 확인에 쓸 수 없는 번호는 가리지도 않는다. 가려 봐야 물어볼 값이 없고, 계약서 정보만
  // 이유 없이 사라진다.
  if (!getIdentityDigits(trimmed)) return trimmed;

  // 뒤에서 네 개의 숫자만 *로 바꾼다. 하이픈·공백 위치는 건드리지 않는다.
  let remaining = IDENTITY_DIGITS;
  return [...trimmed]
    .reverse()
    .map((char) => {
      if (remaining > 0 && /\d/.test(char)) {
        remaining -= 1;
        return '*';
      }
      return char;
    })
    .reverse()
    .join('');
};

export const maskIdentityDigitsInContent = (content: string, phone: string): string => {
  const trimmed = phone.trim();
  const masked = maskIdentityDigits(trimmed);

  if (masked === trimmed) return content;
  return content.split(trimmed).join(masked);
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
