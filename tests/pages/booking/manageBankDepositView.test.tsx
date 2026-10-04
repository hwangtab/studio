import { render, screen } from '@testing-library/react';

import BookingManagePage from '../../../pages/[locale]/booking/manage/[orderNo]';

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const session = {
  kind: 'session' as const, orderNo: 'SNB-1', token: 'tok', productName: '보컬 녹음', startAt: '2026-12-10T05:00:00.000Z',
  durationHours: 3, itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, bookingStatus: 'confirmed' as const,
  canCancel: true, refundQuote: { daysBefore: 10, rate: 1, refundAmount: 275000 }, refundLines: ['3일 전까지 전액'],
  bankDeposit: null, depositGuide: null,
};

describe('예약 확인 — 계좌 입금 화면', () => {
  it('입금 대기면 계좌 안내(큰 계좌번호·예약하신 분 성함)와 입금 전 신청 취소를 그리고, 일반 취소는 없다', () => {
    render(<BookingManagePage {...session} bookingStatus="pending" canCancel={false} refundQuote={null} bankDeposit="awaiting"
      depositGuide={{ amount: 275000, deadline: '2026-10-07T03:00:00.000Z', customerName: '김입금', applicantLabel: '예약하신 분' }} />);
    expect(screen.getByText('3333-12-5480849')).toBeTruthy();
    expect(screen.getByText(/예약하신 분 성함/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입금 전 예약 신청 취소' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /주문 취소/ })).toBeNull();
  });

  it('입금 확인된 주문의 취소는 환불 계좌를 받는다(채우기 전에는 버튼이 닫힌다)', () => {
    render(<BookingManagePage {...session} bankDeposit="paid" />);
    expect(screen.getByText('환불받을 계좌')).toBeTruthy();
    expect((screen.getByRole('button', { name: '이 계좌로 환불받고 취소' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('토스 주문은 환불 계좌를 묻지 않는다', () => {
    render(<BookingManagePage {...session} />);
    expect(screen.queryByText('환불받을 계좌')).toBeNull();
    expect(screen.getByRole('button', { name: '주문 취소' })).toBeTruthy();
  });
});
