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

  it('환불 규정 동의는 복원되지 않는다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MixingOrderWizard />);

    await goToStep2(user);
    await user.click(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ }));
    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).toBeChecked();

    unmount();

    render(<MixingOrderWizard />);
    await goToStep2(user);

    expect(screen.getByRole('checkbox', { name: /환불 규정에 동의합니다/ })).not.toBeChecked();
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
