import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings/o1' }) }));
jest.mock('../../../../components/admin/bookingActions', () => ({
  refundBooking: jest.fn(),
  resendBookingNotification: jest.fn(),
  setBookingStatus: jest.fn(),
  setWorkOrderStage: jest.fn(),
}));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminBookingDetailPage from '../../../../pages/admin/bookings/[id]';
import type { AdminBookingDetail } from '../../../../lib/booking/admin-serialize';

const SESSION: AdminBookingDetail = {
  id: 'o1', orderNo: 'SNB-1', orderType: 'session', customerName: '홍길동',
  customerPhone: '010-0000-0000', customerEmail: 'a@b.c', productId: 'recording-pro',
  productName: '레코딩', serviceType: 'recording',
  startAt: '2026-09-20T05:00:00.000Z', endAt: '2026-09-20T08:00:00.000Z', durationHours: 3,
  itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, orderStatus: 'paid',
  bookingId: 'b1', bookingStatus: 'confirmed', workOrder: null,
  notificationError: null, gcalError: null, gcalMissing: false,
  paymentCount: 1, latestPaymentKeyPrefix: 'pk123456', mismatch: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  customerNote: null, cancelledAt: null, payment: null, refunds: [], refundableAmount: 275000,
};

const MIXING_WORK_ORDER = {
  id: 'w1', status: 'cancelled' as const, songCount: 1, vocalTuning: false,
  startedAt: null, deliveredAt: null,
};

const refundForm = () => screen.queryByRole('button', { name: '환불 처리' });

/**
 * 이용일 1~2일 전 셀프 취소 → 50% 티어 → booking cancelled + order partially_refunded.
 * lib(cancel.ts)은 이 상태의 잔액 환불을 진작 지원했는데 그 입력을 띄우는 화면이 없었다.
 */
it('50% 티어로 취소된 예약에 잔액 환불 폼이 뜬다', () => {
  render(<AdminBookingDetailPage booking={{
    ...SESSION, bookingStatus: 'cancelled', orderStatus: 'partially_refunded', refundableAmount: 137500,
  }} />);
  expect(screen.getByText('잔액 환불')).toBeInTheDocument();
  expect(refundForm()).toBeInTheDocument();
  expect(screen.getByLabelText(/잔액 137,500/)).toBeInTheDocument();
});

/**
 * 이용일 당일 셀프 취소는 환불액 0원이라 booking만 cancelled가 되고 order는 paid로 남는다.
 * 예전엔 화면에 폼도 없고 API도 invalid_state라 호의·분쟁 환불 경로가 전혀 없었다.
 */
it('당일 취소(환불 0원)로 cancelled가 된 예약에도 잔액 환불 폼이 뜬다', () => {
  render(<AdminBookingDetailPage booking={{ ...SESSION, bookingStatus: 'cancelled', orderStatus: 'paid' }} />);
  expect(screen.getByText('잔액 환불')).toBeInTheDocument();
  expect(refundForm()).toBeInTheDocument();
});

it('취소된 믹싱 주문에도 잔액 환불 폼이 뜬다', () => {
  render(<AdminBookingDetailPage booking={{
    ...SESSION, orderType: 'mixing', bookingId: null, bookingStatus: null,
    workOrder: MIXING_WORK_ORDER, orderStatus: 'partially_refunded', refundableAmount: 50000,
  }} />);
  expect(screen.getByText('잔액 환불')).toBeInTheDocument();
});

// 잔액이 0이면 죽은 버튼이 된다 — cancel.ts가 '이미 전액 환불된 주문입니다'로 거절한다.
it('전액 환불된 건에는 폼을 띄우지 않는다', () => {
  render(<AdminBookingDetailPage booking={{
    ...SESSION, bookingStatus: 'cancelled', orderStatus: 'refunded', refundableAmount: 0,
  }} />);
  expect(refundForm()).not.toBeInTheDocument();
});

// 완료·노쇼는 cancel.ts가 거절하므로 폼을 띄우면 죽은 버튼이 된다.
it('완료·노쇼 예약에는 폼을 띄우지 않는다', () => {
  for (const bookingStatus of ['completed', 'no_show'] as const) {
    const { unmount } = render(<AdminBookingDetailPage booking={{ ...SESSION, bookingStatus }} />);
    expect(refundForm()).not.toBeInTheDocument();
    unmount();
  }
});

it('확정 예약은 종전대로 임의 환불 폼을 띄운다', () => {
  render(<AdminBookingDetailPage booking={SESSION} />);
  expect(screen.getByText('임의 환불')).toBeInTheDocument();
  expect(refundForm()).toBeInTheDocument();
});
