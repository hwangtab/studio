import { buildShowTicketEmail } from './email';

const base = {
  orderNo: 'TKT-20261024-ABCDEF12',
  manageToken: 'tok',
  buyerName: 'Alex',
  showTitle: "Hearts That Won't Be Cut Down — A Night in Samcheong-dong for Pungcheon-ri",
  showSubtitle: 'A Night in Samcheong-dong for Pungcheon-ri',
  venueName: 'Lapland, Samcheong-dong',
  venueAddress: '2F, Building Ga, 83 Samcheong-ro, Jongno-gu, Seoul',
  startsAtSec: Math.floor(new Date('2026-10-24T18:30:00+09:00').getTime() / 1000),
  totalAmount: 25000,
  tickets: [{ code: 'ABC123', entryNumber: 7, typeName: 'Advance ticket (1 drink included)' }],
};

describe('영어 주문의 티켓 메일', () => {
  it('제목·본문·내 티켓 주소가 영어(/en)다', () => {
    const m = buildShowTicketEmail({ ...base, locale: 'en' });
    expect(m.subject).toBe("[Studio NOL] Your ticket is ready — Hearts That Won't Be Cut Down, Sat, Oct 24, 2026, 18:30 KST");
    expect(m.text).toContain('Amount paid: ₩25,000');
    expect(m.text).toContain('/en/shows/manage/TKT-20261024-ABCDEF12?token=tok');
    expect(m.text).toContain('Up to 10 days before the show — 100%');
    expect(m.html).toContain('<html lang="en">');
    // HTML 주석과 상호 표기 "(스튜디오 놀)"·로고 alt를 빼면 한글이 없어야 한다.
    const visible = m.html.replace(/<!--[\s\S]*?-->/g, '').replaceAll('스튜디오 놀', '');
    expect(visible).not.toMatch(/[가-힣]/);
  });

  it('언어가 없으면 지금과 같은 한국어 메일이다', () => {
    const m = buildShowTicketEmail(base);
    expect(m.subject.startsWith('[스튜디오 놀] 티켓이 발권됐어요')).toBe(true);
    expect(m.text).toContain('/ko/shows/manage/');
    expect(m.html).toContain('<html lang="ko">');
  });
});
