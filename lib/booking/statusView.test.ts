import { statusViewOf } from './statusView';

const v = (orderStatus: string, bookingStatus: string | null = null, work: string | null = null) =>
  statusViewOf({ orderStatus, bookingStatus, workOrder: work ? { status: work } : null });

it('결제됐고 예약·작업이 살아 있으면 확정, 취소했으면 취소', () => {
  expect(v('paid', 'confirmed')).toBe('confirmed');
  expect(v('partially_refunded', 'confirmed')).toBe('confirmed');
  expect(v('paid', null, 'in_progress')).toBe('confirmed');
  expect(v('paid', 'cancelled')).toBe('cancelled');
  expect(v('paid', null, 'cancelled')).toBe('cancelled');
});

it('나머지 상태를 묶는다', () => {
  expect(v('pending')).toBe('awaiting');
  expect(v('awaiting_deposit')).toBe('awaiting');
  expect(v('auto_cancel_pending')).toBe('awaiting');
  expect(v('refunded')).toBe('cancelled');
  expect(v('deposit_cancelled')).toBe('cancelled');
  expect(v('failed')).toBe('failed');
  expect(v('expired')).toBe('failed');
});
