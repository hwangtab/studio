import { renderHook, waitFor } from '@testing-library/react';

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
