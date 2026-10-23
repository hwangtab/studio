/**
 * 예약 목록의 상태 보기 — 주문 상태 아홉 가지를 알약으로 늘어놓던 것을 운영자가 실제로 묻는 다섯 묶음으로 줄여 드롭다운에 담는다
 * (운영자 지적 2026-10-23: "버튼보다 드롭다운, 진짜 궁금한 건 확정된 예약"). 기본은 확정이다. 이 모듈은 아무것도 import하지 않는다.
 */
export const STATUS_VIEWS = ['confirmed', 'awaiting', 'cancelled', 'failed', 'all'] as const;
export type StatusView = (typeof STATUS_VIEWS)[number];

export const STATUS_VIEW_LABELS: Record<StatusView, string> = {
  confirmed: '확정',
  awaiting: '결제·입금 대기',
  cancelled: '취소·환불',
  failed: '실패·만료',
  all: '전체',
};

/** 주문 하나가 어느 보기에 드는가. 결제는 됐어도 예약·작업을 취소했으면 확정이 아니라 취소다. */
export const statusViewOf = (b: {
  orderStatus: string;
  bookingStatus: string | null;
  workOrder: { status: string } | null;
}): Exclude<StatusView, 'all'> => {
  switch (b.orderStatus) {
    case 'paid':
    case 'partially_refunded':
      return b.bookingStatus === 'cancelled' || b.workOrder?.status === 'cancelled' ? 'cancelled' : 'confirmed';
    case 'pending':
    case 'awaiting_deposit':
    case 'auto_cancel_pending':
      return 'awaiting';
    case 'refunded':
    case 'deposit_cancelled':
      return 'cancelled';
    default:
      return 'failed';
  }
};
