import type { AvailabilityBlock, Booking, Order, Payment, Refund } from '../../db/schema';
import { getProduct } from './products';

const iso = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null);

export interface AdminBookingListItem {
  /** 주문 id — 관리자 상세 페이지·API가 이 값으로 예약을 찾는다(고객 manageToken과 무관). */
  id: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  productId: string;
  productName: string;
  serviceType: string;
  startAt: string | null;
  endAt: string | null;
  durationHours: number | null;
  itemAmount: number;
  vatAmount: number;
  totalAmount: number;
  orderStatus: Order['status'];
  bookingId: string | null;
  bookingStatus: Booking['status'] | null;
  notificationError: string | null;
  gcalError: string | null;
  /** 이 주문에 기록된 결제 건수. 0인데 주문이 paid거나, 있는데 주문이 미결제면 미정합이다. */
  paymentCount: number;
  /**
   * 최신 결제의 paymentKey 앞 8자.
   *
   * 토스 콘솔에서 같은 결제를 찾는 데 이만큼이면 충분하다. 전체 키는 취소 API의 인자라
   * 화면·목록 응답에 통째로 싣지 않는다(manageToken 제외 원칙과 같은 이유).
   */
  latestPaymentKeyPrefix: string | null;
  /**
   * 주문 상태와 결제 기록이 어긋난 건 (스펙 §10 미정합 주문 목록).
   *
   * 두 방향을 잡는다. (1) 주문은 미결제(pending·failed·expired)인데 payments 행이 있다 —
   * 돈은 들어왔는데 확정 기록이 실패했거나 승인 뒤 상태 전이가 끊긴 경우. (2) 예약은
   * confirmed인데 주문이 failed — 예약만 살아 있고 결제는 실패로 남은 경우.
   * 어느 쪽이든 관리자가 토스 콘솔과 대조해야 한다.
   */
  mismatch: boolean;
  createdAt: string;
}

const UNPAID_ORDER_STATUSES: ReadonlySet<Order['status']> = new Set(['pending', 'failed', 'expired']);

/**
 * 예약 한 건(주문+세션)을 관리자 화면용으로 편다.
 *
 * manageToken은 고객이 셀프 취소·확인에 쓰는 인증 토큰이라 여기서도, 상세 직렬화에서도
 * 절대 넣지 않는다 — 관리자는 order.id로 접근하지 고객 링크를 대신 쓸 이유가 없다
 * (lib/contracts/serialize.ts의 signToken 제외 원칙과 동일).
 *
 * 결제 실패로 슬롯 선점에 실패한 주문은 bookings가 빈 배열일 수 있다
 * (lib/booking/service.ts createBookingOrder — order INSERT 후 booking INSERT가
 * NOT EXISTS 겹침 검사에 걸리면 order만 남고 booking은 생기지 않는다).
 */
export const serializeBookingForAdmin = (
  order: Order & { bookings: Booking[]; payments: Payment[] },
): AdminBookingListItem => {
  const booking = order.bookings[0];
  const product = booking ? getProduct(booking.productId) : undefined;
  const latestPayment = order.payments
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    productId: booking?.productId ?? '',
    productName: product?.nameKo ?? booking?.serviceType ?? '-',
    serviceType: booking?.serviceType ?? '',
    startAt: booking ? booking.startAt.toISOString() : null,
    endAt: booking ? booking.endAt.toISOString() : null,
    durationHours: booking?.durationHours ?? null,
    itemAmount: order.itemAmount,
    vatAmount: order.vatAmount,
    totalAmount: order.totalAmount,
    orderStatus: order.status,
    bookingId: booking?.id ?? null,
    bookingStatus: booking?.status ?? null,
    notificationError: order.notificationError,
    gcalError: booking?.gcalError ?? null,
    paymentCount: order.payments.length,
    latestPaymentKeyPrefix: latestPayment ? latestPayment.paymentKey.slice(0, 8) : null,
    mismatch:
      (UNPAID_ORDER_STATUSES.has(order.status) && order.payments.length > 0) ||
      (booking?.status === 'confirmed' && order.status === 'failed'),
    createdAt: order.createdAt.toISOString(),
  };
};

export interface AdminRefundItem {
  id: string;
  amount: number;
  reason: string;
  requestedBy: Refund['requestedBy'];
  status: Refund['status'];
  tossTransactionKey: string | null;
  createdAt: string;
}

export interface AdminBookingDetail extends AdminBookingListItem {
  customerNote: string | null;
  cancelledAt: string | null;
  payment: {
    id: string;
    method: string | null;
    approvedAt: string | null;
    receiptUrl: string | null;
  } | null;
  /** 최신순. Phase 1은 예약당 최대 1건이지만(취소는 confirmed에서만 가능) 실패 이력까지 보여준다. */
  refunds: AdminRefundItem[];
}

export const serializeBookingDetailForAdmin = (
  order: Order & { bookings: Booking[]; payments: (Payment & { refunds: Refund[] })[] },
): AdminBookingDetail => {
  const base = serializeBookingForAdmin(order);
  const booking = order.bookings[0];
  const payment = order.payments[0];

  return {
    ...base,
    customerNote: booking?.customerNote ?? null,
    cancelledAt: iso(booking?.cancelledAt),
    payment: payment
      ? {
          id: payment.id,
          method: payment.method,
          approvedAt: iso(payment.approvedAt),
          receiptUrl: payment.receiptUrl,
        }
      : null,
    refunds: (payment?.refunds ?? [])
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((refund) => ({
        id: refund.id,
        amount: refund.amount,
        reason: refund.reason,
        requestedBy: refund.requestedBy,
        status: refund.status,
        tossTransactionKey: refund.tossTransactionKey,
        createdAt: refund.createdAt.toISOString(),
      })),
  };
};

export interface AdminBlockItem {
  id: string;
  startAt: string;
  endAt: string;
  memo: string | null;
  createdAt: string;
}

export const serializeBlockForAdmin = (block: AvailabilityBlock): AdminBlockItem => ({
  id: block.id,
  startAt: block.startAt.toISOString(),
  endAt: block.endAt.toISOString(),
  memo: block.memo,
  createdAt: block.createdAt.toISOString(),
});
