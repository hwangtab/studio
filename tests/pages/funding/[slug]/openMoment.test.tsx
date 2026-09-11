import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../../components/SEO', () => function MockSEO() { return null; });
jest.mock('../../../../components/MarkdownRenderer', () => function MockMarkdownRenderer() { return null; });
jest.mock('../../../../components/funding/FundingTrustNotice', () => function MockFundingTrustNotice() { return null; });

// eslint-disable-next-line import/first
import FundingProjectPage from '../../../../pages/[locale]/funding/[slug]/index';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';

/**
 * 오픈 순간 회귀 — **훅을 모킹하지 않는다.** 예전에는 `upcoming` 상태에서 폴링 타이머를 아예
 * 걸지 않아, 오픈을 기다리며 탭을 띄워 둔 사람에게는 `startAt`이 지나도 후원 버튼이 끝까지
 * 나타나지 않았다(새로고침해야 했다). 캠페인 오픈 순간에 가장 많은 사람이 보고 있는 화면이다.
 *
 * 상태 API는 일부러 낡은 `upcoming`을 계속 돌려준다 — 응답이 CDN에서 s-maxage=60으로
 * 캐시되는 실제 조건이다. 그래도 화면은 브라우저 시계로 열려야 한다.
 */
const OPEN_AT = new Date('2026-10-15T12:00:00+09:00');

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: ${OPEN_AT.toISOString()}
endAt: 2036-01-01T00:00:00+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('탭을 띄워 둔 채 오픈 시각이 지나면 새로고침 없이 후원 CTA가 나타난다', async () => {
  jest.useFakeTimers({ now: OPEN_AT.getTime() - 30 * 60 * 1000 });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      state: 'upcoming', goalAmount: 1000, endAt: '2036-01-01', raisedAmount: 0, backerCount: 0,
      percent: 0, remaining: { mail: null }, publicBackers: [],
    }),
  }) as never;

  render(<FundingProjectPage project={project} initialState="upcoming" />);
  await waitFor(() => expect(screen.getByText('오픈 예정')).toBeInTheDocument());
  expect(screen.queryAllByRole('link', { name: '후원하기' })).toHaveLength(0);

  await act(async () => { jest.advanceTimersByTime(30 * 60 * 1000 + 5000); });

  // 히어로 CTA와 모바일 고정 CTA 둘 다 나타난다.
  await waitFor(() => expect(screen.getAllByRole('link', { name: '후원하기' }).length).toBeGreaterThan(0));
  expect(screen.getByText('진행 중')).toBeInTheDocument();
});
