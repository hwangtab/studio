import { and, asc, gte, isNotNull, lt } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  payments,
  type Booking,
  type FundingPledge,
  type Order,
  type Subscription,
  type SubscriptionPayment,
  type WorkOrder,
} from '../../db/schema';
import { subscriptionOrderName, type SubscriptionKind } from '../billing/amounts';
import { formatKstDateTime, formatKstDateTimeFull } from '../booking/format';
import { getMixingProduct } from '../booking/mixing-products';
import { getProduct } from '../booking/products';

/**
 * 토스 결제 장부 — 기간 안에 승인된 결제 전부를 서비스 구분 없이 한 표로.
 *
 * 부가세 신고·정산 때 필요한 것은 "그 달에 카드로 들어온 돈과 되돌린 돈"이지 서비스별
 * 화면이 아니다. 예약·믹싱·후원·구독은 각자 관리 화면이 있지만 돈은 orders/payments/refunds
 * 한 곳에 모이므로(스키마 주석: "돈은 orders/payments/refunds가 SSOT") 여기서 한 번에 읽는다.
 *
 * 기준은 **결제 승인 시각**(payments.approvedAt)이다. 주문 생성 시각이 아니다 — 결제 대기로
 * 만료된 주문은 매출이 아니고, 승인이 웹훅으로 늦게 붙은 주문은 승인일이 매출일이다.
 * 승인 기록이 없는 돈(무통장 후원·수기 등록)은 여기 없다. 그건 펀딩 CSV가 싣는다.
 *
 * 환불은 **행을 나누지 않고** 같은 행의 refundedAmount에 합산한다. 기간 밖에서 환불된 것도
 * 합산된다 — 이 표는 "그 결제가 지금 얼마로 남았는가"를 보는 것이라, 기간 안 환불만 세면
 * 지난달 결제를 이번 달에 환불한 건이 어느 달에도 안 잡힌다. 환불 시각은 lastRefundAt에 남긴다.
 */
export const SALES_LEDGER_COLUMNS = [
  'approvedAt',
  'orderNo',
  'type',
  'description',
  'customerName',
  'customerPhone',
  'customerEmail',
  'method',
  'itemAmount',
  'vatAmount',
  'totalAmount',
  'refundedAmount',
  'netAmount',
  'orderStatus',
  'lastRefundAt',
] as const;

export type SalesLedgerRow = Record<(typeof SALES_LEDGER_COLUMNS)[number], string | number | null>;

const TYPE_LABELS: Record<string, string> = {
  session: '세션 예약',
  mixing: '믹싱·마스터링',
  funding: '펀딩',
  subscription: '구독',
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 'YYYY-MM-DD'(KST 달력) → 그날 0시 UTC Date. */
const kstMidnight = (date: string): Date => new Date(new Date(`${date}T00:00:00Z`).getTime() - KST_OFFSET_MS);

export const MAX_RANGE_DAYS = 366;

export type LedgerRange = { from: string; to: string };

/** 기간 검증 — 형식·순서·길이. 실패하면 사람이 읽는 문구를 돌려준다. */
export const validateLedgerRange = (range: LedgerRange): string | null => {
  if (!DATE_PATTERN.test(range.from) || !DATE_PATTERN.test(range.to)) return '날짜는 YYYY-MM-DD 형식이어야 합니다.';
  const from = kstMidnight(range.from);
  const to = kstMidnight(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return '날짜가 올바르지 않습니다.';
  if (to.getTime() < from.getTime()) return '종료일이 시작일보다 앞설 수 없습니다.';
  if ((to.getTime() - from.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS) return `한 번에 ${MAX_RANGE_DAYS}일까지만 내려받을 수 있습니다.`;
  return null;
};

export const listSalesLedgerRows = async (range: LedgerRange): Promise<SalesLedgerRow[]> => {
  const from = kstMidnight(range.from);
  const toExclusive = new Date(kstMidnight(range.to).getTime() + DAY_MS);

  const rows = await getDb().query.payments.findMany({
    where: and(isNotNull(payments.approvedAt), gte(payments.approvedAt, from), lt(payments.approvedAt, toExclusive)),
    with: {
      refunds: true,
      order: {
        with: {
          bookings: true,
          workOrders: true,
          fundingPledge: true,
          subscriptionPayment: { with: { subscription: true } },
        },
      },
    },
    orderBy: [asc(payments.approvedAt)],
  });

  return rows.map((payment) => {
    const order = payment.order;
    const done = payment.refunds.filter((r) => r.status === 'done');
    const refundedAmount = done.reduce((sum, r) => sum + r.amount, 0);
    const lastRefund = done.reduce<Date | null>(
      (latest, r) => (latest === null || r.createdAt.getTime() > latest.getTime() ? r.createdAt : latest),
      null,
    );
    return {
      approvedAt: formatKstDateTimeFull(payment.approvedAt?.toISOString() ?? null),
      orderNo: order.orderNo,
      type: TYPE_LABELS[order.type] ?? order.type,
      description: describeOrder(order),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      method: payment.method,
      itemAmount: order.itemAmount,
      vatAmount: order.vatAmount,
      totalAmount: order.totalAmount,
      refundedAmount,
      netAmount: order.totalAmount - refundedAmount,
      orderStatus: order.status,
      lastRefundAt: lastRefund ? formatKstDateTimeFull(lastRefund.toISOString()) : null,
    };
  });
};

type LedgerOrder = Order & {
  bookings: Booking[];
  workOrders: WorkOrder[];
  fundingPledge: FundingPledge | null;
  subscriptionPayment: (SubscriptionPayment & { subscription: Subscription | null }) | null;
};

const describeOrder = (order: LedgerOrder): string => {
  switch (order.type) {
    case 'session': {
      const booking = order.bookings[0];
      if (!booking) return '세션 예약';
      const name = getProduct(booking.productId)?.nameKo ?? booking.productId;
      return `${name} · ${formatKstDateTime(booking.startAt.toISOString())}`;
    }
    case 'mixing': {
      const work = order.workOrders[0];
      if (!work) return '믹싱·마스터링';
      const name = getMixingProduct(work.productId)?.nameKo ?? work.productId;
      return `${name} ${work.songCount}곡${work.vocalTuning ? ' + 보컬 튜닝' : ''}`;
    }
    case 'funding': {
      const pledge = order.fundingPledge;
      if (!pledge) return '펀딩';
      return `${pledge.projectSlug} · ${pledge.rewardTitle} × ${pledge.quantity}`;
    }
    case 'subscription': {
      const cycle = order.subscriptionPayment;
      if (!cycle?.subscription) return '구독';
      return `${subscriptionOrderName(cycle.subscription.kind as SubscriptionKind)} ${cycle.cycleYm}`;
    }
    default:
      return order.type;
  }
};
