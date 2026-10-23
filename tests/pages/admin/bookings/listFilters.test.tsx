/** 예약 목록 상태 알약 — 건수가 있는 상태만 보이고, 계좌 입금 대기는 "입금 대기" 알약 하나만 말한다(운영자 지적 2026-10-23). */
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

let query: Record<string, string> = {};
jest.mock('next/router', () => ({ useRouter: () => ({ replace: jest.fn(), asPath: '/admin/bookings', pathname: '/admin/bookings', query }) }));
jest.mock('../../../../components/admin/contractActions', () => ({ logoutAdmin: jest.fn() }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: jest.fn() }));

import AdminBookingsPage from '../../../../pages/admin/bookings/index';
import type { AdminBookingListItem } from '../../../../lib/booking/admin-serialize';

const row = (id: string, orderType: 'session' | 'mixing', orderStatus: AdminBookingListItem['orderStatus']): AdminBookingListItem =>
  ({
    id, orderNo: `SNB-${id}`, orderType, customerName: `고객${id}`, customerPhone: '010-0000-0000', customerEmail: 'a@b.c',
    productId: orderType === 'mixing' ? 'mixing-level1' : 'recording-pro', productName: '상품', serviceType: orderType === 'mixing' ? 'mixing' : 'recording',
    roomNumber: null, startAt: null, endAt: null, durationHours: null, itemAmount: 100000, vatAmount: 10000, totalAmount: 110000,
    orderStatus, bookingId: null, bookingStatus: null, workOrder: null, notificationError: null, gcalError: null, gcalMissing: false,
    mismatch: false, createdAt: '2026-10-01T00:00:00.000Z',
  }) as unknown as AdminBookingListItem;

const BOOKINGS = [row('1', 'mixing', 'expired'), row('2', 'mixing', 'expired'), row('3', 'mixing', 'deposit_cancelled'), row('4', 'session', 'paid')];
const statusGroup = () => within(screen.getByRole('group', { name: '상태' }));

beforeEach(() => {
  query = { line: 'mixing' };
});

it('0건인 상태 알약은 감추고 건수가 있는 것만 보인다', () => {
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={0} />);
  const labels = statusGroup().getAllByRole('button').map((b) => b.textContent);
  expect(labels).toEqual(['전체 (3)', '만료 (2)', '입금 전 취소 (1)']);
  // 입금 대기가 없으면 그 알약도 없다 — 계좌 입금 대기 상태 알약과 둘이 겹치지 않는다.
  expect(statusGroup().queryByText(/입금 대기/)).not.toBeInTheDocument();
});

it('입금 대기가 있으면 보던 라인을 지킨 채 그 목록으로 가는 알약이 하나 생긴다', () => {
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={2} />);
  expect(statusGroup().getByRole('link', { name: '입금 대기 (2)' })).toHaveAttribute('href', '/admin/bookings?line=mixing&deposit=pending');
  expect(statusGroup().queryByText(/계좌 입금 대기/)).not.toBeInTheDocument();
});

it('고른 상태는 다시 누르면 풀리고, 고른 동안에는 건수가 0이 돼도 남는다', () => {
  render(<AdminBookingsPage bookings={BOOKINGS} truncated={false} blocks={[]} depositPendingCount={0} />);
  const expired = statusGroup().getByRole('button', { name: '만료 (2)' });
  fireEvent.click(expired);
  expect(expired).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(expired);
  expect(statusGroup().getByRole('button', { name: '전체 (3)' })).toHaveAttribute('aria-pressed', 'true');
});
