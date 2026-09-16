import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import BookingWizard from './BookingWizard';
import MixingOrderWizard from './MixingOrderWizard';
import type { SessionProduct } from '../../lib/booking/products';

/**
 * 위젯을 **붙일 자리가 화면에 있을 때만** 붙이는지 본다.
 *
 * 다른 테스트들은 `useTossPaymentWidgets`를 통째로 대역으로 세운다 — 그래서 "언제 붙느냐"는
 * 아예 검사되지 않았고, 실제로 그 자리에서 회귀가 났다. 위저드는 단계별로 화면을 갈아
 * 끼우는데 훅은 컴포넌트가 붙는 순간 한 번 돈다. 마운트 지점 div는 마지막 단계에만 있으므로,
 * 1단계에서 `renderPaymentMethods`를 부르면 **없는 선택자**를 받아 실패하고, 고객은 결제
 * 단계에 닿았을 때 "결제 모듈을 불러오지 못했습니다"만 본다.
 *
 * 그래서 여기서는 훅을 그대로 두고 **SDK만** 대역으로 세운다. 대역의 render 함수는 진짜
 * SDK처럼 **선택자가 실제 요소를 가리키는지 확인하고, 아니면 던진다.**
 */

const rendered: string[] = [];
const renderIntoSelector = jest.fn(async ({ selector }: { selector: string }) => {
  if (!document.querySelector(selector)) throw new Error(`선택자에 해당하는 요소가 없습니다: ${selector}`);
  rendered.push(selector);
});

jest.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: jest.fn(async () => ({
    widgets: () => ({
      setAmount: jest.fn().mockResolvedValue(undefined),
      renderPaymentMethods: renderIntoSelector,
      renderAgreement: renderIntoSelector,
      requestPayment: jest.fn().mockResolvedValue(undefined),
    }),
  })),
}));

const PRODUCT: SessionProduct = {
  id: 'recording-pro', service: 'recording', nameKo: '보컬 녹음 1프로',
  kind: 'package', unitAmount: 250000, sessionHours: 3,
};

const slotsResponse = { ok: true, slots: [{ startHour: 10, available: true }] };

beforeEach(() => {
  rendered.length = 0;
  renderIntoSelector.mockClear();
  window.sessionStorage.clear();
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'test_gck_dummy';
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/bookings/slots')) return { ok: true, status: 200, json: async () => slotsResponse } as Response;
    return { ok: true, status: 201, json: async () => ({ ok: true }) } as Response;
  }) as unknown as typeof fetch;
});

describe('결제위젯은 붙일 자리가 생긴 뒤에 붙는다', () => {
  it('예약: 1단계에서는 붙이지 않고, 3단계에 닿으면 붙는다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);

    // 1단계 — 마운트 지점이 아직 없다. 여기서 부르면 실패한다.
    await waitFor(() => expect(screen.getByRole('button', { name: '다음: 날짜·시간 선택' })).toBeInTheDocument());
    expect(renderIntoSelector).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '다음: 날짜·시간 선택' }));
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-10-01' } });
    await user.click(await screen.findByRole('button', { name: '10:00' }));
    await user.click(screen.getByRole('button', { name: '다음: 예약자 정보' }));

    // 3단계 — 붙일 자리가 생겼다. 수단·약관 둘 다 붙고, 실패 안내가 뜨지 않는다.
    await waitFor(() => expect(rendered).toHaveLength(2));
    expect(screen.queryByText(/결제 모듈을 불러오지 못했습니다/)).toBeNull();
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });

  it('믹싱: 1단계에서는 붙이지 않고, 2단계에 닿으면 붙는다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);

    expect(renderIntoSelector).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '다음: 주문자 정보' }));

    await waitFor(() => expect(rendered).toHaveLength(2));
    expect(screen.queryByText(/결제 모듈을 불러오지 못했습니다/)).toBeNull();
    expect(screen.getByRole('button', { name: /결제하기/ })).not.toBeDisabled();
  });
});
