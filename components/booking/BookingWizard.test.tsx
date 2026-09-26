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

  // 동의는 이제 체크박스가 아니라 결제하기를 누르는 행위다 — 되살릴 체크 자체가 없다.
  // 대신 임시 저장이 담는 값이 여전히 이름·연락처·이메일·요청사항 네 칸뿐인지, 동의
  // 관련 값이 저장소에 섞여 들어가지 않는지를 직접 확인한다.
  it('임시 저장에는 동의 관련 값이 들어가지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<BookingWizard service="recording" products={[PRODUCT]} />);

    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    unmount();

    const raw = window.sessionStorage.getItem(BOOKING_CUSTOMER_DRAFT_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(saved).sort()).toEqual(['customerEmail', 'customerName', 'customerPhone']);
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

  // 체크박스가 사라져도 서버로는 계속 동의를 보내야 한다 — 결제하기를 누르는 행위가 곧
  // 동의이므로, 이 값이 조용히 빠지면 서버 검증(refundPolicyAgreed)이 깨진다.
  it('결제하기를 누르면 서버로 refundPolicyAgreed: true가 나간다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
    const bookingCall = (global.fetch as jest.Mock).mock.calls.find((c) => c[0] === '/api/bookings');
    const body = JSON.parse(bookingCall![1].body);
    expect(body.refundPolicyAgreed).toBe(true);
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
 * 동의는 이제 체크박스가 아니라 **결제하기를 누르는 행위 자체**로 받는다
 * (2026-09-16, BookingWizard.tsx 결제하기 버튼 위 고지 주석 참고). 여기서는 환불 규정
 * 전문이 펼쳐져 있고 그 아래 고지 문구가 실제로 붙어 있는지를 본다.
 */
describe('BookingWizard 동의 안내', () => {
  it('환불 규정 3줄이 펼쳐져 있고, 그 아래 결제하기 고지가 붙는다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);

    const heading = screen.getByText('환불 규정');
    expect(screen.getByText('이용일 3일 전까지 취소: 전액 환불')).toBeInTheDocument();
    expect(screen.getByText('이용일 1~2일 전 취소: 50% 환불')).toBeInTheDocument();
    expect(screen.getByText('이용일 당일 취소: 환불 불가')).toBeInTheDocument();

    const notice = screen.getByText('결제하기를 누르면 위 환불 규정에 동의하는 것으로 봅니다.');
    expect(heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('우리 쪽 동의 체크박스가 없다', async () => {
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await goToStep3(user);

    expect(screen.queryByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toBeNull();
  });
});

/**
 * 위젯이 그리는 결제 약관을 빼먹은 경우.
 *
 * 예전엔 그냥 보내고 `requestPayment`가 실패하게 두고 `code === 'NEED_AGREEMENT'`로 사유를
 * 가리려 했는데 **그 코드는 SDK에 없다**. 그래서 약관만 빼먹은 사람이 "결제를 시작하지
 * 못했습니다. 잠시 후 다시 시도해 주세요"를 봤다 — 다시 시도해도 같고 무엇을 고쳐야
 * 하는지도 알 수 없다. 게다가 그 시점엔 주문이 이미 만들어져 있었다.
 */
describe('BookingWizard 위젯 약관 가드', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
    requestPayment.mockClear();
  });
  afterEach(() => { widgetAgreed = true; });

  const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
    await goToStep3(user);
    await user.type(screen.getByLabelText(/^이름/), '홍길동');
    await user.type(screen.getByLabelText(/^휴대폰 번호/), '01012345678');
    await user.type(screen.getByLabelText(/^이메일/), 'hong@example.com');
    await user.click(screen.getByRole('button', { name: /결제하기/ }));
  };

  /** 위젯을 한 번도 건드리지 않은 경로(null)가 약관을 빼먹는 가장 흔한 경우다. */
  it('동의 상태를 모르면 주문을 만들지 않는다', async () => {
    widgetAgreed = null;
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
  });

  it('위젯 약관을 빼먹으면 예약을 만들지 않고 어느 약관인지 알려 준다', async () => {
    widgetAgreed = false;
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('결제 서비스 이용 약관');
    expect(requestPayment).not.toHaveBeenCalled();
  });

  /** 결제창을 닫은 것은 오류가 아니다 — 약관 문구를 띄우면 오진이다. */
  it('결제창을 닫으면 약관 문구를 띄우지 않는다', async () => {
    // 결제까지 가야 취소를 재현할 수 있으니 동의된 상태로 둔다.
    widgetAgreed = true;
    requestPayment.mockRejectedValueOnce(Object.assign(new Error('취소'), { code: 'USER_CANCEL' }));
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await fillAndSubmit(user);
    await waitFor(() => expect(requestPayment).toHaveBeenCalled());

    expect(screen.queryByText(/결제 서비스 이용 약관/)).toBeNull();
  });
});

describe('슬롯 조회 장애 안내', () => {
  it('503이면 안내와 대안 링크를 띄우고, 다시 불러오기를 누르면 재조회한다', async () => {
    let calls = 0;
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/bookings/slots')) {
        calls += 1;
        if (calls === 1) return { ok: false, status: 503, json: async () => ({ ok: false }) } as Response;
        return { ok: true, status: 200, json: async () => slotsResponse } as Response;
      }
      throw new Error(`예상하지 못한 fetch: ${url}`);
    });
    const user = userEvent.setup();
    render(<BookingWizard service="recording" products={[PRODUCT]} />);
    await user.click(screen.getByRole('button', { name: '다음: 날짜·시간 선택' }));
    fireEvent.change(screen.getByLabelText('날짜'), { target: { value: '2026-10-01' } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('일시적으로 예약 현황을 불러올 수 없습니다.');
    expect(screen.getByRole('link', { name: '카카오톡' })).toHaveAttribute('href', 'https://open.kakao.com/me/nol');
    expect(screen.getByRole('link', { name: '010-4255-7893' })).toHaveAttribute('href', 'tel:+821042557893');

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByRole('button', { name: '10:00' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe('BookingWizard 상품 미리 고르기', () => {
  const DAYLOCK: SessionProduct = {
    id: 'recording-daylock-8h', service: 'recording', nameKo: 'Day Lock 8시간', kind: 'package', unitAmount: 650000, sessionHours: 8,
  };

  it('initialProductId가 가리키는 상품이 처음부터 선택된다 — 가격표 Day Lock 카드에서 들어온 경우', () => {
    render(<BookingWizard service="recording" products={[PRODUCT, DAYLOCK]} initialProductId="recording-daylock-8h" />);
    expect(screen.getByRole('radio', { name: /Day Lock 8시간/ })).toBeChecked();
  });

  it('목록에 없는 id면 첫 상품으로 돌아간다', () => {
    render(<BookingWizard service="recording" products={[PRODUCT, DAYLOCK]} initialProductId="nope" />);
    expect(screen.getByRole('radio', { name: new RegExp(PRODUCT.nameKo) })).toBeChecked();
  });
});
