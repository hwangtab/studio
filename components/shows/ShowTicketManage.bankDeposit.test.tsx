import { fireEvent, render, screen } from '@testing-library/react';

import type { ManageOrderView } from '../../lib/shows/queries';
import ShowTicketManage from './ShowTicketManage';

const base: ManageOrderView = {
  orderNo: 'TKT-1', orderStatus: 'paid', totalAmount: 20000, buyerName: '이관객', showTitle: '공연', showSlug: 's',
  venueName: '극장', venueAddress: '주소', showtimeLabel: '10.24(토) 18:30', showtimeStartsAt: 2000000000, showtimeStatus: 'scheduled',
  refundPctNow: 100,
  tickets: [{ id: 't1', code: 'C1', entryNumber: 1, status: 'issued', ticketTypeName: '일반', unitAmount: 10000, checkedIn: false, isComp: false, refundAmountNow: 10000 }],
  bankDeposit: null, depositGuide: null,
};

describe('내 티켓 — 계좌 입금', () => {
  it('입금 대기면 계좌 안내와 입금 전 신청 취소만 보이고 티켓·환불 칸은 없다', () => {
    render(<ShowTicketManage order={{
      ...base, orderStatus: 'awaiting_deposit', bankDeposit: 'awaiting',
      depositGuide: { amount: 20000, deadline: '2026-10-07T03:00:00.000Z', customerName: '이관객' },
      tickets: [{ ...base.tickets[0], status: 'held', entryNumber: null, refundAmountNow: null }],
    }} token="tok" qr={{}} />);
    expect(screen.getByText('3333-12-5480849')).toBeTruthy();
    expect(screen.getByText(/예매하신 분 성함/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '입금 전 예매 신청 취소' })).toBeTruthy();
    expect(screen.queryByText(/환불 선택/)).toBeNull();
  });

  it('입금 확인된 주문은 티켓을 고르면 환불 계좌 칸이 나오고, 채우기 전에는 버튼이 닫혀 있다', () => {
    render(<ShowTicketManage order={{ ...base, bankDeposit: 'paid' }} token="tok" qr={{}} />);
    expect(screen.queryByText('환불받을 계좌')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('환불받을 계좌')).toBeTruthy();
    const button = screen.getByRole('button', { name: /1매 환불하기/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/은행/), { target: { value: '신한은행' } });
    fireEvent.change(screen.getByLabelText(/예금주/), { target: { value: '이관객' } });
    fireEvent.change(screen.getByLabelText(/계좌번호/), { target: { value: '110-222-333444' } });
    expect(button.disabled).toBe(false);
  });

  it('토스 주문은 환불 계좌를 묻지 않는다', () => {
    render(<ShowTicketManage order={base} token="tok" qr={{}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText('환불받을 계좌')).toBeNull();
  });
});
