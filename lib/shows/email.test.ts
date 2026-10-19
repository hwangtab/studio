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

  it('환불 규정 줄은 화면·FAQ와 같은 정본(refundTierLines)에서 온다', () => {
    const lines = buildRefundPolicyLines();
    expect(lines[0]).toBe('공연 10일 전까지 100%');
    expect(lines[3]).toBe('공연 1~2일 전 70%');
    expect(lines[4]).toBe('공연 당일(시작 전) 10%');
    expect(lines[5]).toContain('공연 시작 후에는 환불할 수 없습니다');
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

  it('회차 취소 메일은 실제 환불액으로 말한다 — 부분이면 금액을, 0원이면 전액이라고 쓰지 않는다', () => {
    const partial = buildShowtimeCancelledEmail({ ...base, refundCompleted: true, refundedAmount: 10000, checkedInExcluded: true }).text;
    expect(partial).toContain('30,000원 중 10,000원을 환불 처리');
    expect(partial).toContain('입장 처리된 티켓 제외');
    // 입장 티켓이 없는데 부분이면(회차 취소 전 고객이 일부 환불받음) 그 괄호를 쓰지 않는다.
    expect(buildShowtimeCancelledEmail({ ...base, refundCompleted: true, refundedAmount: 10000 }).text).toContain('이미 환불된 금액 제외');
    expect(partial).not.toContain('전액 환불');
    const none = buildShowtimeCancelledEmail({ ...base, refundCompleted: true, refundedAmount: 0 }).text;
    expect(none).toContain('환불 대상 금액이 없어요');
    expect(none).not.toContain('전액');
    const full = buildShowtimeCancelledEmail({ ...base, refundCompleted: true, refundedAmount: 30000 }).text;
    expect(full).toContain('전액 환불 처리');
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
    expect(m.subject).toContain('환불 요청을 접수했어요');
    expect(m.text.split('\n')[0]).toContain('환불 요청을 접수했어요');
    expect(m.text).not.toContain('환불이 완료됐어요');
    expect(m.text).toContain('3영업일 이내');
    expect(m.html).not.toContain('환불이 완료됐어요');
  });
  it('관리자가 기록한 계좌 환불(이미 송금)은 "완료"이고 3영업일 문구가 없다', () => {
    const m = buildShowRefundEmail({ ...base, refundedAmount: 10000, fullyRefunded: true, refundVia: 'bank_account_sent' });
    expect(m.subject).toContain('환불이 완료됐어요');
    expect(m.text).not.toContain('3영업일');
    expect(m.html).not.toContain('3영업일');
    expect(m.text).toContain('계좌로 보내 드렸어요');
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
    expect(text).toContain('자동으로 환불됐어요');
    expect(text).not.toContain('송금');
  });
});
