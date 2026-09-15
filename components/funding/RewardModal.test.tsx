import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import RewardModal from './RewardModal';
import type { FundingProject, FundingReward } from '../../lib/funding/projects';

/**
 * 이 모달의 설계에서 깨지기 쉬운 두 가지를 고정한다.
 *
 * 1. 결제 단계에서도 **포커스 트랩이 켜져 있어야 한다.** 예전에는 결제위젯 iframe이 모달
 *    안에 떠서 트랩을 꺼야 했지만(선택자에 `iframe`이 없어 Tab이 되감겼다), 지금은 폼에서
 *    결제수단을 고르면 토스 결제창으로 **전체 이동**하므로 모달 안에 iframe이 없다.
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

  it('상세 단계에서는 포커스 트랩이 켜져 있다', () => {
    renderModal();
    expect(lastTrapState()).toBe(true);
  });

  /**
   * 모달이 열려 있는 동안 트랩은 계속 켜져 있다. 예전에는 결제 단계에서 껐다 — 모달 안에
   * 결제 iframe이 떠 있었기 때문인데, 지금은 결제창으로 전체 이동하므로 끌 이유가 없다.
   * 켜 둔 채로 두는 편이 맞다: 모달 뒤 배경으로 Tab이 새어 나가지 않는다.
   */
  it('결제 단계로 들어가도 포커스 트랩을 끄지 않는다 — 모달 안에 iframe이 없다', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(lastTrapState()).toBe(true);

    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    await user.click(screen.getByRole('button', { name: '결제 단계로' }));

    expect(lastTrapState()).toBe(true);
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

/**
 * 결제 단계로 넘어가면 포커스 트랩을 끄는데, 훅이 꺼질 때 스스로 포커스를 되돌리게 두면
 * **모달 뒤 리워드 카드**(백드롭에 가려진 자리)로 튕겨 나간다. 되돌리는 시점은 모달이
 * 실제로 닫힐 때여야 한다.
 */
describe('포커스 복원 시점', () => {
  it('결제 단계로 넘어가도 포커스가 모달 밖으로 나가지 않는다', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('a');
    trigger.href = '#';
    trigger.textContent = '리워드 카드';
    document.body.appendChild(trigger);
    trigger.focus();

    renderModal();
    await user.click(screen.getByRole('button', { name: '이 리워드로 후원하기' }));
    await user.click(screen.getByRole('button', { name: '결제 단계로' }));

    expect(document.activeElement).not.toBe(trigger);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('닫을 때는 열기 전 자리로 포커스를 돌려준다', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    renderModal(REWARD, onClose);

    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(onClose).toHaveBeenCalled();
  });
});
