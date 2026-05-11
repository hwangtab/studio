import localFont from 'next/font/local';

// Pretendard Variable — 사이트 전반의 통합 한글+라틴 폰트 (한글 11,172자 + 영문 + 숫자).
// 단일 woff2(약 2MB)에 weight 45-920 axis range가 들어 있어 사이트의 다양한 굵기를
// 한 파일로 cover. next/font/google의 Noto Sans KR이 unicode-range 기반으로 한글
// chunk를 lazy fetch해 PSI LCP 'element render delay 1.8s' 주범이던 문제를 단일
// 파일로 해소.
//
// preload는 의도적으로 비활성: 2MB 파일을 preload하면 critical path를 점유해 첫
// paint(LCP/FCP)를 오히려 지연. font-display:swap으로 시스템 한글 fallback로 즉시
// paint → Pretendard가 lazy 도착하면 swap. 재방문자는 캐시된 폰트로 첫 paint부터
// final 표시.
//
// fallback chain: 시스템 한글 폰트(Apple SD Gothic Neo / Malgun Gothic 등). Pretendard
// 자체가 Apple SD Gothic Neo + Inter 베이스라 시각적 swap gap이 작음.
//
// source: scripts/generate-hero-font.mjs와 동일하게 jsdelivr CDN의 orioncactus/
// pretendard repo에서 받음. lib/fonts/pretendard-variable.woff2는 commit.
export const pretendard = localFont({
  src: './fonts/pretendard-variable.woff2',
  weight: '45 920',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-pretendard',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'],
});

// hero h1 전용 micro-subset (7 locale × 모든 페이지 hero title 글자만, ~30KB).
// 본문 Pretendard Variable이 lazy 도착하기 전 hero h1에 한정해 critical path 진입.
// preload=true로 다른 critical 리소스와 동시 fetch, swap이 거의 즉시 발생.
//
// 생성: scripts/generate-hero-font.mjs (글자 set 변경 시 재실행).
//
// ⚠️ 운영 주의 — hero h1에 들어가는 텍스트(data/home.ts heroContent, public/locales/
// */common.json의 *.hero.title* 키)를 변경했다면 반드시 아래를 실행하고 결과 woff2를
// commit해야 한다. 빠뜨리면 새 글자가 micro-subset에 없어 fallback chain
// (Pretendard Variable → 시스템 한글)으로 그려져 글자별로 미세한 두께/메트릭 차이가
// 보일 수 있다.
//
//   node scripts/generate-hero-font.mjs
export const pretendardHero = localFont({
  src: './fonts/pretendard-hero.woff2',
  weight: '700',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-pretendard-hero',
  fallback: ['var(--font-pretendard)', '-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'],
});
