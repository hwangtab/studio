import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import ShopOrderForm from './ShopOrderForm';
import type { ShopProduct } from '../../data/shop/catalog';

/**
 * 상점 주문 폼의 "계좌로 직접 입금"(2026-10-14) — 목록에 줄이 있고, 고르면 토스를 부르지 않고 `paymentMethod: bank_transfer`로 신청해
 * 주문 확인(입금 안내) 화면으로 옮긴다. 토스 계좌이체(뱅크페이) 줄은 없다.
 */
const requestPayment = jest.fn().mockResolvedValue(undefined);
jest.mock('../payments/usePaymentCheckout', () => ({
  usePaymentCheckout: () => ({
    choice: 'card', setChoice: jest.fn(), applePaySupported: false, ready: true, error: null, requestPayment,
  }),
}));
jest.mock('../../utils/reportPaymentFailure', () => ({ reportPaymentWindowOpen: jest.fn(), reportPaymentFailure: jest.fn() }));

const digital: ShopProduct = {
  slug: 'test-digital', category: 'album', title: '디지털 앨범', description: ['소개'], images: [],
  skus: [{ id: 'db-aaaaaaaaaa', price: 10000 }], published: true, source: 'db', kind: 'digital',
};

const realLocation = window.location;
beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/ko/shop/test-digital');
  requestPayment.mockClear();
});
afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true });
});

const fill = async () => {
  await userEvent.type(screen.getByLabelText(/주문하시는 분/), '김구매');
  await userEvent.type(screen.getByLabelText(/휴대폰 번호/), '010-1234-5678');
  await userEvent.type(screen.getByLabelText(/^이메일/), 'buyer@example.com');
};

describe('ShopOrderForm — 계좌로 직접 입금', () => {
  it('계좌 줄이 있고 토스 계좌이체 줄은 없다 — 고르면 버튼이 "계좌 안내 받기"', async () => {
    render(<ShopOrderForm product={digital} others={[]} remaining={{ 'db-aaaaaaaaaa': 5 }} salesOpen />);
    expect(screen.queryByRole('radio', { name: '계좌이체' })).toBeNull();
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: '계좌로 직접 입금' }));
    expect(screen.getByRole('button', { name: /계좌 안내 받기/ })).toBeInTheDocument();
  });

  it('제출하면 bank_transfer로 신청하고 토스 없이 주문 확인 주소로 옮긴다', async () => {
    const assign = jest.fn();
    Object.defineProperty(window, 'location', { value: { ...realLocation, assign, search: '', origin: 'http://localhost' }, configurable: true });
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/shop/orders') {
        return { ok: true, status: 201, json: async () => ({ ok: true, orderNo: 'SHP-1', totalAmount: 10000, manageUrl: '/ko/shop/manage/SHP-1?token=t' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, remaining: { 'db-aaaaaaaaaa': 5 } }) } as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ShopOrderForm product={digital} others={[]} remaining={{ 'db-aaaaaaaaaa': 5 }} salesOpen />);
    await fill();
    await userEvent.click(screen.getByRole('radio', { name: '계좌로 직접 입금' }));
    await userEvent.click(screen.getByRole('button', { name: /계좌 안내 받기/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/ko/shop/manage/SHP-1?token=t'));
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/shop/orders') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body)).paymentMethod).toBe('bank_transfer');
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('실패 화면에서 ?bank=1로 돌아오면 계좌 줄이 골라진 채 열린다', async () => {
    window.history.replaceState({}, '', '/ko/shop/test-digital?bank=1');
    render(<ShopOrderForm product={digital} others={[]} remaining={{ 'db-aaaaaaaaaa': 5 }} salesOpen />);
    expect(await screen.findByRole('button', { name: /계좌 안내 받기/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '계좌로 직접 입금' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /신용·체크카드/ }));
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeInTheDocument();
  });
});
