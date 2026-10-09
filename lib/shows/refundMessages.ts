/**
 * refundShowTickets의 거절 사유(reason) → 고객에게 보여 줄 문구.
 * 토스 원문 메시지는 화면에 내보내지 않는다(우리 레이아웃 안에 외부 문장이 뜨는 경로를 만들지 않는다).
 */
export const SHOW_REFUND_REJECT_MESSAGES: Record<string, string> = {
  no_tickets: '환불할 티켓을 선택해 주세요.',
  not_found: '주문을 찾을 수 없어요.',
  invalid_order_status: '결제가 완료된 주문만 환불할 수 있어요.',
  ticket_not_found: '선택하신 티켓을 찾을 수 없어요. 페이지를 새로고침해 주세요.',
  checked_in: '이미 입장 처리된 티켓은 환불할 수 없어요.',
  not_issued: '이미 환불되었거나 환불할 수 없는 상태의 티켓이 포함되어 있어요.',
  after_showtime_start: '공연이 시작된 뒤에는 환불할 수 없어요.',
  zero_amount: '환불 가능한 금액이 없어요.',
  no_payment: '결제 내역을 확인하지 못했어요. 문의 010-4255-7893',
  exceeds_remaining: '환불 가능한 잔액을 넘어요. 문의 010-4255-7893',
  concurrent_change: '다른 처리가 진행 중이에요. 잠시 후 새로고침해 다시 시도해 주세요.',
  toss_failed: '결제사에서 환불을 처리하지 못했어요. 잠시 후 다시 시도하거나 문의해 주세요. 문의 010-4255-7893',
  comp_ticket: '초대권은 환불 대상이 아니에요.',
  toss_unknown: '환불 결과를 아직 확인하지 못했어요. 중복 환불은 일어나지 않으니, 잠시 뒤 새로고침해 상태를 확인해 주세요. 계속 반영되지 않으면 문의 010-4255-7893',
  refund_account_invalid: '환불받을 은행·계좌번호·예금주를 확인해 주세요.',
  refund_account_unavailable: '지금은 환불 계좌를 접수할 수 없어요. 잠시 후 다시 시도하거나 문의해 주세요. 문의 010-4255-7893',
  default: '환불을 처리하지 못했어요. 문의 010-4255-7893',
};

/** 영어 화면(/en/shows)용 — 위 표와 같은 사유·같은 내용. 한쪽을 고치면 다른 쪽도 고친다. */
export const SHOW_REFUND_REJECT_MESSAGES_EN: Record<string, string> = {
  no_tickets: 'Please choose the tickets to refund.',
  not_found: 'We could not find this order.',
  invalid_order_status: 'Only paid orders can be refunded.',
  ticket_not_found: 'We could not find the selected tickets. Please refresh the page.',
  checked_in: 'Tickets that have already been checked in cannot be refunded.',
  not_issued: 'Your selection includes a ticket that is already refunded or cannot be refunded.',
  after_showtime_start: 'Tickets cannot be refunded after the show has started.',
  zero_amount: 'There is no refundable amount.',
  no_payment: 'We could not find the payment record. Contact: +82 10-4255-7893',
  exceeds_remaining: 'This is more than the refundable balance. Contact: +82 10-4255-7893',
  concurrent_change: 'Another change is in progress. Please refresh in a moment and try again.',
  toss_failed: 'The payment provider could not process the refund. Please try again later or contact us: +82 10-4255-7893',
  comp_ticket: 'Complimentary tickets cannot be refunded.',
  toss_unknown: 'We have not been able to confirm the refund result yet. You will not be refunded twice — please refresh in a moment to check. If nothing changes, contact us: +82 10-4255-7893',
  refund_account_invalid: 'Please check the bank, account number and account holder.',
  refund_account_unavailable: 'We cannot accept a refund account right now. Please try again later or contact us: +82 10-4255-7893',
  // 계좌 입금 대기 신청 거두기(action: withdraw)
  withdraw_not_awaiting: 'This is not a request waiting for a transfer. Please refresh the page.',
  withdraw_failed: 'We could not cancel the request. Please refresh the page or contact us: +82 10-4255-7893',
  rate_limited: 'Too many requests. Please try again in a moment.',
  bad_request: 'The request is not in the expected format.',
  default: 'We could not process the refund. Contact: +82 10-4255-7893',
};
