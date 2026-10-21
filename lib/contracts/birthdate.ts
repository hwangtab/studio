/**
 * 서명 화면의 생년월일 입력 — 연습실·제작 계약이 함께 쓴다.
 *
 * `<input type="date">`는 휴대폰에서 연도를 수십 번 넘겨야 하는 휠이 뜨고 제조사마다 모양이 달라, 숫자 8자리
 * (19900115)를 치면 `1990-01-15`로 정리되는 글자 칸으로 바꿨다. 서버가 받는 형식(YYYY-MM-DD, validation.ts
 * validateSignerDetails)은 그대로다.
 *
 * **이 모듈은 아무것도 import하지 않는다** — 클라이언트 번들이 가져간다.
 */

/** 입력한 글자에서 숫자만 남겨 `YYYY`, `YYYY-MM`, `YYYY-MM-DD`로 정리한다. 8자리를 넘는 숫자는 버린다. */
export const formatBirthdateInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

export type BirthdateParse =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'incomplete' | 'invalid' | 'future' | 'too-old' };

/** 서버(validateSignerDetails)와 같은 계산 — 만 나이를 365.2425일 단위로 센다. */
const ageInYears = (birth: Date, now: Date): number => (now.getTime() - birth.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);

const toBirthDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/** `YYYY-MM-DD` 글자가 실제 달력에 있는 날짜인가(2월 30일 같은 값을 거른다). */
const isRealDate = (value: string): boolean => {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const parseBirthdate = (text: string, now: Date = new Date()): BirthdateParse => {
  if (text.trim() === '') return { ok: false, reason: 'empty' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { ok: false, reason: 'incomplete' };
  if (!isRealDate(text) || Number(text.slice(0, 4)) < 1000) return { ok: false, reason: 'invalid' };
  const birth = toBirthDate(text);
  if (birth.getTime() > now.getTime()) return { ok: false, reason: 'future' };
  if (ageInYears(birth, now) > 120) return { ok: false, reason: 'too-old' };
  return { ok: true, value: text };
};

/** 칸 아래에 보일 오류 문구. 아직 다 치지 않았으면(incomplete) `eager`일 때만 말한다. */
export const birthdateErrorMessage = (parse: BirthdateParse, eager: boolean): string | undefined => {
  if (parse.ok) return undefined;
  switch (parse.reason) {
    case 'empty':
      return eager ? '입력해 주세요.' : undefined;
    case 'incomplete':
      return eager ? '숫자 8자리로 입력해 주세요. 예: 19900115' : undefined;
    case 'invalid':
      return '없는 날짜예요. 연·월·일을 다시 확인해 주세요.';
    case 'future':
      return '미래 날짜는 입력할 수 없어요.';
    case 'too-old':
      return '생년월일을 다시 확인해 주세요.';
  }
};

/** 만 19세 미만인가 — 서버의 미성년 판정(age < 19)과 같은 식이다. */
export const isUnder19 = (value: string, now: Date = new Date()): boolean => {
  const parse = parseBirthdate(value, now);
  return parse.ok && ageInYears(toBirthDate(parse.value), now) < 19;
};
