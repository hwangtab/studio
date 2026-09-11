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
  /**
   * 웹훅이 만료·failed 주문을 되살려 확정한 건 — **재고를 초과했을 수 있어 사람이 봐야 한다.**
   * 판정 근거는 confirm.ts가 adminMemo에 남기는 표식뿐이다(REVIEW_MEMO_MARKER 참조).
   * 그 흔적이 관리자 목록 어디에도 안 보여서, 로그에만 남고 아무도 확인하지 않았다.
   */
  needsReview: boolean;
}

/**
 * confirm.ts(웹훅 확정 경로)가 '재고 초과 가능' 건의 adminMemo에 덧붙이는 표식.
 *
 * 현재 main의 lib/funding/confirm.ts가 쓰는 두 문구
 *   '[웹훅] 홀드 만료 후 승인 — 재고 초과 가능, 확인 필요'
 *   '[웹훅] failed 처리 후 승인 확인 — 재고 초과 가능, 확인 필요'
 * 의 공통 꼬리다. 여기 두는 이유는 policy.ts가 이 작업의 소유 파일이 아니기 때문이고,
 * 꼬리만 보는 이유는 앞부분(전이 사유)이 경로마다 다르기 때문이다. confirm.ts가 문구를
 * 바꾸면 이 상수도 함께 움직여야 한다 — 어긋나면 배지가 조용히 꺼진다.
 */
export const REVIEW_MEMO_MARKER = '재고 초과 가능, 확인 필요';

/** adminMemo는 append로 쌓이므로 포함 여부로 본다(마지막 줄만 보면 이후 메모에 묻힌다). */
export const hasReviewMarker = (adminMemo: string | null | undefined): boolean =>
  typeof adminMemo === 'string' && adminMemo.includes(REVIEW_MEMO_MARKER);

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
    needsReview: hasReviewMarker(p.adminMemo),
  };
};
