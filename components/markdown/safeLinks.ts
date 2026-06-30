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
