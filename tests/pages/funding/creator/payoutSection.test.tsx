import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// editSections.test.tsx와 같은 이유·같은 처방 — 이 페이지 모듈이 최상위에서 물고 있는
// lib/funding/creatorAuth(iron-session → uncrypto ESM)가 jsdom 트랜스폼 밖이라 목으로 막는다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

/** unsavedChangesGuard.test.tsx와 같은 라우터 목 — 이탈 가드 참여를 그대로 재현하려면 필요하다. */
const routeHandlers: Record<string, Array<(url: string) => void>> = {};
const routeChangeError = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    asPath: '/ko/funding/creator/proj-1',
    events: {
      on: (event: string, cb: (url: string) => void) => { (routeHandlers[event] ||= []).push(cb); },
      off: (event: string, cb: (url: string) => void) => {
        routeHandlers[event] = (routeHandlers[event] || []).filter((h) => h !== cb);
      },
      emit: routeChangeError,
    },
    beforePopState: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import CreatorProjectEditor from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import type { EditorPayoutSummary, EditorProject } from '../../../../components/funding/creator/types';
// eslint-disable-next-line import/first
import {
  FUNDING_PAYMENT_FEE_PERCENT,
  FUNDING_PLATFORM_FEE_PERCENT,
  FUNDING_WITHHOLDING_PERCENT,
} from '../../../../data/pricing';
// eslint-disable-next-line import/first
import { FUNDING_PAYOUT_BUSINESS_DAYS } from '../../../../lib/funding/policy';

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
  rewards: [],
};

const DRAFT_PROJECT: EditorProject = { ...APPROVED_PROJECT, reviewStatus: 'draft' };
const UNREGISTERED: EditorPayoutSummary = {
  registered: false, accountLast4: null, taxType: null, residentNumberRegistered: false, withheldPayoutRecorded: false,
};

const renderEditor = (project: EditorProject, payout: EditorPayoutSummary = UNREGISTERED) =>
  render(<CreatorProjectEditor project={project} earliestStartDate="2026-09-25" nameLocked={false} payout={payout} />);

const openPayoutTab = () => fireEvent.click(screen.getByRole('tab', { name: '정산 정보' }));
const bankField = () => screen.getByLabelText('은행명', { exact: false });
const accountField = () => screen.getByLabelText('계좌번호', { exact: false });
const holderField = () => screen.getByLabelText('예금주', { exact: false });
const taxField = () => screen.getByLabelText('세금 유형', { exact: false });
const rrnField = () => screen.getByLabelText('주민등록번호', { exact: false });
const queryRrnField = () => screen.queryByLabelText('주민등록번호', { exact: false });

/** 마지막으로 등록된 routeChangeStart 핸들러를 부른다 — 링크 클릭 한 번을 흉내 낸다. */
const triggerRouteChangeStart = (url = '/ko/funding/creator') => {
  const handler = routeHandlers.routeChangeStart?.at(-1);
  if (!handler) throw new Error('routeChangeStart 핸들러가 등록되지 않았다');
  handler(url);
};

const originalFetch = global.fetch;

