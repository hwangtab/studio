/** @jest-environment node */

/**
 * hero 폰트 subset 무결성 가드.
 *
 * hero h1·v2 섹션 제목 텍스트(data/home.ts, buyerIntentHubs, locales *title*·*heading* 키, data/*.ts title)가
 * 바뀌었는데 lib/fonts/display.woff2 재생성 commit을 빠뜨리면, 새 글자가 subset 밖이라
 * Pretendard로 그려져 한 제목 안에서 서체가 갈린다(빌드는 성공하므로 조용한 회귀).
 * --check 모드는 네트워크 없이 사이드카(display.chars.json)와 현재 제목
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
