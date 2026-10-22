import { VIDEO_WORKS, VIDEO_WORK_KINDS } from './videoPortfolio';

describe('VIDEO_WORKS', () => {
  it('youtubeId는 11자 영상 id만 담는다(목록·시작 시각 파라미터 없이)', () => {
    for (const w of VIDEO_WORKS) {
      expect(w.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
    }
  });

  it('같은 영상이 두 번 들어가지 않는다', () => {
    const ids = VIDEO_WORKS.map((w) => w.youtubeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('필터의 모든 종류에 영상이 하나 이상 있다', () => {
    for (const kind of VIDEO_WORK_KINDS) {
      expect(VIDEO_WORKS.some((w) => w.kind === kind)).toBe(true);
    }
  });
});
