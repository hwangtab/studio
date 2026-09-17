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

/**
 * 공개 상세는 마운트 직후(폴링 fetch 응답 전) `data`가 항상 null이다 — SSG 정적 HTML은
 * 이 상태 그대로 나간다(카카오·구글 스크래퍼가 보는 것도 이것이다). 이때 개설자 미리보기용
 * "미리보기" 문구가 새어 나오면 진행 중인 프로젝트가 전부 그 상태로 배포된다
 * (ProjectDetailView가 `status===null`이 아니라 `interactive`로 갈려야 하는 이유).
 */
it('폴링 응답 전(data=null)에도 "미리보기" 문구가 새지 않는다 — 대신 집계 중 표시', () => {
  (useFundingStatus as jest.Mock).mockReturnValue({ data: null, error: false, state: 'live' });
  render(<FundingProjectPage project={project} initialState="live" />);
  expect(screen.queryByText(/미리보기/)).toBeNull();
  expect(screen.getByText(/집계 중/)).toBeInTheDocument();
});
