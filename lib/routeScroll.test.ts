import { createScrollMemory, routeTransitionKey, scrollAfterRouteChange } from './routeScroll';

/** requestAnimationFrame을 손으로 돌릴 수 있는 가짜 window. */
const fakeWindow = (hash: string, elementAfterFrames: number | null) => {
  const frames: FrameRequestCallback[] = [];
  let framesRun = 0;
  const el = { scrollIntoView: jest.fn() };
  const win = {
    location: { hash },
    scrollTo: jest.fn(),
    requestAnimationFrame: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
    document: {
      getElementById: jest.fn(() =>
        elementAfterFrames !== null && framesRun >= elementAfterFrames ? el : null,
      ),
    },
  };
  const flush = (max = 100) => {
    for (let i = 0; i < max && frames.length; i++) {
      framesRun += 1;
      frames.shift()!(0);
    }
  };
  return { win: win as unknown as Window, el, flush };
};

describe('scrollAfterRouteChange', () => {
  it('해시가 없으면 예전처럼 맨 위로', () => {
    const { win, el } = fakeWindow('', null);
    scrollAfterRouteChange(win);
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it('해시 대상이 있으면 맨 위로 가지 않고 그 요소로 간다(푸터 /ko/terms#refund 회귀)', () => {
    const { win, el } = fakeWindow('#refund', 0);
    scrollAfterRouteChange(win);
    expect(win.document.getElementById).toHaveBeenCalledWith('refund');
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('새 페이지가 몇 프레임 뒤에 마운트돼도 기다렸다가 간다', () => {
    const { win, el, flush } = fakeWindow('#funding-goal', 3);
    scrollAfterRouteChange(win);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    flush();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(win.scrollTo).not.toHaveBeenCalled();
  });

  it('끝내 없는 앵커면 맨 위로 물러난다', () => {
    const { win, el, flush } = fakeWindow('#nope', null);
    scrollAfterRouteChange(win);
    flush();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('인코딩된 해시를 풀어서 찾는다', () => {
    const { win } = fakeWindow('#%ED%99%98%EB%B6%88', 0);
    scrollAfterRouteChange(win);
    expect(win.document.getElementById).toHaveBeenCalledWith('환불');
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

describe('scrollAfterRouteChange — 뒤로 가기 복원', () => {
  const restoreWindow = (heights: number[]) => {
    const frames: FrameRequestCallback[] = [];
    let i = 0;
    const win = {
      innerHeight: 800,
      location: { hash: '#ignored' },
      scrollTo: jest.fn(),
      requestAnimationFrame: (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; },
      document: {
        documentElement: { get scrollHeight() { return heights[Math.min(i, heights.length - 1)]; } },
        getElementById: jest.fn(),
      },
    };
    const flush = () => { while (frames.length) { i += 1; frames.shift()!(0); } };
    return { win: win as unknown as Window, flush };
  };

  it('문서가 그 위치까지 길어질 때까지 기다렸다가 되돌린다 — 해시보다 기억한 위치가 먼저', () => {
    const { win, flush } = restoreWindow([900, 900, 4000]);
    scrollAfterRouteChange(win, 2500);
    expect(win.scrollTo).not.toHaveBeenCalled();
    flush();
    expect(win.scrollTo).toHaveBeenCalledTimes(1);
    expect(win.scrollTo).toHaveBeenCalledWith({ top: 2500, behavior: 'instant' });
    expect(win.document.getElementById).not.toHaveBeenCalled();
  });

  it('끝내 짧으면 닿는 곳까지만', () => {
    const { win, flush } = restoreWindow([1800]);
    scrollAfterRouteChange(win, 2500);
    flush();
    expect(win.scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'instant' });
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
