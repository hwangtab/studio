import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { ManageOrderView } from '../../lib/shows/queries';
import ShowTicketManage from './ShowTicketManage';

const order: ManageOrderView = {
  orderNo: 'TKT-1', showSlug: 's', showTitle: '공연', showtimeLabel: '10.24(토) 18:30', showtimeStatus: 'scheduled',
  venueName: '장소', venueAddress: '주소', buyerName: '홍길동', totalAmount: 50000, orderStatus: 'paid',
  tickets: [
    { id: 't1', code: 'SNT1:A', entryNumber: 1, status: 'issued', ticketTypeName: '사전 예매', checkedIn: false, refundAmountNow: 25000 },
    { id: 't2', code: 'SNT1:B', entryNumber: 2, status: 'issued', ticketTypeName: '사전 예매', checkedIn: true, refundAmountNow: null },
  ],
} as ManageOrderView;

describe('ShowTicketManage — 환불 2단계', () => {
  it('티켓을 고르면 버튼에 매수·금액이 찍히고, 한 번 누르면 환불 API를 부른다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, refundAmount: 25000 }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(window, 'location', { value: { reload: jest.fn() }, writable: true });

    render(<ShowTicketManage order={order} token="tok" qr={{}} />);
    const button = screen.getByRole('button', { name: '환불할 티켓을 위에서 선택해 주세요' });
    expect(button).toBeDisabled();
    // 입장 완료 티켓에는 환불 체크가 없다.
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);

    fireEvent.click(screen.getByRole('checkbox'));
    const go = screen.getByRole('button', { name: '1매 환불하기 · 25,000원' });
    expect(go).toBeEnabled();
    fireEvent.click(go);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ orderNo: 'TKT-1', token: 'tok', ticketIds: ['t1'] });
    expect(await screen.findByRole('status')).toHaveTextContent('25,000원이 환불 처리되었습니다');
  });

  it('입장 번호와 상태 배지를 티켓 카드마다 보여 준다', () => {
    render(<ShowTicketManage order={order} token="tok" qr={{}} />);
    expect(screen.getByText('001')).toBeTruthy();
    expect(screen.getByText('입장 완료')).toBeTruthy();
    expect(screen.getByText('사용 가능')).toBeTruthy();
  });
});
