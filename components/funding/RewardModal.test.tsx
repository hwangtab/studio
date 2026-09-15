import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import RewardModal from './RewardModal';
import type { FundingProject, FundingReward } from '../../lib/funding/projects';

/**
 * 이 모달의 설계에서 깨지기 쉬운 두 가지를 고정한다.
 *
 * 1. 결제 단계에서 **포커스 트랩이 꺼져야 한다.** 트랩의 포커스 대상 선택자에 `iframe`이
 *    없어서, 켜 둔 채로는 마지막 요소에서 Tab이 첫 요소로 되감기며 결제 iframe을 건너뛴다
 *    — 키보드만 쓰는 후원자가 카드번호를 입력할 방법이 없어진다.
 * 2. 폼·결제는 `/pledge` 페이지와 **같은 PledgeWizard**여야 한다. 복제하는 순간 약관 동의와
 *    terms_version 기록이 두 벌이 된다.
 */

const focusTrapSpy = jest.fn();

/**
 * 트랩의 실제 Tab 되감기는 jsdom에서 재현되지 않는다 — `useFocusTrapDialog`는 포커스 대상을
 * `offsetParent !== null || getClientRects().length > 0`으로 거르는데 jsdom에서는 둘 다
 * 거짓이라 목록이 항상 비고, 되감기 분기에 들어가지 못한다. 그래서 **훅에 무엇을 넘기는지**를
 * 본다. 이 모달이 통제하는 것도 거기까지다.
 */
jest.mock('../../utils/useFocusTrapDialog', () => ({
  useFocusTrapDialog: (opts: { isOpen: boolean }) => {
    focusTrapSpy(opts.isOpen);
    return { restoreFocus: jest.fn() };
  },
}));

const lastTrapState = (): boolean => focusTrapSpy.mock.calls[focusTrapSpy.mock.calls.length - 1][0];

// PledgeWizard는 결제 SDK까지 끌고 들어오므로 대역으로 세우고, 결제 단계 진입만 흉내 낸다.
jest.mock('./PledgeWizard', () => ({
  __esModule: true,
  default: ({ initialRewardId, onPaymentActiveChange }: {
    initialRewardId: string | null;
    onPaymentActiveChange?: (active: boolean) => void;
  }) => {
    return (
      <div>
        <p>후원 폼 대역 · {initialRewardId}</p>
        <button type="button" onClick={() => onPaymentActiveChange?.(true)}>결제 단계로</button>
      </div>
    );
  },
}));

const REWARD: FundingReward = {
  id: 'mp3',
  title: 'MP3 320kbps',
  description: '앨범 13곡 전체',
  amount: 10000,
  totalQuantity: null,
  requiresShipping: false,
  estimatedDelivery: '2026-10',
  image: null,
  downloads: [],
};

const PROJECT = {
  slug: 'keep-singing',
  title: '함께 부르는 노래',
  summary: '요약',
  rewards: [REWARD],
} as unknown as FundingProject;

const renderModal = (reward: FundingReward | null = REWARD, onClose = jest.fn()) =>
  render(<RewardModal project={PROJECT} reward={reward} remaining={{ mp3: null }} onClose={onClose} />);

beforeEach(() => jest.clearAllMocks());

describe('RewardModal', () => {
  it('리워드가 없으면 아무것도 렌더하지 않는다', () => {
    renderModal(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('상세부터 보여 주고, 후원 버튼을 눌러야 폼으로 넘어간다', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole('heading', { name: 'MP3 320kbps' })).toBeInTheDocument();
    expect(screen.getByText('10,000원')).toBeInTheDocument();
    expect(screen.queryByText(/후원 폼 대역/)).toBeNull();

    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    // 폼은 페이지와 같은 PledgeWizard이고, 고른 리워드가 그대로 넘어간다.
    expect(screen.getByText('후원 폼 대역 · mp3')).toBeInTheDocument();
  });

  it('Escape로 닫힌다', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderModal(REWARD, onClose);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('결제 단계로 들어가도 Escape 닫기는 살아 있다 — 트랩을 끄면서 함께 사라지면 안 된다', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderModal(REWARD, onClose);

    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    await user.click(screen.getByRole('button', { name: '결제 단계로' }));

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * 대조다. 상세 단계에서는 트랩이 켜지고 결제 단계에서만 꺼져야, "결제 때문에 껐다"고
   * 말할 수 있다. 한쪽만 보면 "원래 트랩을 안 걸었다"와 구분되지 않는다.
   */
  it('상세 단계에서는 포커스 트랩이 켜져 있다', () => {
    renderModal();
    expect(lastTrapState()).toBe(true);
  });

  it('결제 단계에서는 포커스 트랩을 끈다 — 켜 두면 결제 iframe을 Tab으로 건너뛴다', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(lastTrapState()).toBe(true);

    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    await user.click(screen.getByRole('button', { name: '결제 단계로' }));

    expect(lastTrapState()).toBe(false);
  });

  it('리워드를 바꾸면 상세 단계부터 다시 시작한다', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const { rerender } = renderModal();

    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    expect(screen.getByText(/후원 폼 대역/)).toBeInTheDocument();

    const other: FundingReward = { ...REWARD, id: 'wav', title: 'WAV 16bit', amount: 30000 };
    rerender(
      <RewardModal project={PROJECT} reward={other} remaining={{ wav: null }} onClose={onClose} />
    );

    expect(screen.queryByText(/후원 폼 대역/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'WAV 16bit' })).toBeInTheDocument();
  });

  it('품절이면 후원으로 넘어갈 수 없다', () => {
    render(
      <RewardModal
        project={PROJECT}
        reward={{ ...REWARD, totalQuantity: 10 }}
        remaining={{ mp3: 0 }}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('button', { name: '품절' })).toBeDisabled();
  });
});
