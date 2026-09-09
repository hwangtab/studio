import type { Order, Payment, Refund } from '../../db/schema';
import { serializeBookingDetailForAdmin, serializeBookingForAdmin } from './admin-serialize';

const T = (iso: string) => new Date(iso);

const payment = (over: Partial<Payment & { refunds: Refund[] }> = {}) =>
  ({
    id: 'p1', orderId: 'o1', paymentKey: 'OLDKEY01aaaa', method: '카드',
    approvedAt: T('2026-09-01T00:00:00Z'), receiptUrl: 'https://receipt/old', rawResponse: null,
    createdAt: T('2026-09-01T00:00:00Z'), refunds: [],
    ...over,
  }) as Payment & { refunds: Refund[] };

const refund = (over: Partial<Refund> = {}) =>
  ({
    id: 'r1', paymentId: 'p1', amount: 1000, reason: '테스트', requestedBy: 'admin',
    tossTransactionKey: null, status: 'done', createdAt: T('2026-09-01T00:00:00Z'),
    ...over,
  }) as Refund;

const order = (payments: (Payment & { refunds: Refund[] })[]) =>
  ({
    id: 'o1', orderNo: 'SNB-1', type: 'session', customerName: '김보컬',
    customerPhone: '010-1234-5678', customerEmail: 'a@b.c',
    itemAmount: 250000, vatAmount: 25000, totalAmount: 275000, status: 'paid',
    manageToken: 't', notificationError: null,
    createdAt: T('2026-09-01T00:00:00Z'), updatedAt: T('2026-09-01T00:00:00Z'),
    bookings: [], workOrders: [], payments,
  }) as unknown as Order & {
    bookings: never[];
    payments: (Payment & { refunds: Refund[] })[];
    workOrders: never[];
  };

// M-3: 목록은 createdAt 최신 결제를, 상세는 payments[0](관계 로딩 순서에 좌우되는 임의의 행)을
// 쓰고 있었다. payments가 2건 이상인 주문에서 두 화면이 서로 다른 결제를 가리켰다.
describe('관리자 직렬화 — 목록과 상세가 같은 결제를 고른다', () => {
  const older = payment();
  const newer = payment({
    id: 'p2', paymentKey: 'NEWKEY02bbbb', method: '간편결제', receiptUrl: 'https://receipt/new',
    approvedAt: T('2026-09-05T00:00:00Z'), createdAt: T('2026-09-05T00:00:00Z'),
    refunds: [refund({ id: 'r2', paymentId: 'p2', amount: 50000 })],
  });

  it('배열 순서가 오래된 결제 우선이어도 상세는 최신 결제를 쓴다', () => {
    const detail = serializeBookingDetailForAdmin(order([older, newer]));
    expect(detail.payment).toMatchObject({ id: 'p2', method: '간편결제', receiptUrl: 'https://receipt/new' });
    expect(detail.refunds.map((r) => r.id)).toEqual(['r2']);
  });

  it('목록의 latestPaymentKeyPrefix와 상세의 payment가 같은 행을 가리킨다', () => {
    const rows = order([older, newer]);
    const list = serializeBookingForAdmin(rows);
    const detail = serializeBookingDetailForAdmin(rows);
    expect(list.latestPaymentKeyPrefix).toBe('NEWKEY02');
    expect(detail.payment?.id).toBe('p2');
  });

  it('결제가 없으면 둘 다 null', () => {
    const rows = order([]);
    expect(serializeBookingForAdmin(rows).latestPaymentKeyPrefix).toBeNull();
    expect(serializeBookingDetailForAdmin(rows).payment).toBeNull();
  });
});
