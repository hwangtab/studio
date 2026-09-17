import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../MarkdownRenderer', () => function MockMarkdownRenderer() { return null; });
jest.mock('./FundingTrustNotice', () => function MockFundingTrustNotice() { return null; });

// eslint-disable-next-line import/first
import ProjectDetailView from './ProjectDetailView';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../lib/funding/projects';

const project = parseFundingProject(`---
slug: demo
title: 데모 프로젝트
summary: 요약
cover: /c.webp
goalAmount: 1000000
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

// 공개 상세와 개설자 미리보기가 공유하는 합성이다. 승인 전 미리보기가 후원을 받아 버리면
// 안 되므로, 이 두 동작이 이 컴포넌트의 핵심 계약이다.
describe('ProjectDetailView', () => {
  it('interactive가 false이면 후원 버튼(리워드 카드의 펀딩 링크)을 그리지 않는다', () => {
    render(<ProjectDetailView project={project} state="live" status={null} interactive={false} />);
    expect(screen.queryByRole('link', { name: /이 리워드로 펀딩하기/ })).toBeNull();
    // 히어로의 "펀딩하기" 스크롤 CTA도 마찬가지로 없어야 한다.
    expect(screen.queryByRole('link', { name: '펀딩하기' })).toBeNull();
  });

  it('interactive가 true이고 상태가 live면 후원 버튼을 그린다', () => {
    render(<ProjectDetailView project={project} state="live" status={{ pledgedAmount: 0, backerCount: 0 }} interactive />);
    expect(screen.getByRole('link', { name: /이 리워드로 펀딩하기/ })).toBeInTheDocument();
  });

  it('status가 null이면 진행률 숫자 대신 미리보기 표시를 낸다', () => {
    render(<ProjectDetailView project={project} state="live" status={null} interactive={false} />);
    expect(screen.getByText(/미리보기/)).toBeInTheDocument();
    // 실제 모금액 형식(예: "0원")은 그리지 않는다.
    expect(screen.queryByText('0원')).toBeNull();
  });

  it('status가 있으면 실제 모금 현황 숫자를 그린다', () => {
    render(
      <ProjectDetailView
        project={project}
        state="live"
        status={{ pledgedAmount: 450000, backerCount: 12 }}
        interactive
      />,
    );
    expect(screen.getByText('450,000원')).toBeInTheDocument();
    // Math.floor(450000 / 1000000 * 100) = 45
    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });
});
