import { useEffect, useState } from 'react';
import type { ProjectState } from '../../lib/funding/projects';

export interface FundingStatusResponse {
  state: ProjectState; goalAmount: number; endAt: string; raisedAmount: number; backerCount: number; percent: number;
  remaining: Record<string, number | null>; publicBackers: string[];
}

/**
 * 마운트 시 1회 + live일 때 5분 폴링. 실패는 error로만 알린다(후원은 막지 않는다).
 * 마감(closed)이 확인되면 폴링을 멈춘다 — 더 바뀔 값이 없는데 계속 두드릴 이유가 없다.
 */
export const useFundingStatus = (slug: string, initialState: ProjectState) => {
  const [data, setData] = useState<FundingStatusResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      try {
        const res = await fetch(`/api/funding/${encodeURIComponent(slug)}/status`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as FundingStatusResponse;
        if (!alive) return;
        setData(json);
        setError(false);
        if (json.state === 'closed' && timer) {
          clearInterval(timer);
          timer = undefined;
        } else if (json.state === 'live' && !timer) {
          timer = setInterval(load, 5 * 60 * 1000);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    void load();
    if (initialState === 'live' && !timer) {
      timer = setInterval(load, 5 * 60 * 1000);
    }
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  return { data, error };
};
