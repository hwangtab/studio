import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// editSections.test.tsx와 같은 이유·같은 처방 — 페이지 모듈이 GSSP용으로 creatorAuth(iron-session → uncrypto ESM)와
// DB 모듈을 최상위에서 물고 있다. 이 파일은 클라이언트 컴포넌트만 렌더한다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/shows/organizer/submissions', () => ({ loadSubmissionForCreator: jest.fn() }));
jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/ko/funding/creator/shows/sub-1',
    events: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
    beforePopState: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import ShowSubmissionEditor, { type EditorShowSubmission } from '../../../../pages/[locale]/funding/creator/shows/[id]';
// eslint-disable-next-line import/first
import { emptyDraft } from '../../../../lib/shows/organizer/draft';

const DRAFT = {
  ...emptyDraft(),
  title: '가을 공연',
  presenterName: '주최',
  description: '소개',
  ageRating: '전체 관람가',
  runningMinutes: 90,
  venueName: '스튜디오 놀',
  venueAddress: '서울',
  showtimes: ['2026-11-20T19:30'],
  capacity: 50,
  ticketTypes: [{ name: '일반', price: 20000 }],
  performers: [{ name: '출연자', bio: '', photoUrl: null }],
};

const sub = (over: Partial<EditorShowSubmission> = {}): EditorShowSubmission => ({
  id: 'sub-1', reviewStatus: 'draft', reviewNote: null, draft: DRAFT, showSlug: null, ...over,
});

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

it('승인된 공연은 판매 조건 칸만 잠기고, 내용 칸은 열려 있다', () => {
  render(<ShowSubmissionEditor submission={sub({ reviewStatus: 'approved', showSlug: 'autumn' })} />);
  expect(screen.getByLabelText(/공연 제목/)).toBeEnabled();
  expect(screen.getByLabelText(/공연 소개/)).toBeEnabled();
  expect(screen.getByLabelText(/관람 등급/)).toBeDisabled();
  expect(screen.getByLabelText(/공연 시간/)).toBeDisabled();
  expect(screen.getByLabelText(/공연장 이름/)).toBeDisabled();
  expect(screen.getByLabelText('1회차')).toBeDisabled();
  expect(screen.getByLabelText(/정원/)).toBeDisabled();
  expect(screen.getByLabelText('가격(원)')).toBeDisabled();
  expect(screen.getAllByText('판매 조건은 운영자에게 요청해 주세요.').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: '공개된 페이지 보기' })).toHaveAttribute('href', '/ko/shows/autumn');
  // 승인 뒤에는 제출이 없다.
  expect(screen.queryByRole('button', { name: '제출하기' })).not.toBeInTheDocument();
});

it('심사 중에는 모든 칸이 잠기고 철회 버튼이 보인다', () => {
  render(<ShowSubmissionEditor submission={sub({ reviewStatus: 'submitted' })} />);
  expect(screen.getByLabelText(/공연 제목/)).toBeDisabled();
  expect(screen.queryByRole('button', { name: '임시 저장' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '제출 철회' })).toBeInTheDocument();
});

it('운영자 메모가 있으면 맨 위에 보인다', () => {
  render(<ShowSubmissionEditor submission={sub({ reviewStatus: 'changes_requested', reviewNote: '포스터를 바꿔 주세요' })} />);
  expect(screen.getByText('포스터를 바꿔 주세요')).toBeInTheDocument();
});

it('제출은 약관 동의 전에는 막히고, 서버가 준 problems를 목록으로 보여 준다', async () => {
  const fetchMock = jest.fn((url: string) =>
    url.endsWith('/submit')
      ? ok({ ok: false, message: '빠진 칸이 있어요.', problems: ['포스터를 올려 주세요.'] }, 400)
      : ok({ ok: true }),
  );
  global.fetch = fetchMock as unknown as typeof fetch;
  render(<ShowSubmissionEditor submission={sub()} />);

  const submitButton = screen.getByRole('button', { name: '제출하기' });
  expect(submitButton).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  // 입력을 바꿔 두면 제출 전에 먼저 저장한다(제출 API는 저장된 초안을 검사한다).
  fireEvent.change(screen.getByLabelText(/공연 제목/), { target: { value: '새 제목' } });
  fireEvent.click(submitButton);

  expect(await screen.findByText('포스터를 올려 주세요.')).toBeInTheDocument();
  const urls = fetchMock.mock.calls.map((c) => c[0]);
  expect(urls).toEqual(['/api/funding/creator/shows/sub-1', '/api/funding/creator/shows/sub-1/submit']);
  expect(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string)).toEqual({ agreedTerms: true });
});

it('제출이 성공하면 심사 중 상태로 바뀐다', async () => {
  global.fetch = jest.fn(() => ok({ ok: true })) as unknown as typeof fetch;
  render(<ShowSubmissionEditor submission={sub()} />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '제출하기' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '제출 철회' })).toBeInTheDocument());
  expect(screen.getByLabelText(/공연 제목/)).toBeDisabled();
});

it('출연진 순서를 바꾸고, 회차·티켓 종류를 더하고 지울 수 있다', () => {
  const two = { ...DRAFT, performers: [{ name: '가', bio: '', photoUrl: null }, { name: '나', bio: '', photoUrl: null }] };
  render(<ShowSubmissionEditor submission={sub({ draft: two })} />);
  fireEvent.click(screen.getAllByRole('button', { name: '아래로' })[0]);
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['나', '가']);

  fireEvent.click(screen.getByRole('button', { name: /회차 추가/ }));
  expect(screen.getByLabelText('2회차')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '2회차 지우기' }));
  expect(screen.queryByLabelText('2회차')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /티켓 종류 추가/ }));
  expect(screen.getAllByLabelText('가격(원)')).toHaveLength(2);
});
