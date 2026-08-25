import { rangesOverlap } from './service';

describe('rangesOverlap — 경계 접촉은 겹침이 아니다', () => {
  const s = (h: number) => new Date(Date.UTC(2026, 8, 10, h));
  it('완전 분리', () => expect(rangesOverlap(s(1), s(3), s(3), s(5))).toBe(false));
  it('경계 접촉', () => expect(rangesOverlap(s(1), s(3), s(3), s(4))).toBe(false));
  it('부분 겹침', () => expect(rangesOverlap(s(1), s(3), s(2), s(4))).toBe(true));
  it('포함', () => expect(rangesOverlap(s(1), s(5), s(2), s(3))).toBe(true));
});
