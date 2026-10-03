import { buildShowRefundEmailHtml, buildShowTicketEmailHtml } from './emailHtml';

describe('공연 메일 HTML', () => {
  const html = buildShowTicketEmailHtml({
    buyerName: '홍길동', showTitle: '베어지지 않는 마음들', showSubtitle: '풍천리를 위한 밤', posterUrl: 'https://studionol.co.kr/images/shows/p.webp',
    when: '2026.10.24(토) 18:30', venueName: '삼청동 라플란드', venueAddress: '서울 종로구 삼청로 83',
    totalAmount: 50000, orderNo: 'TKT-20261003-ABCDEF12', manageUrl: 'https://studionol.co.kr/ko/shows/manage/TKT-20261003-ABCDEF12?token=t',
    tickets: [{ typeName: '사전 예매', entryNumber: 1, code: 'SNT1:AAA' }, { typeName: '사전 예매', entryNumber: null, code: 'SNT1:BBB' }],
    refundLines: ['공연 10일 전까지 100%'], contact: 'hello@studionol.co.kr',
  });

  it('주 버튼이 내 티켓 링크이고 입장 번호·첨부 안내·금액이 있다', () => {
    expect(html).toContain('href="https://studionol.co.kr/ko/shows/manage/TKT-20261003-ABCDEF12?token=t"');
    expect(html).toContain('내 티켓(QR) 열기');
    expect(html).toContain('001');
    expect(html).toContain('ticket-1.png');
    expect(html).toContain('ticket-2.png');
    expect(html).toContain('50,000');
    expect(html).toContain('풍천리를 위한 밤');
    expect(html).toContain('src="https://studionol.co.kr/images/shows/p.webp"');
  });

  it('값은 HTML 이스케이프된다 — 공연 제목·이름에 태그가 들어와도 마크업이 되지 않는다', () => {
    const risky = buildShowTicketEmailHtml({
      buyerName: '<b>x</b>', showTitle: 'A & B <script>', posterUrl: null, when: 'w', venueName: 'v', venueAddress: 'a',
      totalAmount: 1000, orderNo: 'o', manageUrl: 'https://x/?a=1&b=2', tickets: [], refundLines: [], contact: 'c',
    });
    expect(risky).not.toContain('<script>');
    expect(risky).toContain('A &amp; B &lt;script&gt;');
    expect(risky).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(risky).toContain('href="https://x/?a=1&amp;b=2"');
  });

  it('환불 메일은 금액과 전액/부분 문구를 가른다', () => {
    const base = { buyerName: '홍', showTitle: '공연', when: 'w', orderNo: 'o', refundedAmount: 25000, manageUrl: 'https://x', contact: 'c' };
    expect(buildShowRefundEmailHtml({ ...base, fullyRefunded: true })).toContain('모두 환불되어');
    expect(buildShowRefundEmailHtml({ ...base, fullyRefunded: false })).toContain('남은 티켓은 그대로');
    expect(buildShowRefundEmailHtml({ ...base, fullyRefunded: true })).toContain('25,000');
  });
});
