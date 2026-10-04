import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings/o1', pathname: '/admin/bookings/[id]' }),
}));
jest.mock('../../../../components/admin/bookingActions', () => ({
  refundBooking: jest.fn(),
  resendBookingNotification: jest.fn(),
  setBookingStatus: jest.fn(),
  setWorkOrderStage: jest.fn(),
}));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));
// 서버 전용 모듈 — 화면 테스트에서는 값 import가 필요 없다(타입·SSR만 쓴다).
jest.mock('../../../../lib/payments/bankDepositOrders', () => ({ findSameNameDepositOrders: jest.fn() }));
jest.mock('../../../../lib/payments/refundAccount', () => ({ loadRefundAccountSummary: jest.fn() }));

import AdminBookingDetailPage from '../../../../pages/admin/bookings/[id]';
import type { AdminBookingDetail } from '../../../../lib/booking/admin-serialize';

const BASE: AdminBookingDetail = {
  id: 'o1', orderNo: 'SNB-1', orderType: 'session', customerName: '홍길동',
  customerPhone: '010-0000-0000', customerEmail: 'a@b.c', productId: 'recording-pro',
  productName: '레코딩', serviceType: 'recording', roomNumber: null,
  startAt: '2026-09-20T05:00:00.000Z', endAt: '2026-09-20T08:00:00.000Z', durationHours: 3,
  itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, orderStatus: 'awaiting_deposit',
  bookingId: 'b1', bookingStatus: 'pending', workOrder: null,
  notificationError: null, gcalError: null, gcalMissing: false,
  paymentCount: 0, latestPaymentKeyPrefix: null, mismatch: false,
  createdAt: '2026-09-01T00:00:00.000Z', virtualAccountPayment: false,
  bankDeposit: 'awaiting', depositDeadline: '2026-09-04T00:00:00.000Z',
  customerNote: null, cancelledAt: null, payment: null, refunds: [], refundableAmount: 0,
};

const PAID: AdminBookingDetail = {
  ...BASE, orderStatus: 'paid', bookingStatus: 'confirmed', bankDeposit: 'paid', depositDeadline: null,
  paymentCount: 1, refundableAmount: 275000,
  payment: { id: 'p1', method: '계좌 입금', approvedAt: '2026-09-02T00:00:00.000Z', receiptUrl: null },
};

describe('계좌 입금 대기', () => {
  it('입금 확인·미입금 취소·재발송 버튼이 있고 확인창이 실입금 확인부터 묻는다', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminBookingDetailPage booking={BASE} />);
    expect(screen.getAllByText('계좌 입금 대기').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '미입금 취소' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '입금 안내 재발송' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '입금 확인' }));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/^통장에 실제로 입금됐는지 먼저 확인하세요/);
    expect(confirmSpy.mock.calls[0][0]).toContain('홍길동');
    expect(confirmSpy.mock.calls[0][0]).toContain('275,000');

    fireEvent.click(screen.getByRole('button', { name: '미입금 취소' }));
    expect(confirmSpy.mock.calls[1][0]).toMatch(/^받은 돈이 없는 신청을 닫습니다/);
    confirmSpy.mockRestore();
  });

  it('같은 이름 후보를 경고와 함께 링크로 보여 준다', () => {
    render(
      <AdminBookingDetailPage
        booking={BASE}
        sameNameDeposits={[{
          id: 'o2', orderNo: 'SNB-2', type: 'session', status: 'deposit_cancelled',
          totalAmount: 275000, createdAt: '2026-09-01T01:00:00.000Z',
        }]}
      />,
    );
    expect(screen.getByText(/같은 이름의 다른 계좌 입금 신청이 있습니다/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SNB-2' })).toHaveAttribute('href', '/admin/bookings/o2');
    expect(screen.getByText(/입금 전 취소/)).toBeInTheDocument();
  });

  it('입금 전 취소 건은 안내 문구만 있고 입금 확인 버튼은 없다', () => {
    render(<AdminBookingDetailPage booking={{ ...BASE, orderStatus: 'deposit_cancelled', bankDeposit: 'cancelled', bookingStatus: 'cancelled' }} />);
    expect(screen.getByText(/입금 전에 취소된 계좌 입금 신청입니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '입금 확인' })).not.toBeInTheDocument();
  });
});

describe('계좌 입금 확인된 건', () => {
  const SUMMARY = {
    status: 'present' as const, bankName: '국민은행', accountHolder: '김철수',
    updatedAt: '2026-09-03T00:00:00.000Z', refundedAt: null,
  };

  it('계좌 보기·송금 완료가 있고 계좌번호는 렌더에 없다', () => {
    const ui = <AdminBookingDetailPage booking={PAID} refundAccount={SUMMARY} />;
    const { container } = render(ui);
    expect(screen.getByRole('button', { name: '계좌 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '송금 완료' })).toBeInTheDocument();
    expect(screen.getByText(/예금주가 고객 이름\(홍길동\)과 다릅니다/)).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/(?!010)\d{3}-\d{2,}-\d{3,}/);
    expect(screen.getByRole('button', { name: '송금 완료(환불 기록)' })).toBeInTheDocument();
  });

  it('송금 완료 시각이 있으면 버튼 대신 시각을 보여 준다', () => {
    render(<AdminBookingDetailPage booking={PAID} refundAccount={{ ...SUMMARY, accountHolder: '홍 길동', refundedAt: '2026-09-04T00:00:00.000Z' }} />);
    expect(screen.queryByRole('button', { name: '송금 완료' })).not.toBeInTheDocument();
    expect(screen.getByText(/송금 완료:/)).toBeInTheDocument();
    expect(screen.queryByText(/예금주가 고객 이름/)).not.toBeInTheDocument();
  });

  it('요약을 못 읽으면 마이그레이션 안내를 띄운다', () => {
    render(<AdminBookingDetailPage booking={PAID} refundAccount={{ status: 'unavailable' }} />);
    expect(screen.getByText(/마이그레이션 0048 확인/)).toBeInTheDocument();
  });
});
