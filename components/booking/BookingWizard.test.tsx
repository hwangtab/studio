import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import BookingWizard from './BookingWizard';
import { BOOKING_CUSTOMER_DRAFT_KEY } from '../../lib/booking/customerDraft';
import type { SessionProduct } from '../../lib/booking/products';

/**
 * 새로고침·뒤로가기·모바일 탭 정리로 사라지던 예약자 정보(이름·연락처·이메일·요청사항)를
 * sessionStorage에 임시 저장한다. 여기서 지키는 계약(lib/formDraft.ts와 같다):
 * 담을 것은 문자열 네 칸뿐, 동의 체크·날짜·시간대·상품·시간은 절대 되살리지 않는다.
 */

/**
 * 결제위젯은 예약자 정보 폼 안에 떠 있고, 제출은 그 위젯의 `requestPayment`를 부른다.
 */
const requestPayment = jest.fn().mockResolvedValue(undefined);
const retryPayment = jest.fn();
let widgetReady = true;
let widgetError: string | null = null;
jest.mock('./useTossPaymentWidgets', () => ({
  useTossPaymentWidgets: () => ({
    methodsId: 'toss-methods-test', agreementId: 'toss-agreement-test',
    ready: widgetReady, error: widgetError, retry: retryPayment, requestPayment,
  }),
}));

const PRODUCT: SessionProduct = {
  id: 'recording-pro',
  service: 'recording',
  nameKo: '보컬 녹음 1프로',
  kind: 'package',
  unitAmount: 250000,
  sessionHours: 3,
};

const slotsResponse = { ok: true, slots: [{ startHour: 10, available: true }] };
const createBookingResponse = {
  ok: true,
  orderNo: 'SNB-20260915-TEST0001',
  itemAmount: 250000,
  vatAmount: 25000,
  totalAmount: 275000,
};

beforeEach(() => {
  window.sessionStorage.clear();
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/bookings/slots')) {
      return { ok: true, status: 200, json: async () => slotsResponse } as Response;
    }
    if (url === '/api/bookings') {
      return { ok: true, status: 201, json: async () => createBookingResponse } as Response;
    }
    throw new Error(`예상하지 못한 fetch: ${url}`);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** 3단계(예약자 정보)까지 진행한다 — 날짜·시간대는 매번 새로 고른다(임시 저장 대상이 아니므로). */
async function goToStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '다음: 날짜·시간 선택' }));
  fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-10-01' } });
  const slotButton = await screen.findByRole('button', { name: '10:00' });
  await user.click(slotButton);
  await user.click(screen.getByRole('button', { name: '다음: 예약자 정보' }));
  expect(await screen.findByLabelText(/^이름/)).toBeInTheDocument();
}

describe('BookingWizard 임시 저장', () => {
  it('입력 후 언마운트 → 재마운트하면 이름·연락처·이메일·요청사항이 복원된다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BookingWizard service="recording" products={[PRODUCT]} />);

    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.type(screen.getByLabelText('요청사항 (선택)'), '조용한 시간대 부탁드려요');

    await waitFor(() => expect(window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY)).not.toBeNull());

    unmount();

    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);

    expect(screen.getByLabelText(/^이름/)).toHaveValue('홍길동');
    expect(screen.getByLabelText(/^휴대폰 번호/)).toHaveValue('01012345678');
    expect(screen.getByLabelText(/^이메일/)).toHaveValue('hong@example.com');
    expect(screen.getByLabelText('요청사항 (선택)')).toHaveValue('조용한 시간대 부탁드려요');
  });

  it('환불 규정 동의는 복원되지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BookingWizard service="recording" products={[PRODUCT]} />);

    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.click(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ }));
    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toBeChecked();

    unmount();

    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);

    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).not.toBeChecked();
  });

  it('날짜·시간대·상품 선택은 복원되지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BookingWizard service="recording" products={[PRODUCT]} />);

    await goToStep3(user);
    unmount();

    // 재마운트 직후엔 다시 1단계부터다 — 날짜·시간대가 살아 있다면 곧장 3단계가 보였을 것.
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    expect(screen.getByRole('button', { name: '다음: 날짜·시간 선택' })).toBeInTheDocument();
    expect(screen.queryByLabelText('이름')).not.toBeInTheDocument();
  });

  it('복원 전에 저장 effect가 초안을 지우지 않는다 (draftRestored 게이트 회귀)', async () => {
    window.sessionStorage.setItem(
      BOOKING_CUSTOMER_DRAFT_KEY,
      JSON.stringify({ customerName: '기존고객', customerPhone: '01099998888' }),
    );
    const originalRemoveItem = window.sessionStorage.removeItem.bind(window.sessionStorage);
    const removeSpy = jest.fn((key: string) => originalRemoveItem(key));
    window.sessionStorage.removeItem = removeSpy;

    try {
      render(<BookingWizard service="recording" products={[PRODUCT]} />);

      // 마운트 직후 저장 effect가 (복원 전) 빈 상태로 한 번 돌면 이 키를 지운다.
      // 게이트가 없으면 이 시점에 removeItem이 호출된다.
      expect(removeSpy).not.toHaveBeenCalledWith(BOOKING_CUSTOMER_DRAFT_KEY);
      expect(JSON.parse(window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY) as string)).toEqual({
        customerName: '기존고객',
        customerPhone: '01099998888',
      });
    } finally {
      window.sessionStorage.removeItem = originalRemoveItem;
    }
  });

  it('예약 초안과 믹싱 초안이 서로 새지 않는다', async () => {
    window.sessionStorage.setItem(
      'studionol:mixing-draft:customer',
      JSON.stringify({ customerName: '믹싱고객', customerNote: '드라이브 링크입니다' }),
    );

    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);

    expect(screen.getByLabelText(/^이름/)).toHaveValue('');
    expect(screen.getByLabelText('요청사항 (선택)')).toHaveValue('');
    // 믹싱 쪽 값은 그대로 남아 있어야 한다 — 예약 위저드가 건드리면 안 된다.
    expect(JSON.parse(window.sessionStorage.getItem('studionol:mixing-draft:customer') as string)).toEqual({
      customerName: '믹싱고객',
      customerNote: '드라이브 링크입니다',
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
      render(<BookingWizard service="recording" products={[PRODUCT]} />);
      await goToStep3(user);
      await user.type(screen.getByLabelText(/^이름/), '홍길동');
      expect(screen.getByLabelText(/^이름/)).toHaveValue('홍길동');
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: original, configurable: true });
    }
  });
});

