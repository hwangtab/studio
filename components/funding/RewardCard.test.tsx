import { render, screen } from '@testing-library/react';
import RewardCard from './RewardCard';

const reward = { id: 'cd', title: 'CD + 엽서', description: '설명', amount: 30000, totalQuantity: 10, requiresShipping: true, estimatedDelivery: '2026-12', image: null, downloads: [] };

it('금액·남은 수량·배송·전달 시기와 후원 링크를 보여준다', () => {
  render(<RewardCard reward={reward} remaining={3} pledgeHref="/ko/funding/demo/pledge?reward=cd" canPledge />);
  expect(screen.getByText('30,000원')).toBeInTheDocument();
  expect(screen.getByText(/3개 남음/)).toBeInTheDocument();
  expect(screen.getByText(/배송/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /이 리워드로 후원하기/ })).toHaveAttribute('href', '/ko/funding/demo/pledge?reward=cd');
});
it('품절이면 링크 대신 품절 배지', () => {
  render(<RewardCard reward={reward} remaining={0} pledgeHref="/x" canPledge />);
  expect(screen.getByText('품절')).toBeInTheDocument();
  expect(screen.queryByRole('link')).toBeNull();
});
it('후원 불가 상태면 링크가 없다', () => {
  render(<RewardCard reward={reward} remaining={null} pledgeHref="/x" canPledge={false} />);
  expect(screen.queryByRole('link')).toBeNull();
});

/**
 * 모달을 붙인 뒤에도 카드는 **버튼이 아니라 진짜 링크**여야 한다. 클릭만 가로챈다.
 * 이 구분이 무너지면 JS가 없는 환경에서 후원 경로가 통째로 사라지고, 새 탭으로 열기와
 * 주소 복사도 안 된다.
 */
describe('모달 연동', () => {
  const href = '/ko/funding/demo/pledge?reward=cd';

  it('onSelect가 있어도 href는 남는다', () => {
    render(<RewardCard reward={reward} remaining={3} pledgeHref={href} canPledge onSelect={jest.fn()} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', href);
  });

  it('평범한 클릭은 가로채 모달을 연다 — 이동하지 않는다', () => {
    const onSelect = jest.fn();
    render(<RewardCard reward={reward} remaining={3} pledgeHref={href} canPledge onSelect={onSelect} />);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link').dispatchEvent(click);

    expect(onSelect).toHaveBeenCalledWith(reward);
    expect(click.defaultPrevented).toBe(true);
  });

  it('수식 키를 누른 클릭은 브라우저에 넘긴다 — 새 탭으로 열려야 한다', () => {
    const onSelect = jest.fn();
    render(<RewardCard reward={reward} remaining={3} pledgeHref={href} canPledge onSelect={onSelect} />);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
    screen.getByRole('link').dispatchEvent(click);

    expect(onSelect).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(false);
  });

  it('onSelect가 없으면 그냥 링크다 — JS가 없어도 후원 페이지로 간다', () => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    render(<RewardCard reward={reward} remaining={3} pledgeHref={href} canPledge />);
    screen.getByRole('link').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });
});

