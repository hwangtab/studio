import { getPaymentLink, PAYMENT_LINKS } from './paymentLinks';

describe('getPaymentLink', () => {
  const [slug] = Object.keys(PAYMENT_LINKS);

  it('slug는 추측할 수 없는 24자 hex다', () => {
    for (const key of Object.keys(PAYMENT_LINKS)) expect(key).toMatch(/^[0-9a-f]{24}$/);
  });

  it('등록된 slug는 링크를 돌려준다 — 첫 링크는 싱글 음원 제작 예약금 400,000원', () => {
    expect(getPaymentLink(slug)).toEqual({ itemName: '싱글 음원 제작 예약금', totalAmount: 400000 });
  });

  it('없는 slug·형식이 틀린 값은 null이다', () => {
    expect(getPaymentLink('0'.repeat(24))).toBeNull();
    expect(getPaymentLink('success')).toBeNull();
    expect(getPaymentLink('__proto__')).toBeNull();
    expect(getPaymentLink(undefined)).toBeNull();
    expect(getPaymentLink(['a'])).toBeNull();
  });

  describe('만료', () => {
    const withExpiry = (expiresOn: string) => {
      PAYMENT_LINKS[slug] = { ...PAYMENT_LINKS[slug], expiresOn };
    };
    const original = { ...PAYMENT_LINKS[slug] };
    afterEach(() => {
      PAYMENT_LINKS[slug] = { ...original };
    });

    it('만료일 당일 KST 끝까지는 열려 있다', () => {
      withExpiry('2026-10-10');
      // 2026-10-10 23:59 KST = 2026-10-10T14:59Z
      expect(getPaymentLink(slug, new Date('2026-10-10T14:59:00Z'))).not.toBeNull();
    });

    it('KST 자정을 넘기면 닫힌다', () => {
      withExpiry('2026-10-10');
      // 2026-10-11 00:00 KST = 2026-10-10T15:00Z
      expect(getPaymentLink(slug, new Date('2026-10-10T15:00:00Z'))).toBeNull();
    });

    it('만료일이 없으면 닫히지 않는다', () => {
      expect(getPaymentLink(slug, new Date('2099-01-01T00:00:00Z'))).not.toBeNull();
    });
  });
});
