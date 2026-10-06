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
// metric override(size-adjust/ascent-override): next/font/local의 자동 adjustFontFallback은
// 라틴(Arial) 기준이라 한글엔 적용되지 않고(Arial에 글리프 없음) 시스템 한글 폰트로 그대로
// 떨어진다. 한글 음절 자체는 Apple SD Gothic Neo와 폭이 거의 같지만(99.9%, 실측) 중간점(·)·
// 쉼표·공백 같은 구두점은 20~30% 차이가 나 짧은 문구에서 폭 흔들림(FOUT)이 보인다(운영자
// 2026-10-07). 그래서 styles/globals.css에 'Pretendard Korean Fallback'을 한글 전용
// unicode-range + size-adjust/ascent-override로 따로 선언해 두고, 아래 fallback 배열로
// 끌어온다 — 계산 근거·메트릭 출처는 그 CSS 주석 참고.
//
// fallback: ['Pretendard Korean Fallback'] 하나만 — 폴백 목록 전체는 여기가 아니라
// tailwind.config.ts의 font-* 스택과 styles/globals.css의 `:root [data-locale]`이 든다.
// next/font는 이 배열을 --font-pretendard 변수 **안에** 펼쳐 넣기 때문에, 여기 한글 폰트를
// 통째로 두면 스택에서 Pretendard 바로 다음 자리를 차지해 로케일 폰트(--font-locale)가
// 끼어들 수 없다. 그래서 zh 한자가 Apple SD Gothic Neo(한국식 자형)로 그려졌다(2026-09-25).
// 이번 항목은 그 재발을 피하려고 unicode-range를 한글 syllable·jamo + 실제 쓰인 구두점
// 5종(공백·쉼표·마침표·NBSP·중간점)으로 좁혀 뒀다 — 한자·태국문자는 이 range 밖이라 매칭되지
// 않고 그대로 --font-locale로 간다(해당 CSS 주석에 근거 상세). 변수에는 이 항목과 next/font가
// 만드는 Arial 기준 메트릭 조정 폴백("pretendard Fallback")이 함께 남는다.
export const pretendard = localFont({
  src: './fonts/pretendard-variable.woff2',
  weight: '45 920',
  style: 'normal',
  display: 'swap',
  preload: false,
  variable: '--font-pretendard',
  fallback: ['Pretendard Korean Fallback'],
});

// 디스플레이 서체 서브셋 — hero h1 + v2 섹션 제목(.typo-display-section)이 쓰는 글자만(~80KB, preload).
//
// 2026-10-06 라이너 노트(docs/design-liner-notes-plan-2026-10.md §3-2)부터 제목은 Pretendard가 아니라
// 디스플레이 서체다. 2026-10-07 운영자가 세리프(Hahmlet)를 "촌스럽다"며 반려해 이 브랜치는
// **Paperlogy Bold**(Freesentation, OFL 1.1, 기하 산세리프)로 비교한다 — 비교 쌍은 feat/liner-font-suit.
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
  // display: 'optional' — Paperlogy는 Pretendard와 달리 시스템 고딕체와 글자 폭이 많이 달라
  // swap 전환 시 h1 줄바꿈이 바뀌며 티나게 움직인다(운영자 2026-10-07 "불러올때 한번 꿈틀한다").
  // optional은 제때(프리로드 중) 도착하면 바로 Paperlogy로 그리고, 못 받으면 그 세션은 폴백을
  // 유지한다 — 전환 자체가 없어 꿈틀거림이 없다. preload=true라 대부분 제때 도착한다.
  display: 'optional',
  preload: true,
  variable: '--font-display',
  // 위 pretendard와 같은 이유로 비운다 — font-hero 스택(tailwind.config.ts)이
  // var(--font-pretendard) → var(--font-locale) → 시스템 폰트를 이어서 든다.
  fallback: [],
});
