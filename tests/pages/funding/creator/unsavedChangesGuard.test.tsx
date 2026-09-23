import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// editSections.test.tsx와 같은 이유·같은 처방 — 이 페이지 모듈이 최상위에서 물고 있는
// lib/funding/creatorAuth(iron-session → uncrypto ESM)가 jsdom 트랜스폼 밖이라 목으로 막는다.
jest.mock('../../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn() }));
jest.mock('../../../../lib/funding/creatorProjectWrite', () => ({ loadProjectForCreator: jest.fn() }));

/**
 * 라우트 이벤트 등록을 그대로 저장해 뒀다가 테스트가 직접 발화시킨다 — 실제 Next 라우터가
 * 없는 렌더 환경에서 "링크를 눌러 앱 내부 이동이 일어났다"를 흉내 내는 유일한 방법이다
 * (components/layout/Header.test.tsx와 같은 패턴).
 */
const routeHandlers: Record<string, Array<(url: string) => void>> = {};
const routeChangeError = jest.fn();
/** 마지막으로 등록된 beforePopState 콜백 — router.beforePopState(cb)가 부를 때마다 갱신된다. */
let beforePopStateCallback: (() => boolean) = () => true;
const mockRouter = {
  asPath: '/ko/funding/creator/proj-1',
  events: {
    on: (event: string, cb: (url: string) => void) => {
      (routeHandlers[event] ||= []).push(cb);
    },
    off: (event: string, cb: (url: string) => void) => {
      routeHandlers[event] = (routeHandlers[event] || []).filter((h) => h !== cb);
    },
    emit: routeChangeError,
  },
  beforePopState: (cb: () => boolean) => {
    beforePopStateCallback = cb;
  },
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));

// eslint-disable-next-line import/first
import CreatorProjectEditor from '../../../../pages/[locale]/funding/creator/[id]';
// eslint-disable-next-line import/first
import type { EditorProject } from '../../../../components/funding/creator/types';

const DRAFT_PROJECT: EditorProject = {
  id: 'proj-1',
  // 'draft-'로 시작하면 BasicSectionForm이 미리 채워진 임시 주소로 보고 필드를 비운다
  // (isDraftPlaceholderSlug) — 그러면 필수(required) 칸이 빈 채로 남아 브라우저 기본
  // 유효성 검사가 폼 제출 자체를 막는다. 저장 흐름을 보려는 테스트라 실제 주소를 쓴다.
  slug: 'live-project',
  title: '기존 제목',
  summary: '기존 요약',
  content: '본문',
  coverUrl: '/api/funding/media/cover.webp',
  goalAmount: 1_000_000,
  startAt: '2026-09-01',
  endAt: '2026-10-01',
  reviewStatus: 'draft',
  reviewNote: null,
  creator: { name: '개설자', contactName: null, phone: null, bio: null, links: null },
  rewards: [],
};

/** 마지막으로 등록된 routeChangeStart 핸들러를 부른다 — 링크 클릭 한 번을 흉내 낸다. */
const triggerRouteChangeStart = (url = '/ko/funding/creator') => {
  const handler = routeHandlers.routeChangeStart?.at(-1);
  if (!handler) throw new Error('routeChangeStart 핸들러가 등록되지 않았다');
  handler(url);
};

const originalFetch = global.fetch;
let confirmSpy: jest.SpyInstance;

beforeEach(() => {
  routeHandlers.routeChangeStart = [];
  routeChangeError.mockClear();
  beforePopStateCallback = () => true;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});


/**
 * 정산 정보 구획이 화면에 받는 전부 — 미등록 상태. 이 테스트들은 정산 구획을 보지 않으므로
 * 가장 조용한 값을 넣는다(구획 자체의 동작은 payoutSection.test.tsx가 본다).
 */
const UNREGISTERED_PAYOUT = { registered: false, accountLast4: null, taxType: null } as const;

