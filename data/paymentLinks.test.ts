import { getPaymentLink, PAYMENT_LINKS } from './paymentLinks';

describe('파일 링크는 늘리지 않는다', () => {
  // 새 링크는 관리자 /admin/payment-links 또는 `npx tsx scripts/pay-link.ts create …`로 DB에 만든다 — 그래야 이용 일시·예약 불가 블록·캘린더가 자동으로 따라온다.
  // 파일 링크는 그걸 못 한다(2026-10-16 최혜정 건). 이 목록은 줄기만 해야 한다.
  it('옛 파일 링크 4개 말고는 없다', () => {
    expect(Object.keys(PAYMENT_LINKS).sort()).toEqual([
      '46fee6d8ffa1a69be20324a2', '478d0f5260b329a6fcd59a19', '8519f93ee33960ccc793b0c5', 'fed74ccb84b8587112ed5d6f',
    ]);
  });
});

describe('파일 링크의 이용 일시', () => {
  // 2026-10-16 최혜정 건: 품목명에 "(10/17 17:00)"을 적고 이용 일시 필드는 빠뜨려, 결제가 돼도 대시보드·캘린더·예약 불가 블록에 안 올라갔다.
  it('품목명에 이용 일시("(M/D HH:MM)")를 적은 링크는 sessionAt이 같은 일시여야 한다', () => {
    for (const [slug, link] of Object.entries(PAYMENT_LINKS)) {
      const m = /\((\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2})\)/.exec(link.itemName);
      if (!m) continue;
      expect({ slug, hasSession: link.sessionAt !== undefined && link.sessionHours !== undefined }).toEqual({ slug, hasSession: true });
      const kst = new Date((link.sessionAt as number) * 1000 + 9 * 3600 * 1000);
      expect([kst.getUTCMonth() + 1, kst.getUTCDate(), kst.getUTCHours(), kst.getUTCMinutes()]).toEqual([Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]);
    }
  });
});

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
