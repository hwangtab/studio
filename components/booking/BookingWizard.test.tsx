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
