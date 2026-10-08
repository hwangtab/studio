/** @jest-environment node */

/**
 * 제목 서체 subset 무결성 가드 — 커밋된 lib/fonts/display.woff2와 사이드카(display.chars.json)가 짝이 맞는가(sha).
 *
 * 커밋본이 지금 제목들을 다 덮는지는 보지 않는다(2026-10-09). 모든 빌드가 prebuild에서 저장소의 원본으로 다시
 * 만들어 배포물은 언제나 최신이고, 커밋본은 next dev용이다. 배포물에 빠진 글자는 빌드 뒤
 * scripts/check-display-font-coverage.mjs(CI)가 잡는다.
 */

const { execFileSync } = require('child_process');

describe('hero font subset', () => {
  it('committed display subset and sidecar match (sha)', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/generate-hero-font.mjs', '--check'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(output).toContain('hero subset OK');
  });
});
