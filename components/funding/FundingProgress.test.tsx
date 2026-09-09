import { render, screen } from '@testing-library/react';
import FundingProgress from './FundingProgress';

it('모금액·달성률·후원자 수·D-day', () => {
  render(<FundingProgress goalAmount={1000000} endAt="2026-10-31T23:59:59+09:00" now={new Date('2026-10-20T00:00:00Z')}
    data={{ raisedAmount: 450000, backerCount: 12, percent: 45, state: 'live' }} />);
  expect(screen.getByText('450,000원')).toBeInTheDocument();
  expect(screen.getByText('45%')).toBeInTheDocument();
  expect(screen.getByText(/12명/)).toBeInTheDocument();
  expect(screen.getByText(/D-11/)).toBeInTheDocument();
});
it('progressbar에 aria-label이 있다', () => {
  render(<FundingProgress goalAmount={1000000} endAt="2026-10-31T23:59:59+09:00" now={new Date('2026-10-20T00:00:00Z')}
    data={{ raisedAmount: 450000, backerCount: 12, percent: 45, state: 'live' }} />);
  expect(screen.getByRole('progressbar', { name: '펀딩 달성률' })).toBeInTheDocument();
});
it('데이터가 없으면 집계 중', () => {
  render(<FundingProgress goalAmount={1} endAt="2026-10-31T23:59:59+09:00" now={new Date()} data={null} />);
  expect(screen.getByText(/집계 중/)).toBeInTheDocument();
});
