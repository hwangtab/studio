import { createScrollMemory, hashId, pinHashTarget, restoreScroll, routeTransitionKey } from './routeScroll';

/** requestAnimationFrame·타이머·이벤트를 손으로 돌릴 수 있는 가짜 window. */
const fakeWindow = (opts: { heights?: number[]; targetAfterFrames?: number | null } = {}) => {
  const { heights = [4000], targetAfterFrames = 0 } = opts;
  const frames: FrameRequestCallback[] = [];
  let framesRun = 0;
  let top = 500;
  const el = {
    scrollIntoView: jest.fn(() => { top = 0; }),
    getBoundingClientRect: () => ({ top }),
  };
  const listeners = new Map<string, () => void>();
  const timers: Array<() => void> = [];
  let resizeCb: (() => void) | null = null;
  const win = {
    innerHeight: 800,
    scrollTo: jest.fn(),
    requestAnimationFrame: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
    setTimeout: (cb: () => void) => { timers.push(cb); return timers.length; },
    clearTimeout: jest.fn(),
    addEventListener: (type: string, cb: () => void) => { listeners.set(type, cb); },
    removeEventListener: (type: string) => { listeners.delete(type); },
    ResizeObserver: class {
      constructor(cb: () => void) { resizeCb = cb; }
      observe() {}
      disconnect() { resizeCb = null; }
    },
    document: {
      documentElement: { get scrollHeight() { return heights[Math.min(framesRun, heights.length - 1)]; } },
      getElementById: jest.fn(() =>
        targetAfterFrames !== null && framesRun >= targetAfterFrames ? el : null,
      ),
    },
  };
  const flush = (max = 100) => {
    for (let i = 0; i < max && frames.length; i++) {
      framesRun += 1;
      frames.shift()!(0);
    }
  };
  /** 위쪽 섹션이 늦게 붙어 대상이 아래로 밀려난 상황 */
  const shiftTarget = (by: number) => { top += by; resizeCb?.(); };
  const fire = (type: string) => listeners.get(type)?.();
  const expire = () => timers.forEach((t) => t());
  return { win: win as unknown as Window, el, flush, shiftTarget, fire, expire, hasListener: (t: string) => listeners.has(t) };
};

describe('restoreScroll', () => {
  it('문서가 그 위치까지 길어질 때까지 기다렸다가 되돌린다', () => {
    const { win, flush } = fakeWindow({ heights: [900, 900, 4000] });
    restoreScroll(win, 2500);
    expect(win.scrollTo).not.toHaveBeenCalled();
    flush();
    expect(win.scrollTo).toHaveBeenCalledTimes(1);
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 2500, behavior: 'instant' });
  });

  it('이미 충분히 길면 그 자리에서 바로 — 첫 페인트 전에 끝나야 깜빡이지 않는다', () => {
    const { win } = fakeWindow({ heights: [8000] });
    restoreScroll(win, 1800);
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: 'instant' });
  });

  it('끝내 짧으면 닿는 곳까지만', () => {
    const { win, flush } = fakeWindow({ heights: [1800] });
    restoreScroll(win, 2500);
    flush();
    expect(win.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'instant' });
  });
});

describe('pinHashTarget', () => {
  it('대상 위쪽이 늦게 붙어 밀려나면 다시 맞춘다(Safari는 스크롤 앵커링이 없다)', () => {
    const { win, el, shiftTarget } = fakeWindow();
    pinHashTarget(win, 'funding-goal');
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    shiftTarget(600);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(el.scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'instant' });
  });

  it('위치가 그대로면 다시 부르지 않는다 — 아래쪽만 바뀐 경우', () => {
    const { win, el, shiftTarget } = fakeWindow();
    pinHashTarget(win, 'funding-goal');
    shiftTarget(0);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('사용자가 손대면 즉시 놓는다', () => {
    const { win, el, shiftTarget, fire, hasListener } = fakeWindow();
    pinHashTarget(win, 'funding-goal');
    fire('touchstart');
    shiftTarget(600);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(hasListener('touchstart')).toBe(false);
  });

  it('시간이 지나면 놓는다', () => {
    const { win, el, shiftTarget, expire } = fakeWindow();
    pinHashTarget(win, 'funding-goal');
    expire();
    shiftTarget(600);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('대상이 몇 프레임 뒤에 생겨도 기다렸다가 간다(동적 컴포넌트 안의 id)', () => {
    const { win, el, flush } = fakeWindow({ targetAfterFrames: 3 });
    pinHashTarget(win, 'late');
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    flush();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('끝내 없는 앵커면 아무것도 하지 않는다 — next가 둔 맨 위에 남는다', () => {
    const { win, el, flush } = fakeWindow({ targetAfterFrames: null });
    pinHashTarget(win, 'nope');
    flush();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    expect(win.scrollTo).not.toHaveBeenCalled();
  });
});

describe('hashId', () => {
  it('해시를 풀어 id로', () => {
    expect(hashId('/ko/terms#refund')).toBe('refund');
    expect(hashId('/ko/terms#%ED%99%98%EB%B6%88')).toBe('환불');
  });

  it('해시가 없거나 #top이면 null — 맨 위는 next가 한다', () => {
    expect(hashId('/ko/terms')).toBeNull();
    expect(hashId('/ko/terms#')).toBeNull();
    expect(hashId('/ko/terms#top')).toBeNull();
  });

  it('잘못 인코딩된 해시도 던지지 않는다', () => {
    expect(hashId('/ko/x#%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('createScrollMemory', () => {
  it('떠난 항목으로 popstate하면 떠날 때의 위치를 돌려준다', () => {
    const mem = createScrollMemory();
    mem.arrived('A');
    mem.record(2500);
    mem.leave();
    mem.record(0); // 전환 중 스크롤 — 적지 않는다
    mem.arrived('B');
    mem.record(700);
    mem.popped('A');
    mem.record(123); // popstate 직후 브라우저 복원 스크롤 — B를 덮어쓰지 않는다
    expect(mem.takeRestoreTarget()).toBe(2500);
    expect(mem.takeRestoreTarget()).toBeNull();
    mem.arrived('A');
    mem.popped('B');
    expect(mem.takeRestoreTarget()).toBe(700);
  });

  it('처음 보는 항목이나 key가 없으면 복원하지 않는다', () => {
    const mem = createScrollMemory();
    mem.arrived('A');
    mem.record(300);
    mem.popped('Z');
    expect(mem.takeRestoreTarget()).toBeNull();
    mem.popped(null);
    expect(mem.takeRestoreTarget()).toBeNull();
  });

  it('전환이 취소되면 다시 적는다', () => {
    const mem = createScrollMemory();
    mem.arrived('A');
    mem.leave();
    mem.cancelled();
    mem.record(400);
    mem.arrived('B');
    mem.popped('A');
    expect(mem.takeRestoreTarget()).toBe(400);
  });
});

describe('routeTransitionKey', () => {
  it('쿼리와 해시를 뗀다 — 같은 페이지 안의 앵커 이동이 페이지를 다시 마운트하지 않게', () => {
    expect(routeTransitionKey('/ko/terms#refund')).toBe('/ko/terms');
    expect(routeTransitionKey('/ko/stories?page=2')).toBe('/ko/stories');
    expect(routeTransitionKey('/ko/stories?page=2#top')).toBe('/ko/stories');
    expect(routeTransitionKey('/ko')).toBe('/ko');
  });
});
