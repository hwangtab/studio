import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings/o1', pathname: '/admin/bookings/[id]' }) }));
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
  productName: '레코딩', serviceType: 'recording', roomNumber: null,
  startAt: '2026-09-20T05:00:00.000Z', endAt: '2026-09-20T08:00:00.000Z', durationHours: 3,
  itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, orderStatus: 'paid',
  bookingId: 'b1', bookingStatus: 'confirmed', workOrder: null,
  notificationError: null, gcalError: null, gcalMissing: false,
  paymentCount: 1, latestPaymentKeyPrefix: 'pk123456', mismatch: false,
  createdAt: '2026-09-01T00:00:00.000Z', virtualAccountPayment: false, bankDeposit: null, depositDeadline: null,
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

// 칸을 비우면 Number('')이 0이라 일반 취소(0원 허용)가 "환불 없이 취소"로 통과했다.
it('환불 금액 칸을 비우면 확인창 없이 거절한다', () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<AdminBookingDetailPage booking={SESSION} />);
  fireEvent.change(screen.getByLabelText(/환불 금액/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('환불 사유'), { target: { value: '고객 요청' } });
  fireEvent.click(refundForm() as HTMLElement);
  expect(screen.getByText(/환불 금액을 입력해 주세요/)).toBeInTheDocument();
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

// 예약금 결제 링크 주문 — 예약·작업 행이 없다. 카드(토스) 결제분은 토스 취소(cancel.ts refundDepositOrder), 계좌 입금분은 송금 기록.
const DEPOSIT: AdminBookingDetail = {
  ...SESSION, orderType: 'deposit', bookingId: null, bookingStatus: null, productId: '', productName: '예약금',
  startAt: null, endAt: null, durationHours: null, totalAmount: 110000, refundableAmount: 110000,
};

describe('예약금(deposit) 주문 환불', () => {
  it('카드(토스) 결제 건에 예약금 환불 폼이 뜨고 "가능한 작업이 없습니다"는 같이 뜨지 않는다', () => {
    render(<AdminBookingDetailPage booking={DEPOSIT} />);
    expect(screen.getByText('예약금 환불')).toBeInTheDocument();
    expect(refundForm()).toBeInTheDocument();
    expect(screen.queryByText(/가능한 작업이 없습니다/)).not.toBeInTheDocument();
  });

  it('같은 금액을 연속으로 환불할 수 없다는 제약을 화면에 안내한다', () => {
    render(<AdminBookingDetailPage booking={DEPOSIT} />);
    expect(screen.getByText(/금액을 달리 나눠 주세요/)).toBeInTheDocument();
  });

  it('계좌 입금 건은 송금 기록 폼이다', () => {
    render(<AdminBookingDetailPage booking={{ ...DEPOSIT, bankDeposit: 'paid' }} />);
    expect(screen.getByText('환불 기록')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '송금 완료(환불 기록)' })).toBeInTheDocument();
  });

  it('전액 환불됐거나 결제 전이면 폼이 없다', () => {
    const { unmount } = render(<AdminBookingDetailPage booking={{ ...DEPOSIT, orderStatus: 'refunded', refundableAmount: 0 }} />);
    expect(refundForm()).not.toBeInTheDocument();
    unmount();
    render(<AdminBookingDetailPage booking={{ ...DEPOSIT, orderStatus: 'pending' }} />);
    expect(refundForm()).not.toBeInTheDocument();
  });

  it('메일 실패 안내가 예약 확정·취소가 아니라 입금 확인·환불 안내 메일을 말한다', () => {
    render(<AdminBookingDetailPage booking={{ ...DEPOSIT, notificationError: 'API_ERROR' }} />);
    expect(screen.getByText(/입금 확인 또는 환불 안내 메일을 받지 못했을 수 있습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/예약 확정 또는 취소 메일/)).not.toBeInTheDocument();
  });
});
