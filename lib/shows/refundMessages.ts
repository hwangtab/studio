/**
 * refundShowTickets의 거절 사유(reason) → 고객에게 보여 줄 문구.
 * 토스 원문 메시지는 화면에 내보내지 않는다(우리 레이아웃 안에 외부 문장이 뜨는 경로를 만들지 않는다).
 */
export const SHOW_REFUND_REJECT_MESSAGES: Record<string, string> = {
  no_tickets: '환불할 티켓을 선택해 주세요.',
  not_found: '주문을 찾을 수 없습니다.',
  invalid_order_status: '결제가 완료된 주문만 환불할 수 있습니다.',
  ticket_not_found: '선택하신 티켓을 찾을 수 없습니다. 페이지를 새로고침해 주세요.',
  checked_in: '이미 입장 처리된 티켓은 환불할 수 없습니다.',
  not_issued: '이미 환불되었거나 환불할 수 없는 상태의 티켓이 포함되어 있습니다.',
  after_showtime_start: '공연이 시작된 뒤에는 환불할 수 없습니다.',
  zero_amount: '환불 가능한 금액이 없습니다.',
  no_payment: '결제 내역을 확인하지 못했습니다. 문의 010-4255-7893',
  exceeds_remaining: '환불 가능한 잔액을 넘습니다. 문의 010-4255-7893',
  concurrent_change: '다른 처리가 진행 중입니다. 잠시 후 새로고침해 다시 시도해 주세요.',
  toss_failed: '결제사에서 환불을 처리하지 못했습니다. 잠시 후 다시 시도하거나 문의해 주세요. 문의 010-4255-7893',
  comp_ticket: '초대권은 환불 대상이 아닙니다.',
  toss_unknown: '환불 결과를 아직 확인하지 못했습니다. 중복 환불은 일어나지 않으니, 잠시 뒤 새로고침해 상태를 확인해 주세요. 계속 반영되지 않으면 문의 010-4255-7893',
  refund_account_invalid: '환불받을 은행·계좌번호·예금주를 확인해 주세요.',
  refund_account_unavailable: '지금은 환불 계좌를 접수할 수 없습니다. 잠시 후 다시 시도하거나 문의해 주세요. 문의 010-4255-7893',
  default: '환불을 처리하지 못했습니다. 문의 010-4255-7893',
};
