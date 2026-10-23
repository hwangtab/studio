/** 예약 목록 상태 보기 — 드롭다운 하나, 기본은 확정(운영자 지적 2026-10-23). 계좌 입금 대기는 "입금 대기" 알약이 말한다. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

let query: Record<string, string> = {};
jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings', pathname: '/admin/bookings', query }) }));
jest.mock('../../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminBookingsPage from '../../../../pages/admin/bookings/index';
import type { AdminBookingListItem } from '../../../../lib/booking/admin-serialize';

const row = (id: string, orderType: 'session' | 'mixing', orderStatus: AdminBookingListItem['orderStatus'], extra: Partial<AdminBookingListItem> = {}): AdminBookingListItem =>
  ({
    id, orderNo: `SNB-${id}`, orderType, customerName: `고객${id}`, customerPhone: '010-0000-0000', customerEmail: 'a@b.c',
    productId: orderType === 'mixing' ? 'mixing-level1' : 'recording-pro', productName: '상품', serviceType: orderType === 'mixing' ? 'mixing' : 'recording',
    roomNumber: null, startAt: null, endAt: null, durationHours: null, itemAmount: 100000, vatAmount: 10000, totalAmount: 110000,
    orderStatus, bookingId: null, bookingStatus: null, workOrder: null, notificationError: null, gcalError: null, gcalMissing: false,
    mismatch: false, createdAt: '2026-10-01T00:00:00.000Z', ...extra,
  }) as unknown as AdminBookingListItem;

const FUTURE_NEAR = new Date(Date.now() + 2 * 86400000).toISOString();
const FUTURE_FAR = new Date(Date.now() + 9 * 86400000).toISOString();
const PAST = new Date(Date.now() - 9 * 86400000).toISOString();

const BOOKINGS = [
  row('1', 'mixing', 'expired'),
  row('2', 'mixing', 'expired'),
  row('3', 'mixing', 'deposit_cancelled'),
  row('4', 'mixing', 'paid'),
  row('5', 'session', 'paid', { startAt: PAST, customerName: '지난손님' }),
  row('6', 'session', 'paid', { startAt: FUTURE_FAR, customerName: '먼손님' }),
  row('7', 'session', 'paid', { startAt: FUTURE_NEAR, customerName: '가까운손님' }),
  row('8', 'session', 'paid', { startAt: FUTURE_NEAR, bookingStatus: 'cancelled', customerName: '취소손님' }),
  row('9', 'session', 'awaiting_deposit', { customerName: '대기손님' }),
];
const statusGroup = () => within(screen.getByRole('group', { name: '상태' }));
const statusSelect = () => screen.getByRole('combobox', { name: '상태 보기' }) as HTMLSelectElement;
const optionTexts = () => Array.from(statusSelect().options).map((o) => o.textContent);
const customerCells = () => screen.getAllByText(/손님$/).map((el) => el.textContent?.replace(/010.*/, ''));

beforeEach(() => {
  query = { line: 'mixing' };
});

it('상태는 드롭다운 하나이고, 기본은 확정이다', () => {
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={0} />);
  expect(statusSelect().value).toBe('confirmed');
  expect(optionTexts()).toEqual(['확정 (1)', '결제·입금 대기 (0)', '취소·환불 (1)', '실패·만료 (2)', '전체 (4)']);
  // 상태 버튼은 더 없다.
  expect(within(screen.getByRole('group', { name: '상태' })).queryAllByRole('button')).toHaveLength(0);
  // 입금 대기가 0건이면 그 알약(링크)도 없다.
  expect(statusGroup().queryByRole('link', { name: /입금 대기/ })).not.toBeInTheDocument();
});

it('확정 보기는 앞으로 올 세션을 가까운 순으로 먼저, 취소된 예약은 빼고 보인다', () => {
  query = { line: 'studio' };
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={0} />);
  expect(customerCells()).toEqual(['가까운손님', '먼손님', '지난손님']);
  fireEvent.change(statusSelect(), { target: { value: 'cancelled' } });
  expect(customerCells()).toEqual(['취소손님']);
});

it('확정 보기에서 찾는 사람이 다른 상태에만 있으면 알려 주고 전체로 넘어간다', () => {
  query = { line: 'studio' };
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={0} />);
  fireEvent.change(screen.getByLabelText('예약 검색'), { target: { value: '대기손님' } });
  expect(screen.getByText(/다른 상태에 맞는 예약이 1건 더 있어요/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '전체에서 보기' }));
  expect(statusSelect().value).toBe('all');
  expect(customerCells()).toEqual(['대기손님']);
});

it('입금 대기가 있으면 보던 라인을 지킨 채 그 목록으로 가는 알약이 생기고, 그 목록은 전체 보기로 연다', () => {
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={2} />);
  expect(statusGroup().getByRole('link', { name: '입금 대기 (2)' })).toHaveAttribute('href', '/admin/bookings?line=mixing&deposit=pending');
});

it('대시보드 묶음(입금 대기)으로 들어오면 확정으로 거르지 않는다', () => {
  query = {};
  render(<AdminBookingsPage bookings={[row('9', 'session', 'awaiting_deposit', { customerName: '대기손님' })]} truncated={false} blocks={[]} depositPending depositPendingCount={1} />);
  expect(statusSelect().value).toBe('all');
  expect(customerCells()).toEqual(['대기손님']);
});
