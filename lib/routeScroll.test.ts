import { routeTransitionKey, scrollAfterRouteChange } from './routeScroll';

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
