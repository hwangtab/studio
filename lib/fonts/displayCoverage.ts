import sidecar from './display.chars.json';

/**
 * 제목이 제목 서체(display.woff2 서브셋)로 다 그려지는가 — **빌드 때 알 수 없는 제목**(DB에서 오는 펀딩·공연 제목)용.
 *
 * 서브셋은 빌드 때 알 수 있는 제목만 담는다(scripts/generate-hero-font.mjs). 개설자가 DB로 낸 펀딩 프로젝트처럼
 * 나중에 들어오는 제목에 서브셋 밖 글자가 있으면 그 글자만 Pretendard로 그려져 제목 안에서 서체가 섞인다
 * (2026-10-08 공연 "출연"). 그럴 땐 제목 전체를 본문 서체로 그린다 — 섞이는 것보다 낫다. 호출부가
 * ImageHero의 `titleFallbackFont`로 넘긴다. 사이트 전역(ImageHero 안)에서 부르지 않는 것은 글자 표(~1천 자)가
 * 모든 페이지 번들에 실리지 않게 하려는 것이다 — 정적 제목은 빌드 검사(check-display-font-coverage)가 맡는다.
 */
const CHARS = new Set<string>((sidecar as { chars: string[] }).chars);
// 설계상 로케일 폰트로 가는 문자(태국 문자·한자·전각/CJK 구두점·이모지) — scripts/check-display-font-coverage.mjs와 같다.
const BY_DESIGN = /[฀-๿⺀-鿿豈-﫿＀-￯　-〿\u{1F000}-\u{1FAFF}☀-➿️]/u;

export function fitsDisplayFont(text: string): boolean {
  for (const ch of text) {
    if (/\s/.test(ch) || BY_DESIGN.test(ch)) continue;
    if (!CHARS.has(ch)) return false;
  }
  return true;
}
