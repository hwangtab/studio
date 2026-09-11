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
