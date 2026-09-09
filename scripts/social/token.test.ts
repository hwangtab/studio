/** @jest-environment node */
import { daysLeft, PLATFORMS, REFRESH_WHEN_DAYS_LEFT } from './meta.mjs';

/**
 * 토큰 수명 판정 — 이 계산이 틀리면 갱신을 건너뛰고 토큰이 영구 만료된다(만료 후에는
 * refresh가 불가능하고 재승인만 남는다). 파싱 실패는 "모름"으로 떨어져 갱신을 **하는** 쪽,
 * 즉 안전한 방향으로 가야 한다.
 */
const KEY = PLATFORMS.threads.expiresKey;
const original = process.env[KEY];
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe('daysLeft', () => {
  it('returns null when the expiry is missing or unparseable', () => {
    delete process.env[KEY];
    expect(daysLeft('threads')).toBeNull();
    process.env[KEY] = '언젠가';
    expect(daysLeft('threads')).toBeNull();
  });

  it('measures remaining days from an ISO expiry', () => {
    process.env[KEY] = new Date(Date.now() + 10 * 86400000).toISOString();
    expect(daysLeft('threads')).toBeCloseTo(10, 1);
  });

  it('goes negative once expired, so the CLI can say "재승인 필요"', () => {
    process.env[KEY] = new Date(Date.now() - 86400000).toISOString();
    expect(daysLeft('threads')).toBeLessThan(0);
  });
});

describe('refresh threshold', () => {
  it('leaves enough room that a missed weekly run cannot expire the token', () => {
    // 60일 토큰. 임계가 주간 실행 간격보다 넉넉해야 한 번 걸러도 살아남는다.
    expect(REFRESH_WHEN_DAYS_LEFT).toBeGreaterThan(7);
    expect(REFRESH_WHEN_DAYS_LEFT).toBeLessThan(60);
  });
});
