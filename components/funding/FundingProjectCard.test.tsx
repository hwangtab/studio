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

/**
 * 목록은 정적 생성인데 모금 현황만 클라이언트 폴링으로 채웠다. 그래서 첫 화면에는
 * "목표 1,000,000원"만 떠서 아직 0원인 것처럼 읽혔고(실제로는 24% 모인 상태였다),
 * 진행바가 뒤늦게 생기며 그 아래가 밀렸다. 서버가 실어 보낸 값으로 첫 렌더부터 채운다.
 */
it('서버가 준 현황이 있으면 폴링 전에도 모금액을 보여준다', () => {
  global.fetch = jest.fn(() => new Promise(() => {})) as never; // 폴링은 영영 응답하지 않는다

  render(
    <FundingProjectCard slug="demo" title="데모" summary="요약" cover="/c.webp" goalAmount={1000000}
      state="live" status="auto" startAt="2020-01-01T00:00:00+09:00" endAt="2036-01-01T00:00:00+09:00"
      initialStatus={{
        state: 'live', goalAmount: 1000000, endAt: '2036-01-01T00:00:00+09:00',
        raisedAmount: 240000, backerCount: 7, percent: 24,
        remaining: {}, publicBackers: [], publicMessages: [],
      }} />,
  );

  expect(screen.getByText('240,000원')).toBeInTheDocument();
  expect(screen.getByText('24%')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: '데모 달성률' })).toBeInTheDocument();
  expect(screen.queryByText(/목표 1,000,000원/)).toBeNull();
});

// 빌드에 DB가 없으면(CI) 초기값이 null로 온다 — 그때는 예전처럼 목표액을 두고 폴링을 기다린다.
it('서버가 준 현황이 없으면 목표액을 보여준다', () => {
  global.fetch = jest.fn(() => new Promise(() => {})) as never;

  render(
    <FundingProjectCard slug="demo" title="데모" summary="요약" cover="/c.webp" goalAmount={1000000}
      state="live" status="auto" startAt="2020-01-01T00:00:00+09:00" endAt="2036-01-01T00:00:00+09:00"
      initialStatus={null} />,
  );

  expect(screen.getByText(/목표 1,000,000원/)).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).toBeNull();
});
