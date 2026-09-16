import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import MixingOrderWizard from './MixingOrderWizard';
import { MIXING_CUSTOMER_DRAFT_KEY } from '../../lib/booking/customerDraft';

/**
 * BookingWizard.test.tsx와 같은 계약을 검증한다 — 이름·연락처·이메일·요청사항만
 * sessionStorage에 임시 저장하고, 동의 체크·상품·곡 수·튜닝 선택은 되살리지 않는다.
 * 키가 예약 쪽과 갈려 있다는 것도 여기서 함께 고정한다(customerNote의 뜻이 다르다 —
 * 예약은 요청사항, 믹싱은 파일 링크).
 */

/**
 * 결제위젯은 주문자 정보 폼 안에 떠 있고, 제출은 그 위젯의 `requestPayment`를 부른다.
 * 무엇을 어떤 금액으로 여는지가 이 화면의 계약이다.
 */
const requestPayment = jest.fn().mockResolvedValue(undefined);
const retryPayment = jest.fn();
let widgetReady = true;
let widgetError: string | null = null;
// 위젯 약관 동의 상태. 위젯이 iframe 안에서 체크를 받으므로 실제로는 SDK의
// `agreementStatusChange`가 알려 준다. null은 "아직 모름"(= 한 번도 건드리지 않음).
//
// 기본값을 `true`로 두는 이유: 대부분의 테스트는 결제까지 가는 정상 경로를 본다.
// 가드를 확인하는 테스트만 `false`·`null`로 내려 쓴다.
let widgetAgreed: boolean | null = true;
jest.mock('./useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: () => ({
    methodsId: 'toss-methods-test', agreementId: 'toss-agreement-test',
    ready: widgetReady, error: widgetError, retry: retryPayment, requestPayment,
    agreedRequiredTerms: widgetAgreed,
  }),
  // 모듈을 통째로 대체하므로 상수도 함께 내보내야 한다 — 빠뜨리면 호출부가 undefined를
  // setError에 넣어 경고가 조용히 사라진다(2026-09-16에 실제로 그랬다).
  TOSS_TERMS_REQUIRED_MESSAGE: '결제수단 아래 [필수] 결제 서비스 이용 약관에도 동의해 주세요.',
}));

const createOrderResponse = {
  ok: true,
  orderNo: 'SNM-20260915-TEST0001',
  itemAmount: 250000,
  vatAmount: 25000,
  totalAmount: 275000,
};

beforeEach(() => {
  window.sessionStorage.clear();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => createOrderResponse,
  })) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function goToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '다음: 주문자 정보' }));
  expect(await screen.findByLabelText(/^이름/)).toBeInTheDocument();
}

