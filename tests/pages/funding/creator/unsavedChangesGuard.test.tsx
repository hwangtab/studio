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
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('저장하지 않은 입력 — 앱 내부 이동(routeChangeStart) 가드', () => {
  it('아무것도 안 바꿨으면 이동을 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm');
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} />);

    expect(() => triggerRouteChangeStart()).not.toThrow();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('입력을 바꾸면 이동 시 confirm이 뜬다 — 취소하면 이동이 막힌다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });

    expect(() => triggerRouteChangeStart()).toThrow();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Pages Router에 이동을 취소하는 공식 API가 없어 routeChangeError를 emit하고 예외를
    // 던지는 방식으로 강제 중단한다 — 그 emit이 실제로 일어났는지도 함께 본다.
    expect(routeChangeError).toHaveBeenCalledWith('routeChangeError');
  });

  it('confirm에서 확인을 누르면 이동을 막지 않는다', () => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} />);

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

    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} />);

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
    render(<CreatorProjectEditor project={DRAFT_PROJECT} earliestStartDate="2026-08-25" nameLocked={false} />);

    fireEvent.change(screen.getByLabelText('제목', { exact: false }), { target: { value: '고친 제목' } });
    fireEvent.click(screen.getByRole('tab', { name: '스토리' }));
    fireEvent.click(screen.getByRole('tab', { name: '기본정보' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByLabelText('제목', { exact: false })).toHaveValue('고친 제목');
  });
});
