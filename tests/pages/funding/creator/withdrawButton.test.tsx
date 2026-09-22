import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// editSections.test.tsx와 같은 이유·같은 처방 — 이 페이지 모듈이 최상위에서 물고 있는
// lib/funding/creatorAuth(iron-session → uncrypto ESM)가 jsdom 트랜스폼 밖이라 목으로 막는다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

// editSections.test.tsx와 같은 이유·같은 처방 — 이 페이지가 이탈 가드용 useRouter()를 부른다.
jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/ko/funding/creator/proj-1',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
  }),
}));

// eslint-disable-next-line import/first
import CreatorProjectEditor from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import type { EditorProject } from '../../../../components/funding/creator/types';

/**
 * 심사 철회(withdraw) 버튼이 `submitted` 상태에서만 보이고, 눌렀을 때
 * `/api/funding/creator/projects/{id}/withdraw`를 부르고 성공하면 화면 상태가 draft로
 * 바뀌는지를 본다. 전이표(`lib/funding/reviewTransition.ts`)에는 이 액션이 있었는데 그것을
 * 부르는 API도 UI도 없었다 — 이 테스트가 그 배선을 고정한다.
 */
const SUBMITTED_PROJECT: EditorProject = {
  id: 'proj-1',
  slug: 'live-project',
  title: '제출된 프로젝트',
  summary: '요약',
  content: '본문'.repeat(100),
  coverUrl: '/api/funding/media/cover.webp',
  goalAmount: 1_000_000,
  startAt: '2026-09-01',
  endAt: '2026-10-01',
  reviewStatus: 'submitted',
  reviewNote: null,
  creator: { name: '개설자', contactName: null, phone: null, bio: null, links: null },
  rewards: [],
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it('submitted 상태에서는 철회 버튼과 철회 가능 안내가 보인다', () => {
  render(<CreatorProjectEditor project={SUBMITTED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);
  expect(screen.getByRole('button', { name: /심사 신청 철회/ })).toBeInTheDocument();
  expect(screen.getByText(/철회하고 다시 작성할 수 있습니다/)).toBeInTheDocument();
});

it('draft 상태에서는 철회 버튼이 없다', () => {
  render(<CreatorProjectEditor project={{ ...SUBMITTED_PROJECT, reviewStatus: 'draft' }} earliestStartDate="2026-09-25" nameLocked={false} />);
  expect(screen.queryByRole('button', { name: /심사 신청 철회/ })).not.toBeInTheDocument();
});

it('철회 버튼을 누르면 withdraw API를 부르고, 성공하면 draft로 돌아가 철회 버튼이 사라진다', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });
  render(<CreatorProjectEditor project={SUBMITTED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);

  fireEvent.click(screen.getByRole('button', { name: /심사 신청 철회/ }));

  await waitFor(() => {
    expect(screen.getByText(/심사 신청을 철회했습니다/)).toBeInTheDocument();
  });
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/funding/creator/projects/proj-1/withdraw',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(screen.queryByRole('button', { name: /심사 신청 철회/ })).not.toBeInTheDocument();
});

it('철회 후 같은 화면에서 재제출하면 철회 버튼이 다시 나타나고, "철회했습니다" 문구는 사라진다 (I1 회귀)', async () => {
  // handleSubmitReview가 handleWithdraw와 대칭으로 withdraw 상태를 초기화하지 않으면:
  // 철회(withdraw.status='success') → 재제출(reviewStatus='submitted') 뒤에도
  // withdraw.status가 'success'로 남아 철회 버튼 블록이 (withdraw.status !== 'success'
  // 조건에 걸려) 다시 그려지지 않고, "심사 신청을 철회했습니다"와 "심사를 신청했습니다"가
  // 동시에 뜬다. 상단 안내("아래에서 철회할 수 있습니다")가 거짓이 되는 상태다.
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }) // withdraw
    .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // submit

  render(<CreatorProjectEditor project={SUBMITTED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);

  fireEvent.click(screen.getByRole('button', { name: /심사 신청 철회/ }));
  await waitFor(() => {
    expect(screen.getByText(/심사 신청을 철회했습니다/)).toBeInTheDocument();
  });

  // draft로 돌아왔으니 재제출할 수 있다 — 약관 동의 체크 후 심사 신청.
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '심사 신청' }));

  await waitFor(() => {
    expect(screen.getByText('심사를 신청했습니다.')).toBeInTheDocument();
  });
  // "철회했습니다" 문구는 남아 있으면 안 된다 — 방금 다시 제출했다.
  expect(screen.queryByText(/심사 신청을 철회했습니다/)).not.toBeInTheDocument();
  // 다시 submitted 상태이므로 철회 버튼이 되돌아와야 한다 — 안내가 "철회할 수 있다"고
  // 말하는 상태에서 버튼이 없으면 그 안내가 거짓이 된다.
  expect(screen.getByRole('button', { name: /심사 신청 철회/ })).toBeInTheDocument();
});

it('철회가 실패하면 서버 메시지를 그대로 보여주고 버튼은 그대로 남는다', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, message: '지금 상태에서는 철회할 수 없습니다.' }),
  });
  render(<CreatorProjectEditor project={SUBMITTED_PROJECT} earliestStartDate="2026-09-25" nameLocked={false} />);

  fireEvent.click(screen.getByRole('button', { name: /심사 신청 철회/ }));

  await waitFor(() => {
    expect(screen.getByText('지금 상태에서는 철회할 수 없습니다.')).toBeInTheDocument();
  });
  expect(screen.getByRole('button', { name: /심사 신청 철회/ })).toBeInTheDocument();
});