beforeEach(() => {
  routeHandlers.routeChangeStart = [];
  routeChangeError.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('정산 정보 구획 — 승인 뒤에만 열린다', () => {
  it('초안에서는 입력과 저장이 잠기고 왜 아직 못 넣는지가 보인다', () => {
    renderEditor(DRAFT_PROJECT);
    openPayoutTab();

    expect(bankField()).toBeDisabled();
    expect(accountField()).toBeDisabled();
    expect(holderField()).toBeDisabled();
    expect(screen.getByLabelText('세금 유형', { exact: false })).toBeDisabled();
    expect(screen.getByRole('button', { name: '정산 정보 저장' })).toBeDisabled();
    expect(screen.getByText('승인된 뒤에', { exact: false })).toBeInTheDocument();
  });

  it('승인된 프로젝트에서는 열린다', () => {
    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    expect(bankField()).toBeEnabled();
    expect(screen.getByRole('button', { name: '정산 정보 저장' })).toBeEnabled();
  });
});

describe('정산 정보 구획 — 화면 문구는 상수에서 온다', () => {
  it('정산 시점·플랫폼 수수료·원천징수율이 상수 값으로 적혀 있다', () => {
    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    expect(screen.getByText(`영업일 ${FUNDING_PAYOUT_BUSINESS_DAYS}일`, { exact: false })).toBeInTheDocument();
    // 결제 수수료율과 원천징수율이 우연히 같은 값(3.3%)이라 단순 `${percent}%` 검색은
    // 두 문단에 동시에 걸려 "multiple elements" 오류가 난다 — 항목별 접두어로 구분한다.
    expect(screen.getByText(`플랫폼 수수료 ${FUNDING_PLATFORM_FEE_PERCENT}%`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`결제 수수료 ${FUNDING_PAYMENT_FEE_PERCENT}%`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`지방소득세 ${FUNDING_WITHHOLDING_PERCENT}%`, { exact: false })).toBeInTheDocument();
  });
});

describe('정산 정보 구획 — 등록 상태 표시', () => {
  it('미등록이면 아직 없다고 말한다', () => {
    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    expect(screen.getByText('아직 등록된 계좌가 없습니다', { exact: false })).toBeInTheDocument();
  });

  it('등록됐으면 뒤 4자리만 보여 준다 — 입력 칸은 비어 있다', () => {
    renderEditor(APPROVED_PROJECT, { registered: true, accountLast4: '9012', taxType: 'invoice', residentNumberRegistered: false, withheldPayoutRecorded: false });
    openPayoutTab();

    expect(screen.getByText('9012', { exact: false })).toBeInTheDocument();
    // 서버가 값을 안 내려보내므로 칸은 늘 빈 채로 시작한다 — 바꿀 때 다시 입력해 덮어쓴다.
    expect(bankField()).toHaveValue('');
    expect(accountField()).toHaveValue('');
    expect(holderField()).toHaveValue('');
    // 세금 유형만은 값을 받는다(계좌가 아니다).
    expect(screen.getByLabelText('세금 유형', { exact: false })).toHaveValue('invoice');
  });
});

describe('정산 정보 구획 — 저장', () => {
  it('입력한 값을 section: payout으로 보내고, 성공하면 이탈 가드가 풀린다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: ' 123-456-789012 ' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });

    // 저장 전에는 이탈 가드가 걸려 있어야 한다 — 이 구획도 부모의 dirtyTabs에 참여한다.
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    expect(() => triggerRouteChangeStart()).toThrow();

    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/funding/creator/projects/proj-1');
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      section: 'payout',
      value: {
        taxType: 'withholding', bankName: '국민은행', account: '123-456-789012', holder: '황경하',
        residentNumber: '',
      },
    });

    // 정규화(trim)한 값으로 로컬 상태가 되돌아가 dirty가 풀린다 — 안 그러면 "원문 vs
    // 정규화" 비교가 남아 이탈 경고가 영영 뜬다.
    expect(accountField()).toHaveValue('123-456-789012');
    await waitFor(() => expect(() => triggerRouteChangeStart()).not.toThrow());

    // 등록 표시가 곧바로 갱신되고, 그 값은 뒤 4자리뿐이다.
    expect(screen.getByText('9012', { exact: false })).toBeInTheDocument();
  });

  it('저장 요청이 도는 동안 이어서 친 입력은 응답이 덮어쓰지 않는다', async () => {
    // 저장 버튼만 saving으로 잠기고 입력 칸은 계속 활성이라 실제로 걸리는 경로다
    // (2026-09-22에 이 브랜치에서 난 회귀와 같은 모양).
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-7890' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));

    // 응답이 아직 안 왔다 — 그 사이 계좌번호를 마저 고친다.
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });

    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    expect(accountField()).toHaveValue('123-456-789012');
    // 보낸 값과 지금 값이 다르므로 dirty는 열린 채 남아야 한다.
    expect(() => triggerRouteChangeStart()).toThrow();
  });

  it('서버가 형식 오류를 돌려주면 그 문구를 그대로 보여 준다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, message: '계좌번호는 숫자와 하이픈(-)만 넣어 주세요.' }),
    }) as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('숫자와 하이픈'));
  });
});

