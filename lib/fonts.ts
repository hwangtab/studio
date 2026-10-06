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
//
// fallback: [] — 폴백 목록은 여기가 아니라 tailwind.config.ts의 font-* 스택과
// styles/globals.css의 `:root [data-locale]`이 든다. next/font는 이 배열을
// --font-pretendard 변수 **안에** 펼쳐 넣기 때문에, 여기 한글 폰트를 두면 스택에서
// Pretendard 바로 다음 자리를 차지해 로케일 폰트(--font-locale)가 끼어들 수 없다.
// 그래서 zh 한자가 Apple SD Gothic Neo(한국식 자형)로 그려졌다(2026-09-25).
// 변수에는 Pretendard와 next/font가 만드는 메트릭 조정 폴백("pretendard Fallback")만 남긴다.
export const pretendard = localFont({
  src: './fonts/pretendard-variable.woff2',
  weight: '45 920',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-pretendard',
  fallback: [],
});

// 디스플레이 서체 서브셋 — hero h1 + v2 섹션 제목(.typo-display-section)이 쓰는 글자만(~80KB, preload).
//
// 2026-10-06 라이너 노트(docs/design-liner-notes-plan-2026-10.md §3-2)부터 제목은 Pretendard가 아니라
// 디스플레이 서체다. 2026-10-07 운영자가 세리프(Hahmlet)를 "촌스럽다"며 반려해 이 브랜치는
// **SUIT Bold**(sun-typeface, OFL 1.1, 기하 산세리프)로 비교한다 — 비교 쌍은 feat/liner-font-paperlogy.
// 본문·버튼·숫자는 위 pretendard 그대로. 생성·글자 수집 범위·서체 스위치
// (DISPLAY_FONT=hahmlet|maruburi|pretendard|suit|paperlogy)는 scripts/generate-hero-font.mjs 머리말.
// preload=true라 다른 critical 리소스와 동시 fetch — 옛 hero 서브셋(36KB)보다 큰 만큼 LCP를 simulate로 재서
// 넘으면 hero 글자만 담은 파일과 제목용 파일로 가른다(설계 §3-2).
//
// ⚠️ 운영 주의 — hero h1·섹션 제목·data/*.ts의 title 문자열을 바꿨다면 아래를 실행하고 display.woff2 +
// display.chars.json을 함께 commit해야 한다. 빠뜨리면 새 글자가 서브셋에 없어 Pretendard로 그려져 한 제목
// 안에서 글자 모양이 갈린다 — hero-font-subset.test.js가 --check로 CI에서 잡는다.
//
//   node scripts/generate-hero-font.mjs
export const displayFont = localFont({
  src: './fonts/display.woff2',
  weight: '700',
  style: 'normal',
  display: 'swap',
  preload: true,
  variable: '--font-display',
  // 위 pretendard와 같은 이유로 비운다 — font-hero 스택(tailwind.config.ts)이
  // var(--font-pretendard) → var(--font-locale) → 시스템 폰트를 이어서 든다.
  fallback: [],
});
