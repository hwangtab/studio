/**
 * 페이지 전환이 끝난 뒤의 스크롤 위치.
 *
 * _app의 AnimatePresence(onExitComplete)가 부른다. 예전에는 무조건 scrollTo(0)이라
 * **다른 페이지의 앵커로 가는 링크가 전부 그 페이지 맨 위에 떨어졌다** — 프로덕션 푸터
 * "취소·환불 규정"(/ko/terms#refund)이 약관 맨 위에 도착하고 환불 조항은 1,017px 아래에
 * 있었다(2026-09-26 실측). next/router가 해시로 스크롤해도 그 뒤에 이 콜백이 맨 위로 되돌렸다.
 *
 * mode="wait"라 이 콜백이 불리는 시점엔 새 페이지가 아직 마운트되지 않았다. 그래서 대상
 * 요소가 생길 때까지 프레임 단위로 다시 찾는다. 끝내 없으면(잘못된 앵커) 예전처럼 맨 위.
 *
 * 헤더에 가리지 않는 것은 대상 요소의 scroll-mt-*가 맡는다 — scrollIntoView는 scroll-margin을
 * 존중한다. behavior는 'instant'다: html에 scroll-behavior: smooth가 걸려 있어 'auto'면
 * 페이지 맨 위에서부터 부드럽게 굴러 내려간다.
 */

const MAX_FRAMES = 30; // 약 0.5초 — 동적 import 섹션이 늦게 붙는 경우까지

/**
 * 뒤로·앞으로 가기로 돌아온 페이지는 떠날 때의 위치로 되돌린다.
 *
 * 되돌리는 시점은 새 페이지가 DOM에 붙은 직후, 첫 페인트 전(_app의 useLayoutEffect)이다.
 * onExitComplete에서 되돌리면 그때는 새 페이지가 아직 없어 문서가 짧다 — 목록이 맨 위로
 * 한 번 칠해진 뒤 제자리로 뛰어 "크게 한 번 깜빡"였다(2026-09-28 운영자 iOS 실기기 제보,
 * 프레임 기록으로 확인). next는 새 경로의 첫 커밋 직후 scrollTo(0,0)을 하고, 새 페이지는
 * 그 다음 커밋(AnimatePresence exit 완료 뒤)에 붙으므로 레이아웃 이펙트가 그보다 뒤다.
 *
 * 이 기억이 없던 동안에는 뒤로 가기도 새 이동처럼 맨 위에 떨어졌다 — 스토리 목록을 한참 내려
 * 글을 열고 돌아오면 목록 맨 위였다(2026-09-28 WebKit iPhone 에뮬레이션으로 재현). 브라우저의
 * 기본 복원은 새 페이지가 마운트되기 전(mode="wait")에 일어나 짧은 문서에 잘리고, 그 뒤 이
 * 파일의 scrollTo(0)이 덮어쓴다.
 *
 * 위치는 스크롤할 때마다 지금 히스토리 항목(next/router가 history.state에 넣는 key)에 적는다.
 * 전환 중에는 적지 않는다 — popstate 직후 브라우저가 복원하는 스크롤, 옛 페이지가 빠지며
 * 문서가 짧아져 잘리는 스크롤이 떠나는 페이지의 위치를 덮어쓰기 때문이다. 떠날 때 한 번
 * 읽지 않고 계속 적는 이유도 같다: popstate 시점엔 이미 스크롤이 바뀌어 있을 수 있다.
 */
export const createScrollMemory = () => {
  const positions = new Map<string, number>();
  let currentKey: string | null = null;
  let paused = false;
  let restoreTarget: number | null = null;
  return {
    /** scroll 이벤트마다 */
    record(y: number) {
      if (!paused && currentKey) positions.set(currentKey, y);
    },
    /** routeChangeStart — 새 이동이든 뒤로 가기든 전환 중에는 적지 않는다 */
    leave() {
      paused = true;
    },
    /**
     * 뒤로·앞으로 가기 — 돌아갈 항목의 위치를 꺼내 둔다. 처음 보는 항목이면 복원하지 않는다.
     * window의 popstate 리스너로 받으면 안 된다: next/router가 먼저 등록한 리스너에서 전환을
     * **동기로** 끝내 버려(데이터가 캐시에 있으면) 복원 위치를 꺼내기 전에 전환이 끝난다.
     * _app은 router.beforePopState로 받는다 — next가 전환 직전에 부른다.
     */
    popped(key: string | null) {
      paused = true;
      restoreTarget = key ? positions.get(key) ?? null : null;
    },
    /** 전환이 끝나 스크롤을 맞춘 뒤(또는 첫 마운트) — 여기서부터 이 항목의 위치를 적는다 */
    arrived(key: string | null) {
      currentKey = key;
      paused = false;
    },
    /** 전환이 취소·실패한 경우 — 떠나지 않았으니 다시 적는다 */
    cancelled() {
      paused = false;
      restoreTarget = null;
    },
    hasRestoreTarget(): boolean {
      return restoreTarget !== null;
    },
    takeRestoreTarget(): number | null {
      const y = restoreTarget;
      restoreTarget = null;
      return y;
    },
  };
};

export const scrollMemory = createScrollMemory();

/** next/router가 history.state에 넣는 항목 key. 없으면 null. */
export const historyKey = (win: Window = window): string | null => {
  const key = (win.history.state as { key?: unknown } | null)?.key;
  return typeof key === 'string' ? key : null;
};

export const scrollAfterRouteChange = (win: Window = window, restoreY: number | null = null): void => {
  if (restoreY !== null) {
    // 새 페이지가 붙어 문서가 그 위치까지 길어질 때까지 기다린다. 끝내 짧으면 닿는 곳까지.
    let frame = 0;
    const attempt = () => {
      const maxY = win.document.documentElement.scrollHeight - win.innerHeight;
      if (maxY >= restoreY || frame >= MAX_FRAMES) {
        win.scrollTo({ top: Math.max(0, Math.min(restoreY, maxY)), behavior: 'instant' as ScrollBehavior });
        return;
      }
      frame += 1;
      win.requestAnimationFrame(attempt);
    };
    attempt();
    return;
  }

  const id = decodeURIComponent(win.location.hash.slice(1));
  if (!id) {
    win.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  let frame = 0;
  const attempt = () => {
    const target = win.document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      return;
    }
    frame += 1;
    if (frame < MAX_FRAMES) {
      win.requestAnimationFrame(attempt);
    } else {
      win.scrollTo({ top: 0, behavior: 'auto' });
    }
  };
  attempt();
};

/** 전환 key — 쿼리와 해시를 뗀 경로. 해시가 key에 남으면 같은 페이지 안의 앵커 이동도 페이지를 통째로 다시 마운트한다. */
export const routeTransitionKey = (asPath: string): string => asPath.split(/[?#]/)[0];
