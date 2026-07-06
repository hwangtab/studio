/** @jest-environment node */

/**
 * hero 폰트 subset 무결성 가드.
 *
 * hero h1 텍스트(data/home.ts, buyerIntentHubs, locales *.hero.title*)가 바뀌었는데
 * lib/fonts/pretendard-hero.woff2 재생성 commit을 빠뜨리면, 새 글자가 subset 밖이라
 * fallback 폰트로 그려져 글자별 두께 차이가 난다(빌드는 성공하므로 조용한 회귀).
 * --check 모드는 네트워크 없이 사이드카(pretendard-hero.chars.json)와 현재 hero
 * 문자 집합만 대조한다. 실패 시: node scripts/generate-hero-font.mjs 실행 후
 * woff2 + chars.json을 함께 commit.
 */

const { execFileSync } = require('child_process');

describe('hero font subset', () => {
  it('committed subset covers every current hero h1 character', () => {
    const output = execFileSync(
      process.execPath,
      ['scripts/generate-hero-font.mjs', '--check'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );

    expect(output).toContain('hero subset OK');
  });
});
