const CONTROL_AND_SPACE_CHARS = /[\u0000-\u001F\u007F\s]+/g;
const EXPLICIT_PROTOCOL = /^([a-z][a-z0-9+.-]*):/;

export const isAllowedLinkHref = (href: string | undefined): boolean => {
  if (!href) {
    return false;
  }

  const trimmed = href.trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();
  const compact = normalized.replace(CONTROL_AND_SPACE_CHARS, '');

  // 브라우저는 URL 파싱 시 백슬래시를 슬래시와 동일하게 취급한다
  // (`new URL('\\evil.com', base)` → origin이 evil.com으로 바뀜).
  // 오픈리다이렉트 우회를 막기 위해 백슬래시가 섞인 href는 전부 차단한다.
  if (compact.includes('\\')) {
    return false;
  }

  if (
    compact.startsWith('/') ||
    compact.startsWith('./') ||
    compact.startsWith('../') ||
    compact.startsWith('#') ||
    compact.startsWith('?')
  ) {
    return !compact.startsWith('//');
  }

  if (/^(https?|mailto|tel):/.test(compact)) {
    return true;
  }

  if (EXPLICIT_PROTOCOL.test(compact)) {
    return false;
  }

  return true;
};
