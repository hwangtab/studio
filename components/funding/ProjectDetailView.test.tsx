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

  // 미리보기 표시는 `interactive`로 갈린다 — `status`로 가르면 공개 페이지가 마운트 직후
  // (폴링 fetch 응답 전, status가 항상 null인 그 순간, 즉 SSG 정적 HTML)에도 "미리보기"
  // 문구를 그리는 회귀가 난다.
  it('interactive가 false이면 status가 있어도 진행률 숫자 대신 미리보기 표시를 낸다', () => {
    render(
      <ProjectDetailView
        project={project}
        state="live"
        status={{ pledgedAmount: 450000, backerCount: 12 }}
        interactive={false}
      />,
    );
    expect(screen.getByText(/미리보기 — 공개되면/)).toBeInTheDocument();
    expect(screen.queryByText('450,000원')).toBeNull();
  });

  it('interactive가 true이고 status가 null이면(폴링 응답 전) "미리보기"가 아니라 집계 중 표시를 낸다', () => {
    render(<ProjectDetailView project={project} state="live" status={null} interactive />);
    expect(screen.queryByText(/미리보기/)).toBeNull();
    expect(screen.getByText(/집계 중/)).toBeInTheDocument();
  });

  it('interactive가 true이고 status가 있으면 실제 모금 현황 숫자를 그린다', () => {
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

  it('목표를 초과 달성해도 100%로 자르지 않는다(서버 percent 공식과 동일)', () => {
    render(
      <ProjectDetailView
        project={project}
        state="live"
        status={{ pledgedAmount: 1_370_000, backerCount: 20 }}
        interactive
      />,
    );
    // Math.floor(1370000 / 1000000 * 100) = 137
    expect(screen.getByText(/137%/)).toBeInTheDocument();
  });

  // 전자상거래법상 판매자·개설자 구분 표시 (펀딩 약관 제4조). 마크다운 프로젝트는
  // frontmatter에 creator가 없으므로 project.creator는 항상 null이고, 이 표시가
  // 없어야 진행 중인 keep-singing-for-palestine 같은 기존 화면이 그대로 유지된다.
  describe('개설자 표시', () => {
    it('마크다운 프로젝트(creator: null)는 개설자 줄을 그리지 않는다', () => {
      expect(project.creator).toBeNull();
      render(<ProjectDetailView project={project} state="live" status={null} interactive={false} />);
      expect(screen.queryByText(/개설자/)).toBeNull();
    });

    it('개설자가 있으면 이름과 판매자·통신판매업 신고번호를 함께 보여준다', () => {
      const withCreator = { ...project, creator: { name: '아무개' } };
      render(<ProjectDetailView project={withCreator} state="live" status={null} interactive={false} />);
      expect(screen.getByText(/개설자 아무개 · 판매자 스튜디오 놀/)).toBeInTheDocument();
      expect(screen.getByText(/통신판매업 신고/)).toBeInTheDocument();
    });
  });
});
