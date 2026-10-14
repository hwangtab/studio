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

/** 업로드 응답을 손으로 풀어 주는 fetch — 업로드가 도는 사이에 다른 칸을 고친다. */
const deferredUploadFetch = () => {
  const pending: Array<(url: string) => void> = [];
  const fetchMock = jest.fn((url: string) => {
    if (url.includes('/upload?')) {
      return new Promise<Response>((resolve) => {
        pending.push((u) => resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, url: u }) } as Response));
      });
    }
    return ok({ ok: true });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, pending };
};

const pickFile = (input: HTMLElement) =>
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] } });

const putBody = (fetchMock: jest.Mock) => {
  const call = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
  return JSON.parse((call![1] as RequestInit).body as string);
};

it('포스터 업로드가 도는 사이에 고친 소개가 업로드 완료로 지워지지 않는다', async () => {
  const { pending } = deferredUploadFetch();
  render(<ShowSubmissionEditor submission={sub()} />);
  pickFile(screen.getByLabelText('포스터'));
  fireEvent.change(screen.getByLabelText(/공연 소개/), { target: { value: '고친 소개' } });
  await waitFor(() => expect(pending).toHaveLength(1));
  pending[0]('/api/funding/media/c-poster.webp');
  await waitFor(() => expect(document.querySelector('img[src="/api/funding/media/c-poster.webp"]')).not.toBeNull());
  expect(screen.getByLabelText(/공연 소개/)).toHaveValue('고친 소개');
});

it('출연진 B의 사진은 업로드 중에 B를 위로 옮겨도 B에 붙는다', async () => {
  const { pending } = deferredUploadFetch();
  const ab = { ...DRAFT, performers: [{ name: 'A', bio: '', photoUrl: null }, { name: 'B', bio: '', photoUrl: null }] };
  render(<ShowSubmissionEditor submission={sub({ draft: ab })} />);
  pickFile(screen.getAllByLabelText('사진')[1]);
  await waitFor(() => expect(pending).toHaveLength(1));
  fireEvent.click(screen.getAllByRole('button', { name: '위로' })[1]);
  expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['B', 'A']);
  pending[0]('/api/funding/media/c-b.webp');
  const groupB = screen.getByRole('group', { name: 'B' });
  await waitFor(() => expect(groupB.querySelector('img[src="/api/funding/media/c-b.webp"]')).not.toBeNull());
  expect(screen.getByRole('group', { name: 'A' }).querySelector('img')).toBeNull();
});

it('저장 본문: 빈 회차 줄은 빠지고, 숫자 칸은 숫자 또는 null로 간다', async () => {
  const { fetchMock } = deferredUploadFetch();
  render(<ShowSubmissionEditor submission={sub()} />);
  fireEvent.click(screen.getByRole('button', { name: /회차 추가/ }));
  fireEvent.change(screen.getByLabelText(/정원/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('가격(원)'), { target: { value: '15000' } });
  fireEvent.click(screen.getByRole('button', { name: '임시 저장' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const body = putBody(fetchMock);
  expect(body.showtimes).toEqual(['2026-11-20T19:30']);
  expect(body.capacity).toBeNull();
  expect(body.runningMinutes).toBe(90);
  expect(body.ticketTypes).toEqual([{ name: '일반', price: 15000 }]);
  expect(body.performers).toEqual([{ name: '출연자', bio: '', photoUrl: null }]);
  expect(await screen.findByText('저장했어요.')).toBeInTheDocument();
});

it('환불표를 그 자리에 보이고, 전문은 주최자 약관으로 잇는다', () => {
  render(<ShowSubmissionEditor submission={sub()} />);
  expect(screen.getByText('환불 규정은 모든 공연이 같아요')).toBeInTheDocument();
  expect(screen.getByText(/— 100%$/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '주최자 약관 제7조' })).toHaveAttribute('href', '/ko/shows/organizer-terms');
  expect(screen.queryByRole('link', { name: '환불 규정 보기' })).not.toBeInTheDocument();
});

it('일정 안내 한 줄과 관람 안내는 승인 뒤에도 고칠 수 있다', async () => {
  const { fetchMock } = deferredUploadFetch();
  render(<ShowSubmissionEditor submission={sub({ reviewStatus: 'approved', showSlug: 'autumn' })} />);
  fireEvent.change(screen.getByLabelText('일정 안내 한 줄'), { target: { value: '18:30 입장' } });
  fireEvent.click(screen.getByRole('button', { name: /안내 추가/ }));
  fireEvent.change(screen.getByLabelText('안내 1'), { target: { value: '주차 공간이 없어요' } });
  fireEvent.click(screen.getByRole('button', { name: '임시 저장' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const body = putBody(fetchMock);
  expect(body.scheduleNote).toBe('18:30 입장');
  expect(body.notices).toEqual(['주차 공간이 없어요']);
});
