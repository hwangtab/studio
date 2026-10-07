jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../db/client', () => ({ getDb: jest.fn() }));

import {
  buildRefundPolicyLines, buildShowRefundEmail, buildShowRefundOperatorEmail, buildShowTicketEmail,
  buildShowtimeCancelledEmail, resolveShowRecipient, showDateTimeLabel,
} from './email';

const base = {
  orderNo: 'TKT-20261003-ABCDEF12', manageToken: 'tok123', buyerName: '김놀',
  showTitle: '놀 라이브', venueName: '스튜디오 놀', venueAddress: '서울 은평구',
  startsAtSec: Date.UTC(2026, 9, 17, 10, 0) / 1000, // KST 19:00
  totalAmount: 30000,
};

describe('shows email 본문', () => {
  it('티켓 메일에 공연·일시·QR 첨부 안내·관리 링크·환불 규정이 든다', () => {
    const { subject, text } = buildShowTicketEmail({
      ...base,
      tickets: [
        { code: 'SNT1:AAAA', entryNumber: 7, typeName: '일반' },
        { code: 'SNT1:BBBB', entryNumber: null, typeName: '일반' },
      ],
    });
    expect(subject).toContain('놀 라이브');
    expect(text).toContain('2026.10.17(토) 19:00');
    expect(text).toContain('입장번호 007');
    expect(text).toContain('SNT1:BBBB');
    expect(text).toContain('/ko/shows/manage/TKT-20261003-ABCDEF12?token=tok123');
    expect(text).toContain('환불 규정');
    expect(text).toContain('30,000원');
  });

  it('환불 규정 줄은 refundRateForNotice에서 온다', () => {
    const lines = buildRefundPolicyLines();
    expect(lines[0]).toContain('100%');
    expect(lines[4]).toContain('10%');
  });

  it('광고성 표현이 없다', () => {
    const all = [
      buildShowTicketEmail({ ...base, tickets: [] }).text,
      buildShowRefundEmail({ ...base, refundedAmount: 1, fullyRefunded: true }).text,
      buildShowtimeCancelledEmail({ ...base, refundCompleted: true }).text,
    ].join('\n');
    expect(all).not.toMatch(/광고|이벤트|할인|혜택|쿠폰/);
  });

  it('회차 취소 메일은 환불 완료 여부에 따라 문구가 갈린다', () => {
    expect(buildShowtimeCancelledEmail({ ...base, refundCompleted: true }).text).toContain('전액 환불 처리');
    expect(buildShowtimeCancelledEmail({ ...base, refundCompleted: false }).text).toContain('처리 중');
  });

  it('showDateTimeLabel은 KST 연도를 붙인다', () => {
    expect(showDateTimeLabel(Date.UTC(2026, 11, 31, 16, 0) / 1000)).toBe('2027.01.01(금) 01:00');
  });

  it('받는 주소는 이메일 형식만 쓰고 연락처 전화번호는 거른다', () => {
    expect(resolveShowRecipient('', 'a@b.co')).toBe('a@b.co');
    expect(resolveShowRecipient('x@y.kr', 'a@b.co')).toBe('x@y.kr');
    expect(resolveShowRecipient('', '010-1234-5678')).toBeNull();
  });
});

describe('환불 메일 — 계좌 입금', () => {
  it('고객이 요청한 계좌 환불은 제목·첫 줄·HTML 모두 "환불 요청을 접수했습니다"이고 3영업일 송금을 말한다', () => {
    const m = buildShowRefundEmail({ ...base, refundedAmount: 10000, fullyRefunded: false, refundVia: 'bank_account' });
    expect(m.subject).toContain('환불 요청을 접수했습니다');
    expect(m.text.split('\n')[0]).toContain('환불 요청을 접수했습니다');
    expect(m.text).not.toContain('환불이 완료되었습니다');
    expect(m.text).toContain('3영업일 이내');
    expect(m.html).not.toContain('환불이 완료되었습니다');
  });
  it('관리자가 기록한 계좌 환불(이미 송금)은 "완료"이고 3영업일 문구가 없다', () => {
    const m = buildShowRefundEmail({ ...base, refundedAmount: 10000, fullyRefunded: true, refundVia: 'bank_account_sent' });
    expect(m.subject).toContain('환불이 완료되었습니다');
    expect(m.text).not.toContain('3영업일');
    expect(m.html).not.toContain('3영업일');
    expect(m.text).toContain('계좌로 보내 드렸습니다');
  });
});

describe('고객 셀프 환불 운영자 알림', () => {
  const data = {
    orderNo: 'TKT-20261003-ABCDEF12', showId: 'show-1', showTitle: '놀 라이브', buyerName: '김놀', buyerContact: '010-1234-5678',
    startsAtSec: Date.UTC(2026, 9, 17, 10, 0) / 1000, totalAmount: 30000, tickets: [],
  };

  it('계좌 입금 결제는 송금이 필요하다고 알린다', () => {
    const { subject, text, html } = buildShowRefundOperatorEmail({ ...data, refundedAmount: 27000, refundedCount: 1, refundVia: 'bank_account' });
    expect(subject).toContain('환불 송금 필요');
    expect(subject).toContain('27,000원');
    expect(text).toContain('환불 계좌로 27,000원을 보내고');
    expect(html).toContain('송금 완료');
  });

  it('카드 결제는 자동 환불됐다고만 알린다', () => {
    const { subject, text } = buildShowRefundOperatorEmail({ ...data, refundedAmount: 30000, refundedCount: 2, refundVia: 'payment' });
    expect(subject).toContain('고객 환불');
    expect(text).toContain('자동으로 환불되었습니다');
    expect(text).not.toContain('송금');
  });
});
