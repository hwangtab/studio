/**
 * 입주자 연락처 → 메시지 앱(`sms:`)·전화(`tel:`) 링크. 숫자만 남기고(하이픈·공백·괄호 제거) 국제 표기 `+82`는 살린다.
 * 국내 휴대폰·일반전화로 볼 수 있는 길이(9~11자리, 국제 표기는 +82 뒤 9~10자리)가 아니면 null — 잘못된 번호로 문자 앱을 열지 않는다.
 */
export const normalizePhoneForLink = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  const international = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (international) return digits.startsWith('82') && digits.length >= 11 && digits.length <= 12 ? `+${digits}` : null;
  return digits.length >= 9 && digits.length <= 11 ? digits : null;
};

export const smsHref = (raw: string | null | undefined): string | null => {
  const n = normalizePhoneForLink(raw);
  return n ? `sms:${n}` : null;
};

export const telHref = (raw: string | null | undefined): string | null => {
  const n = normalizePhoneForLink(raw);
  return n ? `tel:${n}` : null;
};
