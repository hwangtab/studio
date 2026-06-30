import { isAllowedLinkHref } from './safeLinks';

describe('isAllowedLinkHref', () => {
  it('allows http, https, mailto, tel, and local relative links', () => {
    expect(isAllowedLinkHref('https://example.com')).toBe(true);
    expect(isAllowedLinkHref('http://example.com')).toBe(true);
    expect(isAllowedLinkHref('mailto:test@example.com')).toBe(true);
    expect(isAllowedLinkHref('tel:010-4255-7893')).toBe(true);
    expect(isAllowedLinkHref('/ko/stories/sample')).toBe(true);
    expect(isAllowedLinkHref('./relative')).toBe(true);
    expect(isAllowedLinkHref('../relative')).toBe(true);
    expect(isAllowedLinkHref('#section')).toBe(true);
    expect(isAllowedLinkHref('?page=2')).toBe(true);
  });

  it('blocks explicit unsafe protocols and protocol-relative links', () => {
    expect(isAllowedLinkHref('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('java\u0000script:alert(1)')).toBe(false);
    expect(isAllowedLinkHref('data:text/html;base64,abc')).toBe(false);
    expect(isAllowedLinkHref('vbscript:msgbox(1)')).toBe(false);
    expect(isAllowedLinkHref('//example.com')).toBe(false);
  });
});
