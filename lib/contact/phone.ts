/**
 * 전화번호 정규화 — 의존성 없는 말단 모듈. 서버 검증(lib/booking/validation.ts·lib/shows/validation.ts)과
 * 결제 화면의 연락처 칸(lib/contact/rules.ts)이 같이 읽는다. 화면 번들에 상품 카탈로그가 딸려 오지 않게
 * 여기에는 아무것도 import하지 않는다.
 */

/**
 * 휴대폰 번호 정규화 — 국제 형식(+82 10-4255-7893, +821042557893, 82-10-…)과
 * 공백·하이픈·괄호 섞인 입력을 전부 010XXXXXXXX로 모은 뒤 검증한다.
 * 저장은 항상 010-1234-5678 형태로 통일해 메일·관리자 화면 표기를 일관되게 한다.
 * 정규화 불가(자릿수·국번 불일치)면 null.
 */
export const normalizeKoreanMobile = (raw: string): string | null => {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+82')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('82') && digits.length >= 12) digits = '0' + digits.slice(2);
  digits = digits.replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) return null;
  const mid = digits.length === 11 ? digits.slice(3, 7) : digits.slice(3, 6);
  return `${digits.slice(0, 3)}-${mid}-${digits.slice(-4)}`;
};

/**
 * 한국 휴대폰이면 010-0000-0000으로 맞추고, 아니면 국가번호(+)로 시작하는 해외 번호를 받는다
 * (공연 예매 — 영어 화면을 연 2026-10-07부터. 해외에서 온 관객은 한국 번호가 없다). 문자 발송에 쓰지 않고
 * 운영자가 연락할 때만 쓴다. 해외 번호는 `+` 뒤 숫자 7~15자리(E.164 상한)를 `+<숫자>`로 저장한다.
 */
export const normalizeKrOrIntlPhone = (raw: string): string | null => {
  const kr = normalizeKoreanMobile(raw);
  if (kr) return kr;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  if (!/^\+[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || digits.startsWith('0')) return null;
  return `+${digits}`;
};
