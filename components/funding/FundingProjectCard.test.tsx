import { render, screen } from '@testing-library/react';
import FundingProjectCard from './FundingProjectCard';

// 목록은 정적 생성이라 서버가 계산한 배지가 빌드 시각에 고정된다 — 마감이 지나도 며칠씩
// '진행 중'으로 보였다. 마운트 후 브라우저 시계로 다시 판정한다.
it('마감이 지난 프로젝트는 마운트 후 마감으로 갱신된다', async () => {
  render(
    <FundingProjectCard slug="demo" title="데모" summary="요약" cover="/c.webp" goalAmount={1000000}
      state="live" status="auto" startAt="2020-01-01T00:00:00+09:00" endAt="2020-02-01T00:00:00+09:00" />,
  );
  expect(await screen.findByText('마감')).toBeInTheDocument();
});
it('기간 중이면 진행 중을 유지한다', async () => {
  const endAt = new Date(Date.now() + 86400000).toISOString();
  render(
    <FundingProjectCard slug="demo" title="데모" summary="요약" cover="/c.webp" goalAmount={1000000}
      state="live" status="auto" startAt="2020-01-01T00:00:00+09:00" endAt={endAt} />,
  );
  expect(await screen.findByText('진행 중')).toBeInTheDocument();
});
