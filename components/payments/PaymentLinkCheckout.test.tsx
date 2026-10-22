import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import PaymentLinkCheckout from './PaymentLinkCheckout';

const requestPayment = jest.fn().mockResolvedValue(undefined);
jest.mock('./usePaymentCheckout', () => ({
  usePaymentCheckout: () => ({
    choice: 'card', setChoice: jest.fn(), applePaySupported: false, ready: true, error: null, requestPayment,
  }),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentFailure: jest.fn() }));

const orderPosts = () => (global.fetch as jest.Mock).mock.calls.filter((c) => c[0] === '/api/payment-links/order');

beforeEach(() => {
  requestPayment.mockClear();
  window.history.replaceState({}, '', '/ko/pay/test-slug');
  global.fetch = jest.fn(async () => ({
    ok: true, status: 201,
    json: async () => ({ ok: true, orderNo: 'SNP-TEST', totalAmount: 275000, orderName: '예약금' }),
  })) as unknown as typeof fetch;
});

/** 맞춤 결제 링크 폼 — 주문자 칸을 서버에 보내기 전에 칸별로 검사한다(2026-10-22). */
describe('PaymentLinkCheckout 주문자 칸 검사', () => {
  it('빈 값 → 주문을 만들지 않고 요약 + 이름 칸 포커스', async () => {
    const user = userEvent.setup();
    render(<PaymentLinkCheckout slug="test-slug" totalAmount={275000} />);
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(orderPosts()).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('아래 3개 항목을 확인해 주세요.');
    expect(screen.getByLabelText(/^이름/)).toHaveFocus();
  });

  it('이메일만 틀리면 그 칸만, 고치면 결제창을 연다', async () => {
    const user = userEvent.setup();
    render(<PaymentLinkCheckout slug="test-slug" totalAmount={275000} />);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰/), '010-1234-5678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(screen.getByLabelText(/^이메일/)).toHaveFocus();
    expect(screen.getByText(/이메일 주소를 확인해 주세요/)).toBeInTheDocument();
    expect(orderPosts()).toHaveLength(0);

    await user.type(screen.getByLabelText(/^이메일/), 'example.com');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'SNP-TEST', amount: 275000 })));
    expect(orderPosts()).toHaveLength(1);
  });

  it('지난 제출의 오류는 다시 누를 때 지운다', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<PaymentLinkCheckout slug="test-slug" totalAmount={275000} />);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰/), '010-1234-5678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(screen.getByText(/네트워크 오류/)).toBeInTheDocument());
    await user.clear(screen.getByLabelText(/^이름/));
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    expect(screen.queryByText(/네트워크 오류/)).toBeNull();
    expect(screen.getByText('이름을 입력해 주세요.')).toBeInTheDocument();
  });
});