describe('저장하지 않은 입력 — 앱 내부 이동(routeChangeStart) 가드', () => {
  it('아무것도 안 바꿨으면 이동을 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    expect(() => triggerRouteChangeStart()).not.toThrow();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('입력을 바꾸면 이동 시 confirm이 뜬다 — 취소하면 이동이 막힌다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    expect(() => triggerRouteChangeStart()).toThrow();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Pages Router에 이동을 취소하는 공식 API가 없어 routeChangeError를 emit하고 예외를
    // 던지는 방식으로 강제 중단한다 — 그 emit이 실제로 일어났는지도 함께 본다.
    expect(routeChangeError).toHaveBeenCalledWith('routeChangeError');
  });

  it('confirm에서 확인을 누르면 이동을 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    expect(() => triggerRouteChangeStart()).not.toThrow();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('저장하면 이동 가드가 풀린다', async () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });
    fireEvent.click(screen.getByRole('button', { name: '기본정보 저장' }));

    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    // 저장 성공은 폼(BasicSectionForm) 자신의 렌더에서 즉시 dirty=false로 잡히지만, 그
    // 사실이 부모의 dirtyTabs 집계로 올라가는 것은 그다음 커밋(onDirtyChange 이펙트)이다
    // — "저장했습니다."가 보이는 바로 그 순간과 부모가 반영하는 순간 사이에 커밋 한 틱
    // 차이가 있을 수 있어 waitFor로 그 틱까지 기다린다.
    await waitFor(() => expect(() => triggerRouteChangeStart()).not.toThrow());
  });

  it('탭 전환은 막지 않는다 — 폼이 항상 마운트돼 있어 입력이 살아 있다', () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });
    fireEvent.click(screen.getByRole('tab', { name: '스토리' }));
    fireEvent.click(screen.getByRole('tab', { name: '기본정보' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText('제목', { exact: false })).toHaveValue('고친 제목');
  });

  it('개설자 정보 구획 — 공백·줄바꿈만 다른 입력을 저장해도 dirty가 풀린다', async () => {
    // submit이 contactName.trim()·links.filter(Boolean) 등으로 정규화한 값을 서버로
    // 보내는데, 저장 성공 후 로컬 입력을 그 정규화된 값으로 되돌리지 않으면 "원문 vs
    // 정규화된 initial"을 영원히 비교하게 되어 dirty가 절대 안 풀린다(2026-09-22 리뷰
    // 지적, CreatorSectionForm.tsx:43-48 vs 56-73). 링크 칸에 trailing 개행을 남겨
    // 그 정규화가 실제로 일어나는 값으로 재현한다.
    confirmSpy = jest.spyOn(window, 'confirm');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;

    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.click(screen.getByRole('tab', { name: '개설자 정보' }));
    fireEvent.change(screen.getByLabelText('링크', { exact: false }), { target: { value: 'https://x\n' } });
    fireEvent.click(screen.getByRole('button', { name: '개설자 정보 저장' }));

    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());
    await waitFor(() => expect(() => triggerRouteChangeStart()).not.toThrow());
  });

  it('개설자 정보 구획 — 저장 요청이 도는 동안 이어서 친 입력은 응답이 덮어쓰지 않는다', async () => {
    // 저장 버튼만 saving으로 잠기고 입력 칸은 계속 활성이라(disabled={readOnly}만),
    // 왕복 100~500ms 사이에 이어서 타이핑하는 것이 실제로 걸린다. 응답이 그 값을
    // 무조건 덮어쓰면 이 태스크가 막으려던 것과 같은 모양의 조용한 입력 유실이 된다
    // (2026-09-22 2차 리뷰 지적). fetch를 직접 제어해 "응답 도착 전에 이어서 입력"을
    // 재현한다.
    confirmSpy = jest.spyOn(window, 'confirm');
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;

    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.click(screen.getByRole('tab', { name: '개설자 정보' }));
    const bioField = screen.getByLabelText('소개', { exact: false });
    fireEvent.change(bioField, { target: { value: '첫 문장.' } });
    fireEvent.click(screen.getByRole('button', { name: '개설자 정보 저장' }));

    // 응답이 아직 안 왔다 — 그 사이 이어서 입력한다.
    fireEvent.change(bioField, { target: { value: '첫 문장. 이어서 쓴 문장.' } });

    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    // 이어서 친 입력이 살아 있어야 하고, 그 값은 서버에 보낸(제출 시점) 값과 다르므로
    // dirty도 열린 채 남아야 한다 — 이탈 가드가 계속 경고해야 한다.
    expect(bioField).toHaveValue('첫 문장. 이어서 쓴 문장.');
    expect(() => triggerRouteChangeStart()).toThrow();
  });

  it('기본정보 구획 — 저장 요청이 도는 동안 이어서 고친 주소(slug)는 응답이 덮어쓰지 않는다', async () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as unknown as typeof fetch;

    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    const slugField = screen.getByLabelText('주소(slug)', { exact: false });
    fireEvent.change(slugField, { target: { value: 'New-Slug' } });
    fireEvent.click(screen.getByRole('button', { name: '기본정보 저장' }));

    // 응답이 아직 안 왔다 — 그 사이 이어서 고친다.
    fireEvent.change(slugField, { target: { value: 'New-Slug-Continued' } });

    resolveFetch({ ok: true, json: async () => ({ ok: true }) });
    await waitFor(() => expect(screen.getByText('저장했습니다.')).toBeInTheDocument());

    expect(slugField).toHaveValue('New-Slug-Continued');
    expect(() => triggerRouteChangeStart()).toThrow();
  });
});

