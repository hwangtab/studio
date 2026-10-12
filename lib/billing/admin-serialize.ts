/**
 * 관리자 구독 화면 직렬화. Date는 getServerSideProps에 그대로 못 넘기므로 ISO 문자열로 바꾼다
 * (lib/contracts/serialize.ts·lib/booking/admin-serialize.ts와 같은 관례).
 *
 * 자격증명은 뺀다 — Pages Router는 props를 __NEXT_DATA__로 페이지 HTML에 싣고, 관리자 API 응답도
 * 같은 함수를 거친다. 구독의 manageToken·setupToken·customerKey(고객 상시 토큰), 빌링키 행의
 * billingKey·rawResponse(토스 빌링키 원문, db/schema.ts "서버 밖으로 나가지 않는다")는 관리자 화면이
 * 쓰지 않으므로 여기서 떨어진다. 빌링키는 허용 목록 방식이라 컬럼이 늘어도 기본이 안전하다.
 */
import type { BillingKey, Contract, Subscription, SubscriptionPayment } from '../../db/schema';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

type SubscriptionSecret = 'manageToken' | 'setupToken' | 'customerKey';

export type SerializedSubscription = {
  [K in Exclude<keyof Subscription, SubscriptionSecret>]: Subscription[K] extends Date | null
    ? string | null
    : Subscription[K] extends Date
      ? string
      : Subscription[K];
};

export const serializeSubscription = (sub: Subscription): SerializedSubscription => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { manageToken, setupToken, customerKey, ...safe } = sub;
  return {
  ...safe,
  pausedUntil: iso(sub.pausedUntil),
  resumeNoticePendingAt: iso(sub.resumeNoticePendingAt),
  nextBillingAt: iso(sub.nextBillingAt),
  currentPeriodStart: iso(sub.currentPeriodStart),
  currentPeriodEnd: iso(sub.currentPeriodEnd),
  setupTokenExpiresAt: iso(sub.setupTokenExpiresAt),
  cancelledAt: iso(sub.cancelledAt),
  endsAt: iso(sub.endsAt),
  createdAt: sub.createdAt.toISOString(),
  updatedAt: sub.updatedAt.toISOString(),
  };
};

export type SerializedBillingKey = Pick<BillingKey, 'id' | 'subscriptionId' | 'cardCompany' | 'cardNumberMasked' | 'cardType'> & {
  issuedAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export const serializeBillingKey = (key: BillingKey): SerializedBillingKey => ({
  id: key.id,
  subscriptionId: key.subscriptionId,
  cardCompany: key.cardCompany,
  cardNumberMasked: key.cardNumberMasked,
  cardType: key.cardType,
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
