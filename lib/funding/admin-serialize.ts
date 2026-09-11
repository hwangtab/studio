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
   * 확인이 끝나면 clear_stock_review가 해제 표식을 덧붙여 꺼진다 — 해제 경로가 없는
   * 경고는 경보 피로로 첫 사용 직후 죽는다.
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

/**
 * 운영자가 재고를 확인하고 닫았음을 뜻하는 표식(clear_stock_review 액션이 적는다).
 *
 * 해제 경로가 없는 경고는 첫 사용 직후 죽는다 — 이 저장소가 이미 겪은 형태다
 * (refundRequestedAt에 지우는 코드가 하나도 없어 배너가 영구히 켜져 있던 사고,
 * 그 대응이 clear_refund_request다). 같은 짝을 needsReview에도 둔다.
 */
export const REVIEW_CLEARED_MARKER = '재고 확인 완료';

/**
 * 경고 줄의 접두 — confirm.ts(웹훅 확정 경로)가 adminMemo에 쓰는 태그.
 * 여기에 없는 접두로 남긴 메모는 경고로 세지 않는다.
 */
export const REVIEW_MEMO_PREFIXES = ['[웹훅]', '[지연승인]'] as const;

/**
 * 한 줄이 **웹훅이 남긴 경고 항목**인가. 접두 + 마커 꼬리를 둘 다 본다.
 * 사람이 사유 안에서 마커 문구를 인용한 줄은 이 접두가 없으므로 걸리지 않는다.
 */
export const isReviewWarningLine = (line: string): boolean => {
  const t = line.trim();
  return REVIEW_MEMO_PREFIXES.some((prefix) => t.startsWith(prefix)) && t.endsWith(REVIEW_MEMO_MARKER);
};

/**
 * 한 줄이 **해제 항목**인가. clear_stock_review가 쓰는 `[YYYY-MM-DD] 재고 확인 완료 — 사유`.
 * 패턴을 상수에서 조립해 표식만 바꿔도 어긋나지 않게 한다(REVIEW_CLEARED_MARKER에는
 * 정규식 메타문자가 없다 — 바꿀 때 이 전제를 함께 볼 것).
 */
const CLEARED_LINE_PATTERN = new RegExp(`^\\[\\d{4}-\\d{2}-\\d{2}\\]\\s*${REVIEW_CLEARED_MARKER}`);
export const isReviewClearedLine = (line: string): boolean => CLEARED_LINE_PATTERN.test(line.trim());

/**
 * adminMemo는 append로 쌓인다. **마지막 경고 줄이 마지막 해제 줄보다 뒤에 있을 때만** 켠다.
 *
 * 순서를 보는 이유: 이미 한 번 닫은 건을 웹훅이 다시 되살려 확정하면(만료 후 재승인은 두 번
 * 날 수 있다) 새 경고가 해제 기록보다 뒤에 붙는다. 그때 신호가 다시 켜져야 한다.
 *
 * **문자열 위치가 아니라 줄 단위로 보는 이유**: 화면 배너가 "관리자 메모에 웹훅이 남긴
 * 원문이 있습니다"라고 안내하므로, 운영자가 해제 사유에 그 원문을 인용하는 것은 실제로
 * 나올 법한 입력이다. lastIndexOf로 보면 **방금 쓴 해제 항목 안의 인용**이 마커의 마지막
 * 등장 위치가 되고 해제 표식은 그보다 앞이라, 해제가 무효가 되어 영구 점등한다 — 이 장치가
 * 막으려던 실패 모드가 그대로 재현된다. 줄로 나누면 그 줄은 접두로 이미 해제 항목이라,
 * 안에 무엇이 들어 있든 판정에 영향이 없다.
 */
export const hasReviewMarker = (adminMemo: string | null | undefined): boolean => {
  if (typeof adminMemo !== 'string') return false;
  let lastWarning = -1;
  let lastCleared = -1;
  adminMemo.split('\n').forEach((line, index) => {
    if (isReviewWarningLine(line)) lastWarning = index;
    else if (isReviewClearedLine(line)) lastCleared = index;
  });
  return lastWarning > lastCleared;
};

export const serializePledgeForAdmin = (o: FundingOrder): AdminPledgeItem => {
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
    refundRequested: Boolean(p.refundRequestedAt) && isRefundPendingStatus(o.status),
    needsReview: hasReviewMarker(p.adminMemo),
  };
};
