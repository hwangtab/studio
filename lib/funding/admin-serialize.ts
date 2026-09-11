import { isRefundPendingStatus } from './policy';
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
  /**
   * 후원자가 셀프 취소를 요청했는데 **아직 돈이 안 나간** 상태. 무통장은 자동 환불이
   * 불가능해 orders.status가 paid로 남으므로, 목록 상태 칸만 보면 정상 확정 건과
   * 구분되지 않는다. 환불이 끝나면(refunded) 꺼져야 한다 — cancel.ts는 환불 시
   * refundRequestedAt을 지우지 않으므로, 시각만 보면 첫 환불 이후 영구히 켜진다.
   */
  refundRequested: boolean;
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
    refundRequested: Boolean(p.refundRequestedAt) && isRefundPendingStatus(o.status),
  };
};
