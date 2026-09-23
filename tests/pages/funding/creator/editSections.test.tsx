import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// 이 페이지 모듈은 최상위에서 `lib/funding/creatorAuth`를 import한다(getServerSideProps용) —
// 그 파일이 물고 있는 iron-session → uncrypto(ESM)가 jsdom 트랜스폼 밖이라 그대로 두면
// 파싱이 깨진다. `tests/pages/funding/creator/edit.test.ts`와 같은 이유·같은 처방이다.
// 이 파일은 default export(클라이언트 컴포넌트)만 렌더하므로 실제 구현은 필요 없다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

// 이 페이지는 이탈 가드(routeChangeStart)를 걸려고 useRouter()를 부른다 — RouterContext
// provider 없이 렌더하면 next/router가 "NextRouter was not mounted"를 던진다
// (components/layout/Header.test.tsx와 같은 처방).
jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/ko/funding/creator/proj-1',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
    beforePopState: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import CreatorProjectEditor from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import type { EditorProject } from '../../../../components/funding/creator/types';

/**
 * `pages/[locale]/funding/creator/[id].tsx`의 구획별 잠금(`ro()`)·필드 잠금(`lockedFields`)이
 * 실제로 화면에 배선됐는지를 본다. 진리표 대조(`components/funding/creator/types.test.ts`)는
 * 순수 함수 두 개가 같은 답을 내는지만 보고, `readOnly={ro('rewards')}`를
 * `readOnly={false}`로 바꿔도 통과한다 — 이 파일은 그 배선 자체를 DOM으로 검증한다
 * (리뷰 지적, 2026-09-21).
 */

const APPROVED_PROJECT: EditorProject = {
  id: 'proj-1',
  slug: 'live-project',
  title: '기존 제목',
  summary: '기존 요약',
  content: '본문'.repeat(100),
  coverUrl: '/api/funding/media/cover.webp',
  goalAmount: 1_000_000,
  startAt: '2026-09-01',
  endAt: '2026-10-01',
  reviewStatus: 'approved',
  reviewNote: null,
  creator: { name: '개설자', contactName: null, phone: null, bio: null, links: null },
  rewards: [
    {
      rewardId: 'basic', title: '기본 리워드', description: '설명', amount: 10_000,
      totalQuantity: null, requiresShipping: false, estimatedDelivery: '2026-11', imageUrl: null,
      locked: true,
    },
  ],
};

const DRAFT_PROJECT: EditorProject = {
  ...APPROVED_PROJECT,
  reviewStatus: 'draft',
  rewards: [{ ...APPROVED_PROJECT.rewards[0], locked: false }],
};

describe('승인된 프로젝트 — 구획별·필드별 잠금이 화면에 배선됐다', () => {
  it('기본정보: 제목은 활성, 주소(slug)는 비활성이고 잠금 사유가 보인다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    // required 필드 라벨은 텍스트 끝에 "*" 배지가 붙어(<span aria-hidden>) 정확히 일치하지
    // 않는다 — exact: false로 부분 일치시킨다.
    expect(screen.getByLabelText('제목', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('한 줄 요약', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('주소(slug)', { exact: false })).toBeDisabled();
    expect(screen.getByLabelText('목표 금액', { exact: false })).toBeDisabled();
    expect(screen.getByLabelText('시작일', { exact: false })).toBeDisabled();
    expect(screen.getByLabelText('종료일', { exact: false })).toBeDisabled();
    expect(
      screen.getByText(/공개된 뒤에는 바꿀 수 없습니다 — 후원자가 이 주소로 프로젝트를 찾고/),
    ).toBeInTheDocument();
  });

  it('스토리 구획은 열려 있다(승인 뒤에도 편집 가능)', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '스토리' }));
    expect(screen.getByLabelText('본문(마크다운)')).toBeEnabled();
  });

  it('리워드 구획은 통째로 읽기 전용이다 — 추가 버튼이 비활성', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '리워드' }));
    expect(screen.getByRole('button', { name: '리워드 추가' })).toBeDisabled();
  });

  it('개설자 정보(계정 프로필)는 항상 편집 가능하다 — 이 표를 타지 않는다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '개설자 정보' }));
    expect(screen.getByLabelText('공개 이름', { exact: false })).toBeEnabled();
  });

  it('상단 안내가 승인 상태를 사실대로 말한다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    expect(screen.getByText(/공개된 프로젝트입니다/)).toBeInTheDocument();
  });

  it('심사 신청 버튼과 약관 동의 체크박스는 비활성이다 — 이미 공개된 프로젝트는 다시 신청할 수 없다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    expect(screen.getByRole('button', { name: '심사 신청' })).toBeDisabled();
    // 버튼은 "약관 미동의"만으로도 항상 비활성 상태로 시작해 canSubmitForReview 자체의
    // 회귀를 못 잡는다 — 체크박스는 약관 동의 여부와 무관하게 canSubmitForReview만 본다.
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('draft 프로젝트라면 같은 체크박스가 활성이다 — 대조군', () => {
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });
});

describe('개설자 이름 잠금 안내 — nameLocked prop 배선', () => {
  it('nameLocked=true면 이름 칸이 비활성이고 이유가 보인다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked />);
    fireEvent.click(screen.getByRole('tab', { name: '개설자 정보' }));
    expect(screen.getByLabelText('공개 이름', { exact: false })).toBeDisabled();
    expect(screen.getByText(/승인된 프로젝트가 있어 이름은 바꿀 수 없습니다/)).toBeInTheDocument();
  });

  it('nameLocked=false면 이름 칸이 활성이고 이유 문구가 없다', () => {
    render(<CreatorProjectEditor project={APPROVED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '개설자 정보' }));
    expect(screen.getByLabelText('공개 이름', { exact: false })).toBeEnabled();
    expect(screen.queryByText(/승인된 프로젝트가 있어 이름은 바꿀 수 없습니다/)).not.toBeInTheDocument();
  });
});

describe('작성 중(draft) 프로젝트 — 대조군, 전부 편집 가능해야 한다', () => {
  it('기본정보 구획의 모든 필드가 활성이다', () => {
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    expect(screen.getByLabelText('제목', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('주소(slug)', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('목표 금액', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('시작일', { exact: false })).toBeEnabled();
    expect(screen.getByLabelText('종료일', { exact: false })).toBeEnabled();
    expect(screen.queryByText(/공개된 뒤에는 바꿀 수 없습니다/)).not.toBeInTheDocument();
  });

  it('리워드 추가 버튼이 활성이다', () => {
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
    fireEvent.click(screen.getByRole('tab', { name: '리워드' }));
    expect(screen.getByRole('button', { name: '리워드 추가' })).toBeEnabled();
  });
});
