/**
 * 관리자 구독 화면 직렬화. Date는 getServerSideProps에 그대로 못 넘기므로 ISO 문자열로 바꾼다
 * (lib/contracts/serialize.ts·lib/booking/admin-serialize.ts와 같은 관례).
 */
import type { BillingKey, Contract, Subscription, SubscriptionPayment } from '../../db/schema';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export type SerializedSubscription = {
  [K in keyof Subscription]: Subscription[K] extends Date | null
    ? string | null
    : Subscription[K] extends Date
      ? string
      : Subscription[K];
};

export const serializeSubscription = (sub: Subscription): SerializedSubscription => ({
  ...sub,
  nextBillingAt: iso(sub.nextBillingAt),
  currentPeriodStart: iso(sub.currentPeriodStart),
  currentPeriodEnd: iso(sub.currentPeriodEnd),
  setupTokenExpiresAt: iso(sub.setupTokenExpiresAt),
  cancelledAt: iso(sub.cancelledAt),
  endsAt: iso(sub.endsAt),
  createdAt: sub.createdAt.toISOString(),
  updatedAt: sub.updatedAt.toISOString(),
});

export type SerializedBillingKey = {
  [K in keyof BillingKey]: BillingKey[K] extends Date | null
    ? string | null
    : BillingKey[K] extends Date
      ? string
      : BillingKey[K];
};

export const serializeBillingKey = (key: BillingKey): SerializedBillingKey => ({
  ...key,
  issuedAt: key.issuedAt.toISOString(),
  revokedAt: iso(key.revokedAt),
  createdAt: key.createdAt.toISOString(),
});

export type SerializedSubscriptionPayment = {
  [K in keyof SubscriptionPayment]: SubscriptionPayment[K] extends Date | null
    ? string | null
    : SubscriptionPayment[K] extends Date
      ? string
      : SubscriptionPayment[K];
};

export const serializeSubscriptionPayment = (p: SubscriptionPayment): SerializedSubscriptionPayment => ({
  ...p,
  attemptedAt: p.attemptedAt.toISOString(),
  paidAt: iso(p.paidAt),
  createdAt: p.createdAt.toISOString(),
});

export type SerializedSubscriptionContract = Pick<Contract, 'id' | 'title' | 'roomNumber' | 'status' | 'paymentDay'>;
