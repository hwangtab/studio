import { render, screen } from '@testing-library/react';
import RewardCard from './RewardCard';

const reward = { id: 'cd', title: 'CD + 엽서', description: '설명', amount: 30000, totalQuantity: 10, requiresShipping: true, estimatedDelivery: '2026-12', image: null };

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
