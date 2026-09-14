import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import TossPaymentWidget from './TossPaymentWidget';

/**
 * 결제 위젯은 예약 4단계에서만 마운트되는데, 그 경로를 검증하는 테스트가 없었다.
 * 4단계까지 가려면 실제 예약이 필요해 수동 확인 외에는 회귀를 잡을 방법이 없었고,
 * 위젯을 next/dynamic으로 지연 로드하도록 바꾸면서 마운트 시점도 달라졌다.
 * SDK만 대역으로 세우고 마운트·실패·재시도·결제 요청 인자를 여기서 고정한다.
 */

const setAmount = jest.fn();
const renderPaymentMethods = jest.fn();
const renderAgreement = jest.fn();
const requestPayment = jest.fn();
const widgets = jest.fn();
const loadTossPayments = jest.fn();

jest.mock('@tosspayments/tosspayments-sdk', () => ({
  ANONYMOUS: 'ANONYMOUS',
  loadTossPayments: (...args: unknown[]) => loadTossPayments(...args),
}));

const PROPS = {
  orderNo: 'SNB-20260904-ABCD1234',
  amount: 250000,
  orderName: '보컬 녹음 1프로 (9/10 14:00)',
  customerName: '황경하',
  customerEmail: 'hwangtab@gmail.com',
  service: 'recording',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = 'test_ck_dummy';
  widgets.mockReturnValue({ setAmount, renderPaymentMethods, renderAgreement, requestPayment });
  loadTossPayments.mockResolvedValue({ widgets });
});

describe('TossPaymentWidget', () => {
  it('위젯을 마운트하면 금액을 KRW로 세팅하고 결제수단·약관을 각자 컨테이너에 렌더한다', async () => {
    render(<TossPaymentWidget {...PROPS} />);

    await waitFor(() => expect(setAmount).toHaveBeenCalledWith({ currency: 'KRW', value: 250000 }));
    expect(loadTossPayments).toHaveBeenCalledWith('test_ck_dummy');
    expect(widgets).toHaveBeenCalledWith({ customerKey: 'ANONYMOUS' });
    // 셀렉터는 인스턴스마다 달라지므로 접두사와 "그 노드가 실제로 있다"만 고정한다.
    const methodsSelector = renderPaymentMethods.mock.calls[0][0].selector as string;
    const agreementSelector = renderAgreement.mock.calls[0][0].selector as string;
    expect(methodsSelector).toMatch(/^#toss-payment-methods-[a-zA-Z0-9_-]+$/);
    expect(agreementSelector).toMatch(/^#toss-agreement-[a-zA-Z0-9_-]+$/);
    expect(document.querySelector(methodsSelector)).not.toBeNull();
    expect(document.querySelector(agreementSelector)).not.toBeNull();
  });

  /**
   * 펀딩 리워드 모달은 열고 닫으며 위젯을 여러 번 만든다. 마운트 지점이 전역 고정 id면
   * 두 인스턴스가 같은 노드를 두고 부딪혀, 나중 것이 빈 채로 뜨거나 iframe이 겹친다.
   */
  it('인스턴스마다 마운트 지점 id가 다르다', async () => {
    const { unmount } = render(<TossPaymentWidget {...PROPS} />);
    await waitFor(() => expect(renderPaymentMethods).toHaveBeenCalledTimes(1));
    unmount();

    render(<TossPaymentWidget {...PROPS} />);
    await waitFor(() => expect(renderPaymentMethods).toHaveBeenCalledTimes(2));

    const first = renderPaymentMethods.mock.calls[0][0].selector as string;
    const second = renderPaymentMethods.mock.calls[1][0].selector as string;
    expect(second).not.toBe(first);
  });

  it('언마운트하면 위젯이 심은 노드를 비운다', async () => {
    const { unmount } = render(<TossPaymentWidget {...PROPS} />);
    await waitFor(() => expect(renderPaymentMethods).toHaveBeenCalledTimes(1));

    const selector = renderPaymentMethods.mock.calls[0][0].selector as string;
    const container = document.querySelector(selector);
    expect(container).not.toBeNull();
    // SDK 대역은 iframe을 안 심으므로, 실제 SDK가 하는 일을 흉내 내 둔다.
    container!.innerHTML = '<iframe title="toss"></iframe>';

    unmount();
    expect(container!.innerHTML).toBe('');
  });

  it('위젯이 준비되기 전에는 결제 버튼을 누를 수 없다', async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    loadTossPayments.mockReturnValue(new Promise((res) => { resolveLoad = res; }));

    render(<TossPaymentWidget {...PROPS} />);
    expect(screen.getByRole('button', { name: '결제하기' })).toBeDisabled();

    resolveLoad({ widgets });
    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());
  });

  it('결제 요청은 서버가 발급한 주문번호를 그대로 넘긴다', async () => {
    render(<TossPaymentWidget {...PROPS} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: '결제하기' }));

    expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'SNB-20260904-ABCD1234',
      orderName: PROPS.orderName,
      customerName: PROPS.customerName,
      customerEmail: PROPS.customerEmail,
    }));
  });

  // service를 안 실으면 결제 실패 화면이 상품과 무관하게 녹음 예약으로 되돌아간다.
  it('결제 실패 URL은 어느 상품이었는지를 잃지 않는다', async () => {
    render(<TossPaymentWidget {...PROPS} service="wedding-song" />);
    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: '결제하기' }));

    expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({
      failUrl: expect.stringContaining('service=wedding-song'),
    }));
  });

  it('클라이언트 키가 없으면 결제창을 열지 않고 오류를 알린다', async () => {
    delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;

    render(<TossPaymentWidget {...PROPS} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 설정이 없습니다.');
    expect(loadTossPayments).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '결제하기' })).not.toBeInTheDocument();
  });

  // retryKey가 있는 이유 그대로 — amount가 그대로라 effect 의존성만으로는 재시도가 안 걸린다.
  it('로드에 실패해도 "다시 시도"가 같은 금액으로 재로드한다', async () => {
    loadTossPayments.mockRejectedValueOnce(new Error('네트워크 오류'));

    render(<TossPaymentWidget {...PROPS} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 오류');

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());
    expect(loadTossPayments).toHaveBeenCalledTimes(2);
    expect(setAmount).toHaveBeenCalledWith({ currency: 'KRW', value: 250000 });
  });

  it('successUrl/failUrl prop이 있으면 그대로 requestPayment에 싣는다', async () => {
    render(<TossPaymentWidget {...PROPS} orderNo="FND-1" amount={5000} orderName="[펀딩] 데모 · 감사 메일"
      successUrl="/ko/funding/success" failUrl="/ko/funding/fail?orderNo=FND-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());

    await userEvent.click(screen.getByRole('button', { name: '결제하기' }));

    expect(requestPayment).toHaveBeenCalledWith(expect.objectContaining({
      successUrl: `${window.location.origin}/ko/funding/success`,
      failUrl: `${window.location.origin}/ko/funding/fail?orderNo=FND-1`,
    }));
  });

  it('사용자가 결제창을 닫아도 예외가 새어 나가지 않는다', async () => {
    requestPayment.mockRejectedValue(new Error('USER_CANCEL'));

    render(<TossPaymentWidget {...PROPS} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled());

    await expect(
      userEvent.click(screen.getByRole('button', { name: '결제하기' })),
    ).resolves.not.toThrow();
  });
});
