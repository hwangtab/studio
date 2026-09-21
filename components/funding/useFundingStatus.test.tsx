import { act, renderHook, waitFor } from '@testing-library/react';

import { useFundingStatus } from './useFundingStatus';

const jsonResponse = (body: unknown) => ({ ok: true, json: async () => body });

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// 마감된 프로젝트는 더 바뀔 값이 없다 — 5분마다 계속 두드릴 이유가 없다.
it('closed가 확인되면 폴링을 멈춘다', async () => {
  jest.useFakeTimers();
  const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ state: 'closed', remaining: {}, publicBackers: [] }));
  global.fetch = fetchMock as never;

  renderHook(() => useFundingStatus('demo', 'live'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  jest.advanceTimersByTime(15 * 60 * 1000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('live면 5분마다 다시 조회한다', async () => {
  jest.useFakeTimers();
  const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ state: 'live', remaining: {}, publicBackers: [] }));
  global.fetch = fetchMock as never;

  renderHook(() => useFundingStatus('demo', 'live'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

  jest.advanceTimersByTime(5 * 60 * 1000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('조회 실패는 error로만 알린다', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
  const { result } = renderHook(() => useFundingStatus('demo', 'closed'));
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.data).toBeNull();
});

/**
 * 오픈 순간 회귀 — 예전에는 `upcoming`이면 타이머를 아예 걸지 않아서, 오픈을 기다리며 탭을
 * 띄워 둔 사람은 `startAt`이 지나도 끝까지 후원 버튼을 못 봤다(새로고침해야 했다).
 * 캠페인 오픈 순간에 가장 많은 사람이 보고 있는 화면이 이 화면이다.
 */
describe('오픈 예정(upcoming)', () => {
  const OPEN_AT = new Date('2026-10-15T12:00:00+09:00');
  const timing = {
    status: 'auto' as const,
    startAt: OPEN_AT.toISOString(),
    endAt: '2026-11-15T12:00:00+09:00',
  };

  it('startAt이 지나는 순간 재조회하고 상태가 live로 바뀐다', async () => {
    jest.useFakeTimers({ now: OPEN_AT.getTime() - 60 * 60 * 1000 });
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ state: 'upcoming', remaining: {}, publicBackers: [] }))
      .mockResolvedValue(jsonResponse({ state: 'live', remaining: {}, publicBackers: [] }));
    global.fetch = fetchMock as never;

    const { result } = renderHook(() => useFundingStatus('demo', 'upcoming', timing));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current.state).toBe('upcoming');

    // 오픈 1분 전 — 아직 조용하다(폴링으로 두드리지 않는다).
    await act(async () => { jest.advanceTimersByTime(59 * 60 * 1000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 오픈 시각 통과 — 타이머가 깨어나 다시 묻고, 화면 상태가 live가 된다.
    await act(async () => { jest.advanceTimersByTime(60 * 1000 + 5000); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.state).toBe('live'));
  });

  it('오픈 뒤에는 서버가 캐시된 upcoming을 돌려줘도 브라우저 시계가 live로 판정한다', async () => {
    // 상태 API 응답은 CDN에서 s-maxage=60으로 캐시된다 — 오픈 직후 한동안 옛 판정이 온다.
    jest.useFakeTimers({ now: OPEN_AT.getTime() + 1000 });
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ state: 'upcoming', remaining: {}, publicBackers: [] })) as never;
    const { result } = renderHook(() => useFundingStatus('demo', 'upcoming', timing));
    await waitFor(() => expect(result.current.state).toBe('live'));
  });

  it('서버가 closed면 브라우저 시계가 live여도 closed다 — 수동 마감이 이긴다', async () => {
    jest.useFakeTimers({ now: OPEN_AT.getTime() + 1000 });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ state: 'closed', remaining: {}, publicBackers: [] }));
    global.fetch = fetchMock as never;
    const { result } = renderHook(() => useFundingStatus('demo', 'upcoming', timing));
    await waitFor(() => expect(result.current.state).toBe('closed'));
    // 마감이면 더 두드리지 않는다.
    await act(async () => { jest.advanceTimersByTime(30 * 60 * 1000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('timing이 없으면 upcoming도 5분 간격으로 받는다 — 영영 안 바뀌는 화면을 만들지 않는다', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ state: 'upcoming', remaining: {}, publicBackers: [] }));
    global.fetch = fetchMock as never;
    renderHook(() => useFundingStatus('demo', 'upcoming'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => { jest.advanceTimersByTime(5 * 60 * 1000); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

/**
 * 폴링은 5분 간격이다. 그 사이에 후원이 취소되면 열어 둔 탭은 내려간 이름·메시지를 최대
 * 5분간 계속 보여 준다 — 취소한 사람이 자기 이름이 아직 떠 있는 것을 보게 되는 자리다.
 * 탭으로 돌아오면 바로 다시 읽는다.
 */
describe('탭 복귀 시 다시 읽기', () => {
  const setVisibility = (v: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('탭으로 돌아오면 폴링을 기다리지 않고 다시 읽는다', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ state: 'live', remaining: {}, publicBackers: ['김후원'], publicMessages: [] })
    );
    global.fetch = fetchMock as never;

    renderHook(() => useFundingStatus('demo', 'live'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // 최소 간격(20초)을 넘긴 뒤 복귀
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await act(async () => { setVisibility('visible'); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('숨겨질 때는 읽지 않는다', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ state: 'live', remaining: {}, publicBackers: [], publicMessages: [] })
    );
    global.fetch = fetchMock as never;

    renderHook(() => useFundingStatus('demo', 'live'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await act(async () => { setVisibility('hidden'); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('짧은 간격으로 오가면 다시 읽지 않는다 — 요청이 몰리지 않게', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ state: 'live', remaining: {}, publicBackers: [], publicMessages: [] })
    );
    global.fetch = fetchMock as never;

    renderHook(() => useFundingStatus('demo', 'live'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // 방금 읽었으므로 최소 간격 안이다
    await act(async () => { setVisibility('visible'); });
    await act(async () => { setVisibility('visible'); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * 목록·상세 모두 정적 생성이라, 폴링 응답이 오기 전까지는 모금 현황이 비어 있었다.
 * 목록 카드는 그 사이 "목표 1,000,000원"만 보여줘서 아직 0원인 것처럼 읽혔고, 진행바가
 * 뒤늦게 생기며 레이아웃도 밀렸다. 서버가 실어 보낸 값으로 첫 렌더부터 채운다.
 */
it('초기 데이터를 주면 폴링 응답 전에도 그 값을 내놓는다', () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(() => new Promise(() => {})) as never; // 영원히 응답하지 않는 폴링
  const initial = {
    state: 'live' as const, goalAmount: 1000000, endAt: '2036-01-01T00:00:00+09:00',
    raisedAmount: 240000, backerCount: 7, percent: 24,
    remaining: {}, publicBackers: ['김정곤'], publicMessages: [],
  };

  const { result } = renderHook(() => useFundingStatus('demo', 'live', undefined, initial));

  expect(result.current.data?.raisedAmount).toBe(240000);
  expect(result.current.data?.backerCount).toBe(7);
});

it('초기 데이터가 없으면 폴링 전까지 비어 있다', () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(() => new Promise(() => {})) as never;

  const { result } = renderHook(() => useFundingStatus('demo', 'live'));

  expect(result.current.data).toBeNull();
});
