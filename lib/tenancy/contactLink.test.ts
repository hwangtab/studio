import { normalizePhoneForLink, smsHref, telHref } from './contactLink';

describe('입주자 연락처 링크', () => {
  it('하이픈·공백을 걷고 숫자만 남긴다', () => {
    expect(normalizePhoneForLink('010-1234-5678')).toBe('01012345678');
    expect(normalizePhoneForLink(' 010 1234 5678 ')).toBe('01012345678');
    expect(smsHref('010-1234-5678')).toBe('sms:01012345678');
    expect(telHref('02-123-4567')).toBe('tel:021234567');
  });
  it('국제 표기 +82는 살린다', () => {
    expect(normalizePhoneForLink('+82 10-1234-5678')).toBe('+821012345678');
    expect(normalizePhoneForLink('+1 415 555 0100')).toBeNull();
  });
  it('비었거나 번호로 볼 수 없으면 null — 잘못된 번호로 앱을 열지 않는다', () => {
    expect(normalizePhoneForLink('')).toBeNull();
    expect(normalizePhoneForLink(null)).toBeNull();
    expect(normalizePhoneForLink('연락 안 됨')).toBeNull();
    expect(normalizePhoneForLink('1234')).toBeNull();
    expect(smsHref('abc')).toBeNull();
  });
});
