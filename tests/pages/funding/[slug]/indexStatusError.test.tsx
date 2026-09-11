import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../../../components/SEO', () => function MockSEO() { return null; });
jest.mock('../../../../components/MarkdownRenderer', () => function MockMarkdownRenderer() { return null; });
jest.mock('../../../../components/funding/FundingTrustNotice', () => function MockFundingTrustNotice() { return null; });
jest.mock('../../../../components/funding/useFundingStatus', () => ({ useFundingStatus: jest.fn() }));

// eslint-disable-next-line import/first
import FundingProjectPage from '../../../../pages/[locale]/funding/[slug]/index';
// eslint-disable-next-line import/first
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모
summary: s
cover: /c.webp
goalAmount: 1000
startAt: 2026-01-01T00:00:00+09:00
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

// 상태 API가 죽으면 진행률·남은 수량이 초기값에 멈춘 채 아무 설명이 없었다 —
// 후원자는 그 숫자를 현재 값으로 읽는다.
it('상태 조회가 실패하면 안내 문구를 띄운다', () => {
  (useFundingStatus as jest.Mock).mockReturnValue({ data: null, error: true, state: 'live' });
  render(<FundingProjectPage project={project} initialState="live" />);
  expect(screen.getByRole('alert')).toHaveTextContent('현황을 불러오지 못했습니다. 새로고침해 주세요.');
});

it('정상일 때는 안내 문구가 없다', () => {
  (useFundingStatus as jest.Mock).mockReturnValue({
    data: { state: 'live', goalAmount: 1000, endAt: '2036-01-01', raisedAmount: 0, backerCount: 0, percent: 0, remaining: { mail: null }, publicBackers: [] },
    error: false,
    state: 'live',
  });
  render(<FundingProjectPage project={project} initialState="live" />);
  expect(screen.queryByRole('alert')).toBeNull();
});
