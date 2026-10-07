jest.mock('../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

import { buildDepositWithdrawnOperatorEmail } from './bankDepositOrders';

describe('입금 전 신청 취소 운영자 알림', () => {
  it('누가 무엇을 얼마에 신청했다가 직접 취소했는지 한 통에 담는다', () => {
    const { subject, text, html } = buildDepositWithdrawnOperatorEmail({
      orderNo: 'TKT-20261007-41A81C4A', customerName: '이관객', customerEmail: 'a@example.com', customerPhone: '010-1234-5678',
      totalAmount: 25000, kindLabel: '공연 예매', summaryLines: ['공연: 놀 라이브', '티켓: 1매'], adminUrl: 'https://studionol.co.kr/admin/shows/show-1',
    });
    expect(subject).toBe('[공연 예매] 계좌 입금 신청 취소 25,000원 — 이관객');
    expect(text).toContain('직접 취소했습니다');
    expect(text).toContain('공연: 놀 라이브');
    expect(text).toContain('010-1234-5678');
    expect(html).toContain('/admin/shows/show-1');
  });
});
