import type { FundingOrder } from './service';

export interface AdminPledgeItem {
  id: string;
  orderNo: string;
  projectSlug: string;
  status: string;
  paymentMethod: string;
  entrySource: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  rewardTitle: string;
  quantity: number;
  additionalAmount: number;
  totalAmount: number;
  fulfillmentStatus: string;
  trackingCompany: string | null;
  trackingNumber: string | null;
  shipping: string | null;
  supporterMessage: string | null;
  refundRequestedAt: string | null;
  paidAt: string | null;
  holdExpiresAt: string;
  createdAt: string;
  adminMemo: string | null;
  notificationError: string | null;
  hasPayment: boolean;
  mismatch: boolean;
  duplicateWarning: boolean;
}

/** 동명·동액 경고 키: pending 무통장 건끼리 이름+금액이 같으면 관리자가 입금 매칭을 헷갈린다. */
export const duplicateKey = (o: FundingOrder): string => `${o.customerName}:${o.totalAmount}`;

export const serializePledgeForAdmin = (o: FundingOrder, duplicateKeys: Set<string>): AdminPledgeItem => {
  const p = o.fundingPledge!;
  return {
    id: o.id,
    orderNo: o.orderNo,
    projectSlug: p.projectSlug,
    status: o.status,
    paymentMethod: p.paymentMethod,
    entrySource: p.entrySource,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    rewardTitle: p.rewardTitle,
    quantity: p.quantity,
    additionalAmount: p.additionalAmount,
    totalAmount: o.totalAmount,
    fulfillmentStatus: p.fulfillmentStatus,
    trackingCompany: p.trackingCompany,
    trackingNumber: p.trackingNumber,
    shipping: p.shippingAddress1
      ? `${p.shippingName} / ${p.shippingPhone} / (${p.shippingPostcode}) ${p.shippingAddress1} ${p.shippingAddress2 ?? ''} / ${p.shippingMemo ?? ''}`
      : null,
    supporterMessage: p.supporterMessage,
    refundRequestedAt: p.refundRequestedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    holdExpiresAt: p.holdExpiresAt.toISOString(),
    createdAt: o.createdAt.toISOString(),
    adminMemo: p.adminMemo,
    notificationError: o.notificationError,
    hasPayment: o.payments.length > 0,
    // 결제 기록이 있는데 상태가 "돈을 받은 상태"가 아니면 전부 미정합이다 — pending만 보면
    // expired·failed·refunded로 잘못 전이된 건(승인 경합 사고의 실제 흔적)이 안 잡힌다.
    mismatch: o.payments.length > 0 && !['paid', 'partially_refunded', 'refunded'].includes(o.status),
    duplicateWarning: o.status === 'pending' && p.paymentMethod === 'bank_transfer' && duplicateKeys.has(duplicateKey(o)),
  };
};