describe('저장하지 않은 입력 — 브라우저 이탈(beforeunload) 가드', () => {
  it('dirty일 때만 beforeunload 리스너를 등록하고, 언마운트하면 해제한다', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { unmount } = render(
      <CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />,
    );
    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});

describe('저장하지 않은 입력 — 브라우저 뒤로/앞으로가기(beforePopState) 가드', () => {
  it('아무것도 안 바꿨으면 popstate를 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    expect(beforePopStateCallback()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('입력을 바꾼 뒤 취소하면 popstate를 거부하고 주소창을 제자리로 되돌린다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const forwardSpy = jest.spyOn(window.history, 'forward').mockImplementation(() => {});
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    // Next 내부(onPopState)는 브라우저가 이미 히스토리를 옮긴 뒤 이 콜백을 부른다 —
    // false를 반환해 이동을 거부하는 것과 별개로, 이미 바뀐 주소창을 원위치로 되돌려야
    // 화면(편집기)과 주소가 어긋나지 않는다(2026-09-22 리뷰 지적).
    expect(beforePopStateCallback()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
  });

  it('입력을 바꾼 뒤 확인을 누르면 popstate를 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const forwardSpy = jest.spyOn(window.history, 'forward').mockImplementation(() => {});
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} payout={UNREGISTERED_PAYOUT} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    expect(beforePopStateCallback()).toBe(true);
    expect(forwardSpy).not.toHaveBeenCalled();
  });
});

/**
 * 모금 현황은 **읽기 전용 구획**이라 이탈 가드와 무관해야 한다. 탭(TABS·dirtyTabs) 바깥에
 * 두었으므로 구획이 떠 있어도 dirty가 되지 않고, 구획이 있든 없든 가드는 같게 동작한다.
 */
describe('모금 현황 구획은 이탈 가드를 건드리지 않는다', () => {
  const STATS = {
    raisedAmount: 100_000,
    goalAmount: 1_000_000,
    percent: 10,
    backerCount: 3,
    rewards: [{ rewardId: 'cd', title: 'CD', quantity: 3, totalQuantity: 100 }],
  };

  it('현황 구획이 떠 있어도 아무것도 안 바꿨으면 이동을 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    render(
      <CreatorProjectEditor
        project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false}
        payout={UNREGISTERED_PAYOUT} stats={STATS}
      />,
    );

    expect(screen.getByRole('heading', { name: '모금 현황' })).toBeInTheDocument();
    expect(() => triggerRouteChangeStart()).not.toThrow();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('현황 구획이 떠 있어도 입력을 바꾸면 가드는 그대로 걸린다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <CreatorProjectEditor
        project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false}
        payout={UNREGISTERED_PAYOUT} stats={STATS}
      />,
    );

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    expect(() => triggerRouteChangeStart()).toThrow();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it('승인 전(stats 없음)에는 구획 자체가 없다', () => {
    render(
      <CreatorProjectEditor
        project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false}
        payout={UNREGISTERED_PAYOUT} stats={null}
      />,
    );
    expect(screen.queryByRole('heading', { name: '모금 현황' })).not.toBeInTheDocument();
  });
});