describe('MixingOrderWizard 임시 저장', () => {
  it('입력 후 언마운트 → 재마운트하면 이름·연락처·이메일·요청사항이 복원된다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MixingOrderWizard />);

    await goToStep2(user);
    await user.type(screen.getByLabelText(/^이름/), '김믹싱');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01055556666');
    await user.type(screen.getByLabelText(/^이메일/), 'mix@example.com');
    await user.type(screen.getByLabelText('요청사항 (선택)'), 'https://drive.google.com/파일링크');

    await waitFor(() => expect(window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY)).not.toBeNull());

    unmount();

    render(<MixingOrderWizard />);
    await goToStep2(user);

    expect(screen.getByLabelText(/^이름/)).toHaveValue('김믹싱');
    expect(screen.getByLabelText(/^휴대폰 번호/)).toHaveValue('01055556666');
    expect(screen.getByLabelText(/^이메일/)).toHaveValue('mix@example.com');
    expect(screen.getByLabelText('요청사항 (선택)')).toHaveValue('https://drive.google.com/파일링크');
  });

  // 동의는 이제 체크박스가 아니라 결제하기를 누르는 행위다 — 되살릴 체크 자체가 없다.
  // 대신 임시 저장이 담는 값이 여전히 이름·연락처·이메일·요청사항 네 칸뿐인지, 동의
  // 관련 값이 저장소에 섞여 들어가지 않는지를 직접 확인한다.
  it('임시 저장에는 동의 관련 값이 들어가지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MixingOrderWizard />);

    await goToStep2(user);
    await user.type(screen.getByLabelText(/^이름/), '김믹싱');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01055556666');
    await user.type(screen.getByLabelText(/^이메일/), 'mix@example.com');
    unmount();

    const raw = window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(['customerEmail', 'customerName', 'customerPhone']);
  });

  it('상품·곡 수·보컬 튜닝 선택은 복원되지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MixingOrderWizard />);

    // 두 번째 상품(믹싱 · 11~30트랙)과 곡 수를 바꿔 둔다.
    const radios = screen.getAllByRole('radio');
    await user.click(radios[1]);
    await user.selectOptions(screen.getByLabelText('곡 수'), '3');

    await goToStep2(user);
    unmount();

    render(<MixingOrderWizard />);
    // 재마운트하면 항상 1번 상품·최소 곡 수로 되돌아간다.
    const restoredRadios = screen.getAllByRole('radio');
    expect(restoredRadios[0]).toBeChecked();
  });

  it('복원 전에 저장 effect가 초안을 지우지 않는다 (draftRestored 게이트 회귀)', async () => {
    window.sessionStorage.setItem(
      MIXING_CUSTOMER_DRAFT_KEY,
      JSON.stringify({ customerName: '기존믹싱고객' }),
    );
    const originalRemoveItem = window.sessionStorage.removeItem.bind(window.sessionStorage);
    const removeSpy = jest.fn((key: string) => originalRemoveItem(key));
    window.sessionStorage.removeItem = removeSpy;

    try {
      render(<MixingOrderWizard />);

      expect(removeSpy).not.toHaveBeenCalledWith(MIXING_CUSTOMER_DRAFT_KEY);
      expect(JSON.parse(window.sessionStorage.getItem(MIXING_CUSTOMER_DRAFT_KEY) as string)).toEqual({
        customerName: '기존믹싱고객',
      });
    } finally {
      window.sessionStorage.removeItem = originalRemoveItem;
    }
  });

  it('예약 초안과 믹싱 초안이 서로 새지 않는다', async () => {
    window.sessionStorage.setItem(
      'studionol:booking-draft:customer',
      JSON.stringify({ customerName: '예약고객', customerNote: '조용한 시간대 부탁드려요' }),
    );

    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await goToStep2(user);

    expect(screen.getByLabelText(/^이름/)).toHaveValue('');
    expect(screen.getByLabelText('요청사항 (선택)')).toHaveValue('');
    expect(JSON.parse(window.sessionStorage.getItem('studionol:booking-draft:customer') as string)).toEqual({
      customerName: '예약고객',
      customerNote: '조용한 시간대 부탁드려요',
    });
  });

  it('저장소가 막힌 환경에서도 정상 동작한다', async () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
      key: () => { throw new Error('blocked'); },
      get length() { throw new Error('blocked'); },
    };
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', { value: broken, configurable: true });

    try {
      const user = userEvent.setup();
      render(<MixingOrderWizard />);
      await goToStep2(user);
      await user.type(screen.getByLabelText(/^이름/), '김믹싱');
      expect(screen.getByLabelText(/^이름/)).toHaveValue('김믹싱');
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: original, configurable: true });
    }
  });
});

/**
 * 결제위젯을 **주문자 정보 폼 안에** 두는 구조.
 *
 * 예전에는 주문을 만든 뒤 3단계 결제 화면을 따로 그렸는데, 거기서 하는 일이 금액 확인과
 * 위젯 렌더뿐이라 화면 하나와 클릭 하나가 더 있는 셈이었다. 예약과 달리 잡아 둘 슬롯이
 * 없어(주문은 24시간 유지) 그 화면이 알려 줄 시한도 없다.
 */
