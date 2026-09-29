/**
 * 페이지 전환 뒤의 스크롤 위치.
 *
 * 새 이동의 맨 위, 다른 페이지 앵커로 가는 해시 스크롤은 next/router가 한다. 새 경로의 커밋
 * 직후 scrollTo(0,0)을 하고, routeChangeComplete를 낸 다음 scrollToHash를 한다. 이 파일은 next가
 * 하지 않는 두 가지만 맡는다 — 뒤로·앞으로 가기 복원(scrollMemory)과 해시 대상 붙들기
 * (pinHashTarget). 둘 다 _app의 routeChangeComplete에서 돈다. 새 페이지가 이미 커밋된 뒤이고
 * 같은 태스크의 마이크로태스크라 첫 페인트 전이다.
 *
 * 예전에는 _app이 페이지를 AnimatePresence(mode="wait")로 감싸고 onExitComplete에서 스크롤을
 * 맞췄다. 그 구조에선 next의 scrollTo(0,0)이 **옛 페이지가 아직 남아 있는 커밋**에 일어나
 * 옛 페이지가 맨 위로 한 번 튄 뒤 새 페이지로 바뀌었고, 뒤로 가기 복원·해시 스크롤도 새 페이지가
 * 붙기 전이라 맨 위가 한 번 칠해졌다(2026-09-28 운영자 iOS 실기기 제보 "크게 한 번 깜빡",
 * 프레임 기록으로 확인). 전환 애니메이션은 이미 꺼져 있었으므로 AnimatePresence를 걷어냈다.
 *
 * behavior는 'instant'다: html에 scroll-behavior: smooth가 걸려 있어 'auto'면 굴러간다.
 */

const MAX_FRAMES = 30; // 약 0.5초 — 동적 import 섹션이 늦게 붙는 경우까지

/**
 * 뒤로·앞으로 가기로 돌아온 페이지는 떠날 때의 위치로 되돌린다.
 *
 * 위치는 스크롤할 때마다 지금 히스토리 항목(next/router가 history.state에 넣는 key)에 적는다.
 * 전환 중에는 적지 않는다 — popstate 직후 브라우저가 복원하는 스크롤, next의 scrollTo(0,0)이
 * 떠나는 페이지의 위치를 덮어쓰기 때문이다. 떠날 때 한 번 읽지 않고 계속 적는 이유도 같다:
 * popstate 시점엔 이미 스크롤이 바뀌어 있을 수 있다.
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
     * _app은 Router.beforePopState로 받는다 — next가 전환 직전에 부른다.
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
    takeRestoreTarget(): number | null {
      const y = restoreTarget;
      restoreTarget = null;
      return y;
    },
  };
};

export const scrollMemory = createScrollMemory();

/**
 * `Router.beforePopState`에 거는 스크롤 복원 콜백. **next는 이 콜백을 하나만 둔다** — 뒤에서 거는
 * 쪽이 앞의 것을 덮는다. 그래서 페이지가 자기 판정(저장 안 한 변경 경고 등)을 걸 때도 이 함수를
 * 거쳐야 하고, 떠날 때는 `() => true`가 아니라 이 함수로 되돌려야 한다. 예전에 개설자 편집기가
 * `() => true`로 되돌려서, 그 화면을 한 번 거치면 새로고침 전까지 사이트 전체의 뒤로가기 스크롤
 * 복원이 꺼졌다(2026-09-29 발견).
 */
export const beforePopStateForScroll = (state: unknown): true => {
  const key = (state as { key?: unknown } | null)?.key;
  scrollMemory.popped(typeof key === 'string' ? key : null);
  return true;
};

/** next/router가 history.state에 넣는 항목 key. 없으면 null. */
export const historyKey = (win: Window = window): string | null => {
  const key = (win.history.state as { key?: unknown } | null)?.key;
  return typeof key === 'string' ? key : null;
};

/** 기억한 위치로 되돌린다. 문서가 그만큼 길지 않으면 길어질 때까지 기다리고, 끝내 짧으면 닿는 곳까지. */
export const restoreScroll = (win: Window, y: number): void => {
  let frame = 0;
  const attempt = () => {
    const maxY = win.document.documentElement.scrollHeight - win.innerHeight;
    if (maxY >= y || frame >= MAX_FRAMES) {
      win.scrollTo({ top: Math.max(0, Math.min(y, maxY)), behavior: 'instant' as ScrollBehavior });
      return;
    }
    frame += 1;
    win.requestAnimationFrame(attempt);
  };
  attempt();
};

/**
 * 다른 페이지 앵커로 이동한 뒤 잠시 그 대상에 붙어 있는다.
 *
 * next의 scrollToHash는 한 번뿐이다. 대상 위쪽 섹션이 동적 import라 늦게 붙으면 대상이 아래로
 * 밀려난다 — Chrome은 스크롤 앵커링으로 버티지만 Safari에는 앵커링이 없다. 대상 자체가 늦게
 * 생기면(동적 컴포넌트 안의 id) next는 찾지 못하고 맨 위에 남는다.
 *
 * 그래서 pinMs 동안 대상이 생기거나 문서 높이가 바뀔 때마다 다시 맞춘다. 사용자가 손대면
 * (터치·휠·키·포인터) 즉시 놓는다 — 사용자가 스크롤하는데 끌어당기면 안 된다. 헤더에 가리지
 * 않는 것은 대상의 scroll-mt-*가 맡는다(scrollIntoView는 scroll-margin을 존중한다).
 * 돌려주는 함수를 부르면 바로 놓는다.
 */
export const pinHashTarget = (win: Window, id: string, pinMs = 1200): (() => void) => {
  let released = false;
  let lastTop: number | null = null;
  const align = () => {
    if (released) return;
    const target = win.document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top;
    if (lastTop !== null && Math.abs(top - lastTop) < 1) return;
    target.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    lastTop = target.getBoundingClientRect().top;
  };
  const inputEvents = ['touchstart', 'wheel', 'keydown', 'pointerdown'] as const;
  const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const observer = Observer ? new Observer(align) : null;
  const release = () => {
    if (released) return;
    released = true;
    observer?.disconnect();
    inputEvents.forEach((type) => win.removeEventListener(type, release, true));
    win.clearTimeout(timer);
  };
  inputEvents.forEach((type) => win.addEventListener(type, release, { capture: true, passive: true }));
  observer?.observe(win.document.documentElement);
  const timer = win.setTimeout(release, pinMs);

  // 대상이 아직 없으면 생길 때까지 프레임 단위로 찾는다
  let frame = 0;
  const waitForTarget = () => {
    if (released) return;
    if (win.document.getElementById(id)) {
      align();
      return;
    }
    frame += 1;
    if (frame < MAX_FRAMES) win.requestAnimationFrame(waitForTarget);
  };
  waitForTarget();
  return release;
};

/** URL의 해시를 풀어 id로. 없으면 null. */
export const hashId = (url: string): string | null => {
  const hash = url.split('#')[1];
  if (!hash || hash === 'top') return null;
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
};

/** 전환 key — 쿼리와 해시를 뗀 경로. 해시가 key에 남으면 같은 페이지 안의 앵커 이동도 페이지를 통째로 다시 마운트한다. */
export const routeTransitionKey = (asPath: string): string => asPath.split(/[?#]/)[0];
