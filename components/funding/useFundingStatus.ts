import { useEffect, useState } from 'react';
import { computeProjectState, type ProjectState } from '../../lib/funding/projectState';

export interface FundingStatusResponse {
  state: ProjectState; goalAmount: number; endAt: string; raisedAmount: number; backerCount: number; percent: number;
  remaining: Record<string, number | null>; publicBackers: string[];
}

/** 프로젝트 파일이 가진 시각 정보 — 브라우저 시계로 상태를 다시 판정하는 데만 쓴다. */
export interface FundingTiming {
  status: 'auto' | 'draft' | 'closed';
  startAt: string;
  endAt: string;
}

const POLL_MS = 5 * 60 * 1000;
/** setTimeout이 즉시 발화로 뭉개지 않는 상한(약 24.8일). 오픈이 더 먼 프로젝트는 여러 번에 나눠 잰다. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
/**
 * 오픈 시각을 조금 넘겨 조회한다. 상태 API 응답은 CDN에서 `s-maxage=60`으로 캐시되므로
 * 정각에 물으면 직전의 `upcoming`이 그대로 올 수 있다 — 화면은 아래 로컬 판정으로 이미
 * 열려 있고, 이 여유는 첫 재조회가 헛되이 낭비되지 않게 하는 용도다.
 */
const OPEN_GRACE_MS = 2000;

/** 두 판정 중 '더 진행된' 쪽. upcoming → live → closed 는 되돌아가지 않는 단방향이다. */
const RANK: Record<ProjectState, number> = { draft: -1, upcoming: 0, live: 1, closed: 2 };
const laterState = (a: ProjectState | null | undefined, b: ProjectState): ProjectState =>
  a && RANK[a] > RANK[b] ? a : b;

/**
 * 마운트 시 1회 조회 + 상태에 맞춘 재조회. 실패는 error로만 알린다(후원은 막지 않는다).
 *
 * 세 가지를 함께 본다.
 *
 * 1. **오픈 예정(upcoming)도 타이머를 건다.** 예전엔 live일 때만 폴링해서, 오픈을 기다리며
 *    탭을 띄워 둔 사람은 `startAt`이 지나도 끝까지 후원 버튼을 못 봤다(새로고침해야 했다).
 *    캠페인 오픈 순간에 가장 많은 사람이 보고 있는 화면이 바로 이 화면이다. `timing`이
 *    있으면 오픈 시각에 맞춘 1회 타이머, 없으면 5분 간격으로 받는다.
 * 2. **브라우저 시계로 다시 판정한다**(FundingProjectCard와 같은 이유). 정적 생성된 초기
 *    상태는 빌드 시각에 고정돼 있고, 상태 API 응답도 CDN 캐시라 최대 몇 분 뒤처진다.
 *    그래서 서버 응답과 로컬 판정 중 **더 진행된 쪽**을 택한다 — 수동 마감(status: closed)은
 *    서버가 이기고, 캐시가 뒤처진 오픈 순간은 로컬이 이긴다.
 * 3. 마감(closed)이 확인되면 타이머를 멈춘다 — 더 바뀔 값이 없다.
 *
 * 초기 렌더는 언제나 서버가 준 `initialState`다(하이드레이션 불일치 방지). 로컬 판정은
 * 마운트 이후에만 섞인다.
 */
export const useFundingStatus = (slug: string, initialState: ProjectState, timing?: FundingTiming) => {
  const [data, setData] = useState<FundingStatusResponse | null>(null);
  const [error, setError] = useState(false);
  const [localState, setLocalState] = useState<ProjectState | null>(null);
  const status = timing?.status;
  const startAt = timing?.startAt;
  const endAt = timing?.endAt;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const readClock = (): ProjectState | null =>
      status && startAt && endAt ? computeProjectState({ status, startAt, endAt }, new Date()) : null;

    const schedule = (serverState: ProjectState | null) => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      const local = readClock();
      const state = laterState(serverState, local ?? initialState);
      if (state === 'closed' || state === 'draft') return;
      if (state === 'live') {
        timer = setTimeout(run, POLL_MS);
        return;
      }
      // upcoming — 오픈 시각까지 남은 시간에 맞춘 1회 타이머(시각을 모르면 5분 간격).
      const untilStart = startAt ? new Date(startAt).getTime() + OPEN_GRACE_MS - Date.now() : POLL_MS;
      const delay = Number.isFinite(untilStart) ? Math.min(Math.max(untilStart, 0), MAX_TIMEOUT_MS) : POLL_MS;
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (!alive) return;
      setLocalState(readClock());
      let serverState: ProjectState | null = null;
      try {
        const res = await fetch(`/api/funding/${encodeURIComponent(slug)}/status`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as FundingStatusResponse;
        if (!alive) return;
        serverState = json.state;
        setData(json);
        setError(false);
      } catch {
        if (!alive) return;
        setError(true);
      }
      schedule(serverState);
    };

    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, status, startAt, endAt]);

  return { data, error, state: laterState(data?.state, localState ?? initialState) };
};
