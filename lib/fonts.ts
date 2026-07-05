import localFont from 'next/font/local';

// Pretendard Variable — 사이트 전반의 통합 한글+라틴 폰트. weight 45-920 axis range를
// 단일 woff2로 cover해, Noto Sans KR의 unicode-range 기반 한글 chunk lazy fetch가
// PSI LCP 'element render delay 1.8s' 주범이던 문제를 단일 파일로 해소.
//
// ⚙️ subset: 이 파일(./fonts/pretendard-variable.woff2)은 원본 2MB가 아니라 빌드 시점
// 서브셋(≈460KB, 77%↓)이다. 원본 한글 완성형 11,172자 중 실사용은 1,390자뿐이라 body
// 폰트(VeryHigh 우선순위)가 slow 4G 대역폭을 ~10초 독점하던 portfolio/story PSI 병목을
// 제거. 글자 집합 = KS X 1001 완성형 2,350(세이프 마진) ∪ 실사용 글자(스토리·data·
// locales 전수 스캔) ∪ 라틴/기호. 가변 axis(fvar wght 45-930)·gvar·GSUB/GPOS는 보존.
// 원본은 lib/fonts/pretendard-variable-full.woff2(subset 소스, commit), 산출물은
// scripts/generate-body-font.mjs가 prebuild에서 로컬 원본으로부터 결정적 재생성한다
// (콘텐츠가 새 글자를 도입해도 자동 반영 — 수동 재생성 의존 없음). unicode-range
// 글자별 lazy가 아니라 단일 작은 파일이므로 element render delay 회피 취지는 유지.
// zh/th는 styles/globals.css가 PingFang SC/Leelawadee로 라우팅 → 한자·태국문자 미포함이
// 회귀를 일으키지 않는다.
//
// preload는 의도적으로 비활성: preload하면 critical path를 점유해 첫 paint(LCP/FCP)를
// 오히려 지연. font-display:swap으로 시스템 한글 fallback로 즉시 paint → Pretendard가
// lazy 도착하면 swap. 재방문자는 캐시된 폰트로 첫 paint부터 final 표시.
//
// fallback chain: 시스템 한글 폰트(Apple SD Gothic Neo / Malgun Gothic 등). Pretendard
// 자체가 Apple SD Gothic Neo + Inter 베이스라 시각적 swap gap이 작음.
//
// metric override(size-adjust/ascent-override): 별도 적용 안 함(의도적). next/font/local은
// adjustFontFallback 미지정 시 기본으로 라틴(Arial) 기준 조정 fallback @font-face를
// 자동 생성하는데, 서브셋 후에도 폰트 metric(upm 2048·ascent 1950·descent -494)이
// 원본과 동일해 Next가 같은 override를 재계산 → CLS 변화 없음. 한글은 Arial에 글리프가
// 없어 이 조정이 적용되지 않고 Apple SD Gothic Neo로 넘어가는데, Pretendard가 이미 그
// metric에 맞춰 설계돼 shift가 최소. declarations로 size-adjust를 걸면 Pretendard 본체가
// rescale돼 시각 회귀가 나므로 보수적으로 미적용.
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
// */common.json의 *.hero.title* / contact.title / portfolio.title / stories.categories.*
// 키)를 변경했다면 반드시 아래를 실행하고 결과 woff2를 commit해야 한다. 빠뜨리면 새
// 글자가 micro-subset에 없어 fallback chain(Pretendard Variable → 시스템 한글)으로
// 그려져 글자별로 미세한 두께/메트릭 차이가 보일 수 있다.
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