/**
 * 결제위젯을 **예약자 정보 폼 안에** 두는 구조.
 *
 * 예전에는 주문을 만든 뒤 4단계 결제 화면을 따로 그렸고, 거기서 선점 카운트다운을
 * 보여 줬다. 그 말은 없애지 않고 **시작 전으로 옮겼다** — 결제창을 열고 나면 고객은 토스
 * 화면에 있어서 우리 타이머를 볼 수 없다.
 */
describe('폼 안의 결제위젯', () => {
  afterEach(() => { widgetReady = true; widgetError = null; requestPayment.mockClear(); });

  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '김고객');
    await user.type(screen.getByLabelText(/휴대폰/), '010-1111-2222');
    await user.type(screen.getByLabelText(/이메일/), 'a@b.com');
    await user.click(screen.getByLabelText(/환불 규정에 동의/));
  };

  it('단계가 셋으로 줄었고, 수단·약관 자리가 폼 안에 있다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    expect(screen.getByText('STEP 1 / 3')).toBeInTheDocument();
    await goToStep3(user);
    expect(document.getElementById('toss-methods-test')).not.toBeNull();
    expect(document.getElementById('toss-agreement-test')).not.toBeNull();
  });

  /**
   * 선점 안내가 사라지면, 고객은 자기가 잡아 둔 시간대에 시한이 있다는 것을 모른 채
   * 결제창에서 오래 머문다 — 토스 인증까지 마치고 confirm에서 거부당한다.
   */
  it('결제를 시작하기 전에 선점 시한을 알려 준다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('15분간');
    expect(notice).toHaveTextContent('다른 분이 예약할 수 있습니다');
  });

  it('제출하면 서버가 돌려준 금액으로 결제창을 연다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const payload = requestPayment.mock.calls.at(-1)![0];
    expect(payload).toEqual(expect.objectContaining({ orderId: 'SNB-20260915-TEST0001', amount: 275000 }));
    expect(payload.failUrl).toContain('service=recording');
  });

  it('위젯이 준비되기 전에는 제출할 수 없다', async () => {
    widgetReady = false;
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);
    expect(screen.getByRole('button', { name: /결제하기/ })).toBeDisabled();
  });

  /**
   * 슬롯을 다른 사람이 먼저 잡은 경우(409)는 결제창을 열면 안 되고, 시간대를 다시 고르게
   * 2단계로 돌려보내야 한다.
   */
  it('다른 예약이 먼저 잡히면 결제창을 열지 않고 시간대 선택으로 돌린다', async () => {
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/bookings/slots')) return { ok: true, status: 200, json: async () => slotsResponse } as Response;
      return { ok: false, status: 409, json: async () => ({ ok: false, message: '방금 다른 예약이 먼저 잡혔습니다.' }) } as Response;
    });
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(screen.getByText(/방금 다른 예약이 먼저 잡혔습니다/)).toBeInTheDocument());
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('결제창을 닫으면 오류를 띄우지 않는다', async () => {
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/**
 * 동의를 빠뜨렸을 때 **그 체크박스로 데려가는가**.
 *
 * `focus()`만 부르면 브라우저가 최소한으로만 스크롤해서, 화면 밖이나 하단 고정 요소에
 * 가려진 채 초점만 옮겨 간다 — 동의하라는 말은 보이는데 어디를 눌러야 하는지는 안 보인다.
 */
describe('BookingWizard 동의 안내', () => {
  beforeEach(() => {
    // jsdom에는 scrollIntoView가 없다. 호출 여부를 보려면 직접 심어야 한다.
    Element.prototype.scrollIntoView = jest.fn();
  });

  const submitWithoutAgreeing = async (user: ReturnType<typeof userEvent.setup>) => {
    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
  };

  it('미동의로 제출하면 그 체크박스로 스크롤하고 초점을 준다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await submitWithoutAgreeing(user);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toHaveFocus();
  });

  it('미동의 상태를 체크박스에 표시하고 제출하지 않는다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await submitWithoutAgreeing(user);

    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
