import { render, screen } from '@testing-library/react';
import FundingProgress from './FundingProgress';

it('모금액·달성률·후원 건수·D-day', () => {
  render(<FundingProgress goalAmount={1000000} endAt="2026-10-31T23:59:59+09:00" now={new Date('2026-10-20T00:00:00Z')}
    data={{ raisedAmount: 450000, backerCount: 12, percent: 45, state: 'live' }} />);
  expect(screen.getByText('450,000원')).toBeInTheDocument();
  expect(screen.getByText('45%')).toBeInTheDocument();
  // 서버 집계는 COUNT(*)(건수)다 — 'N명'이면 중복 후원자를 인원으로 부풀린다.
  expect(screen.getByText(/12건 후원/)).toBeInTheDocument();
  expect(screen.queryByText(/12명/)).not.toBeInTheDocument();
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

// now는 마운트 후에만 채워진다(페이지가 useEffect로 넣는다) — null인 첫 렌더에서 D-day를
// 그리면 서버가 그린 값과 달라 하이드레이션이 깨진다.
it('now가 null이면 D-day를 비우되 높이는 예약한다', () => {
  const { container } = render(
    <FundingProgress goalAmount={1000000} endAt="2026-10-31T23:59:59+09:00" now={null}
      data={{ raisedAmount: 450000, backerCount: 12, percent: 45, state: 'live' }} />,
  );
  expect(screen.queryByText(/D-/)).not.toBeInTheDocument();
  expect(screen.getByText(/12건 후원/)).toBeInTheDocument();
  expect(container.querySelector('.min-h-\\[120px\\]')).toBeInTheDocument();
});
it('now가 null이고 데이터도 없으면 집계 중만 보인다', () => {
  render(<FundingProgress goalAmount={1} endAt="2026-10-31T23:59:59+09:00" now={null} data={null} />);
  expect(screen.getByText('모금 현황 집계 중…')).toBeInTheDocument();
});