describe('폼 안의 결제위젯', () => {
  afterEach(() => { widgetReady = true; widgetError = null; requestPayment.mockClear(); });

  const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
    await goToStep2(user);
    await user.type(screen.getByLabelText(/^이름/), '김고객');
    await user.type(screen.getByLabelText(/휴대폰/), '010-1111-2222');
    await user.type(screen.getByLabelText(/이메일/), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
  };

  it('단계가 둘로 줄었다 — 결제 전용 화면이 없다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    expect(screen.getByText('STEP 1 / 2')).toBeInTheDocument();
    await goToStep2(user);
    expect(screen.getByText('STEP 2 / 2')).toBeInTheDocument();
    // 수단 목록·약관 동의를 붙일 자리가 폼 안에 있다.
    expect(document.getElementById('toss-methods-test')).not.toBeNull();
    expect(document.getElementById('toss-agreement-test')).not.toBeNull();
  });

  it('제출하면 서버가 돌려준 금액으로 결제창을 연다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const payload = requestPayment.mock.calls.at(-1)![0];
    // 화면 추정치가 아니라 서버 응답(275,000원)으로 연다.
    expect(payload).toEqual(expect.objectContaining({ orderId: 'SNM-20260915-TEST0001', amount: 275000 }));
    expect(payload.failUrl).toContain('service=mixing-mastering');
    expect(payload.successUrl).toContain('/ko/booking/success');
  });

  // 체크박스가 사라져도 서버로는 계속 동의를 보내야 한다 — 결제하기를 누르는 행위가 곧
  // 동의이므로, 이 값이 조용히 빠지면 서버 검증(refundPolicyAgreed)이 깨진다.
  it('결제하기를 누르면 서버로 refundPolicyAgreed: true가 나간다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const orderCall = (global.fetch as jest.Mock).mock.calls.find((c) => c[0] === '/api/orders/mixing');
    const body = JSON.parse(orderCall![1].body);
    expect(body.refundPolicyAgreed).toBe(true);
  });

  /**
   * 위젯이 아직 안 떴는데 제출되면 **주문만 만들어지고 결제창은 안 열린다** — 고객은
   * 아무 일도 안 일어난 줄 알고, 우리 쪽에는 결제 없는 pending 주문만 쌓인다.
   */
  it('위젯이 준비되기 전에는 제출할 수 없다', async () => {
    widgetReady = false;
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await goToStep2(user);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
  });

  it('결제창을 닫으면 오류를 띄우지 않는다', async () => {
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('주문 생성이 실패하면 결제창을 열지 않고 이유를 말한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 400, json: async () => ({ ok: false, message: '입력을 확인해 주세요.' }),
    });
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('입력을 확인해 주세요.');
    expect(requestPayment).not.toHaveBeenCalled();
  });
});

/** BookingWizard와 같은 계약 — 동의를 빠뜨리면 그 체크박스로 데려간다. */
/**
 * 동의는 이제 체크박스가 아니라 **결제하기를 누르는 행위 자체**로 받는다
 * (2026-09-16, MixingOrderWizard.tsx 결제하기 버튼 위 고지 주석 참고). 여기서는 환불 규정
 * 전문이 펼쳐져 있고 그 아래 고지 문구가 실제로 붙어 있는지를 본다.
 */
describe('MixingOrderWizard 동의 안내', () => {
  it('환불 규정 2줄이 펼쳐져 있고, 그 아래 결제하기 고지가 붙는다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await goToStep2(user);

    const heading = screen.getByText('환불 규정');
    expect(screen.getByText('작업 착수 전 취소: 전액 환불')).toBeInTheDocument();
    expect(screen.getByText('작업 착수 후: 온라인 취소 불가 (환불 문의는 010-4255-7893)')).toBeInTheDocument();

    const notice = screen.getByText('결제하기를 누르면 위 환불 규정에 동의하는 것으로 봅니다.');
    expect(heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('우리 쪽 동의 체크박스가 없다', async () => {
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await goToStep2(user);

    expect(screen.queryByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toBeNull();
  });
});

/** BookingWizard와 같은 계약 — 위젯 약관을 빼먹으면 주문을 만들기 전에 막는다. */
describe('MixingOrderWizard 위젯 약관 가드', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
    requestPayment.mockClear();
  });
  afterEach(() => { widgetAgreed = true; });

  const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
    await goToStep2(user);
    await user.type(screen.getByLabelText(/^이름/), '김믹싱');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01055556666');
    await user.type(screen.getByLabelText(/^이메일/), 'mix@example.com');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
  };

  /** 위젯을 한 번도 건드리지 않은 경로(null)가 약관을 빼먹는 가장 흔한 경우다. */
  it('동의 상태를 모르면 주문을 만들지 않는다', async () => {
    widgetAgreed = null;
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('위젯 약관을 빼먹으면 주문을 만들지 않고 어느 약관인지 알려 준다', async () => {
    widgetAgreed = false;
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('결제창을 닫으면 약관 문구를 띄우지 않는다', async () => {
    // 결제까지 가야 취소를 재현할 수 있으니 동의된 상태로 둔다.
    widgetAgreed = true;
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    const user = userEvent.setup();
    render(<MixingOrderWizard />);
    await fillAndSubmit(user);
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());

    expect(screen.queryByText(/결제 서비스 이용 약관/)).toBeNull();
  });
});