describe('정산 정보 구획 — 주민등록번호는 원천징수 대상만', () => {
  it('원천징수면 칸이 보이고 왜 받는지가 적혀 있다', () => {
    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    expect(rrnField()).toBeInTheDocument();
    expect(rrnField()).toHaveAttribute('autocomplete', 'off');
    expect(rrnField()).toHaveAttribute('inputmode', 'numeric');
    // 법적 근거를 화면이 말한다 — 근거 없는 수집으로 읽히면 안 된다.
    expect(screen.getByText('지급명세서', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('주민등록번호가 아직 등록되어 있지 않습니다', { exact: false })).toBeInTheDocument();
  });

  it('등록 상태는 등록됨/미등록뿐이다 — 값은 어떤 조각도 오지 않는다', () => {
    renderEditor(APPROVED_PROJECT, {
      registered: true, accountLast4: '9012', taxType: 'withholding', residentNumberRegistered: true, withheldPayoutRecorded: false,
    });
    openPayoutTab();

    expect(screen.getByText('주민등록번호가 등록되어 있습니다', { exact: false })).toBeInTheDocument();
    expect(rrnField()).toHaveValue('');
  });

  it('사업자를 고르면 칸이 사라지고, 기존 값이 지워진다는 것을 말한다', () => {
    renderEditor(APPROVED_PROJECT);
    openPayoutTab();

    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });

    expect(queryRrnField()).toBeNull();
    expect(screen.getByText('이미 등록된 번호도 함께 지워집니다', { exact: false })).toBeInTheDocument();
  });

  /**
   * 원천징수한 정산이 이미 기록된 개설자에게는 번호가 지워지지 않는다
   * (`lib/funding/creatorProjectWrite.ts`의 `hasWithheldPayout`). 화면이 그대로 "지워집니다"라고
   * 말하면 개설자는 규칙대로 행동했는데 화면이 거짓을 말한 것이 된다.
   */
  it('원천징수한 정산 기록이 있으면 "지워집니다"가 아니라 "보관됩니다"라고 말한다', () => {
    renderEditor(APPROVED_PROJECT, {
      registered: true, accountLast4: '9012', taxType: 'withholding',
      residentNumberRegistered: true, withheldPayoutRecorded: true,
    });
    openPayoutTab();

    expect(screen.getByText('등록된 번호는 그대로 보관됩니다', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('이미 등록된 번호도 지워집니다', { exact: false })).toBeNull();

    // 사업자로 바꿔도 같은 사실을 말한다 — 이쪽 문단이 개설자가 실제로 보게 되는 자리다.
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    expect(queryRrnField()).toBeNull();
    expect(screen.getByText('등록된 번호는 그대로 보관됩니다', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('이미 등록된 번호도 함께 지워집니다', { exact: false })).toBeNull();
  });

  it('사업자로 저장했는데 서버가 보관했다고 답하면 등록 표시가 유지된다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ ok: true, residentNumberRetained: true }),
    }) as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT, {
      registered: true, accountLast4: '9012', taxType: 'withholding',
      residentNumberRegistered: true, withheldPayoutRecorded: true,
    });
    openPayoutTab();
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    // 다시 원천징수로 돌려 보면 등록 상태가 살아 있다 — 지워졌다고 표시했다면 미등록이 된다.
    fireEvent.change(taxField(), { target: { value: 'withholding' } });
    expect(screen.getByText('주민등록번호가 등록되어 있습니다', { exact: false })).toBeInTheDocument();
  });

  it('사업자로 저장하면 주민등록번호 칸을 빈 문자열로 보낸다 — 키는 실리고 값은 비어 있다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.change(taxField(), { target: { value: 'invoice' } });
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.value.residentNumber).toBe('');
  });

  it('저장하면 입력 칸이 비고 이탈 가드가 풀린다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    expect(() => triggerRouteChangeStart()).toThrow();

    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    expect(rrnField()).toHaveValue('');
    await waitFor(() => expect(() => triggerRouteChangeStart()).not.toThrow());
    // 등록 표시가 곧바로 바뀐다 — 바뀌는 것은 불리언 하나다.
    expect(screen.getByText('주민등록번호가 등록되어 있습니다', { exact: false })).toBeInTheDocument();
  });

  it('저장이 도는 동안 이어서 친 주민등록번호는 응답이 지우지 않는다', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.change(rrnField(), { target: { value: '900101-123' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));

    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    expect(rrnField()).toHaveValue('900101-1234567');
    // 보낸 값과 지금 값이 다르므로 이탈 가드는 열린 채 남는다.
    expect(() => triggerRouteChangeStart()).toThrow();
  });

  it('암호화 키가 없어 503이 오면 서버가 준 문장을 그대로 보여 준다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        message: '서버의 암호화 설정 문제로 주민등록번호를 저장할 수 없습니다. 이번 저장은 계좌를 포함해 '
          + '아무것도 반영되지 않았습니다. 개설자님이 고치실 수 있는 문제가 아니니 스튜디오 놀에 알려 주세요.',
      }),
    }) as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('아무것도 반영되지 않았습니다'));
  });

  it('입력한 주민등록번호가 화면 어디에도 남지 않는다 — 저장 뒤 DOM 전체를 본다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    renderEditor(APPROVED_PROJECT);
    openPayoutTab();
    fireEvent.change(bankField(), { target: { value: '국민은행' } });
    fireEvent.change(accountField(), { target: { value: '123-456-789012' } });
    fireEvent.change(holderField(), { target: { value: '황경하' } });
    fireEvent.change(rrnField(), { target: { value: '900101-1234567' } });
    fireEvent.click(screen.getByRole('button', { name: '정산 정보 저장' }));
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    // 값 자체도, 뒤 7자리·앞 6자리 같은 조각도 남지 않는다.
    expect(document.body.innerHTML).not.toContain('1234567');
    expect(document.body.innerHTML).not.toContain('900101');
  });
});
