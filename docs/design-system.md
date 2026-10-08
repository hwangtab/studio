# Studio NOL 디자인 시스템

이 문서가 **정본**이다. 새 화면을 만들거나 기존 화면을 고칠 때 여기 있는 토큰·컴포넌트를
먼저 쓰고, 원시 Tailwind 유틸리티로 같은 역할을 다시 만들지 않는다.

정의 위치: `tailwind.config.ts`(토큰·`.typo-*`·`.glass-*`), `styles/globals.css`(CSS 변수·전역 타이포),
`components/ui/`(프리미티브), `utils/animationUtils.ts`(모션).

> 2026-09-11 전수 감사에서 나온 결론: **토큰은 잘 설계돼 있는데 채택률이 낮다.**
> 불일치의 대부분은 시스템 클래스가 있는데 원시 유틸리티로 다시 짠 경우다.
> 미해결 부채는 이 문서 마지막 절에 남긴다.

## 0. 가장 중요한 규칙 — 정의되지 않은 클래스는 조용히 사라진다

Tailwind는 정의되지 않은 클래스명을 **에러 없이 빌드 CSS에서 빠뜨린다.** 타입체크도 lint도
문자열이라 못 잡는다. 이 저장소에서 두 번 사고가 났다.

| 사고 | 내용 |
|---|---|
| 2026-08-13 | `bg-kakao`·`text-kakao-ink`를 붙이면서 색 토큰을 추가하지 않아, 유일하게 검증된 전환 채널인 카카오 버튼이 **약 20시간 배경·글자색 없이** 렌더됐다 |
| 2026-09-11 | `typo-button`·`typo-caption`·`typo-body`가 6곳에서 쓰이는데 정의가 없어, 404/500 버튼과 연습실 캡션이 스타일 없이 렌더되고 있었다 |

`tailwind.config.test.ts`가 **색 토큰과 `.typo-*` 클래스 양쪽**을 스캔해 미정의 사용을 CI에서
막는다. 새 브랜드 토큰이나 컴포넌트 클래스를 만들면 이 테스트의 스캔 범위에 들어오는지
확인할 것.

## 1. 색

### 브랜드 토큰

| 토큰 | light / DEFAULT / dark | 용도 |
|---|---|---|
| `primary` | `#059669` / `#065f46` / `#0b3b2c` · lighter `#6ee7b7` | 1차 액션, 강조, 링크. **에메랄드** — 로고(`public/logo/logo.png`) 녹색 계열을 유지하되 2026-10-07 2차 개정으로 올리브 톤을 벗고 더 선명하게 틀었다. DEFAULT 흰 7.68:1·paper-2 약 7.0:1, dark는 흰 글씨 12.5:1(히어로 잉크 면·큰 면). 값의 정본은 `lib/brandColor.ts` — 메일 HTML·정적 카드·theme-color가 같은 값을 쓴다 |
| ~~`secondary`~~ · ~~`accent`~~ | 삭제됨 (2026-10-06) | 핑크·에메랄드(옛 accent)는 없다. 브랜드색은 `primary` 하나, 성공은 `green-*`, 다크 텍스트 짝은 `primary-lighter` 하나. `tailwind.config.test.ts`가 재등장을 막는다 |
| `paper` | `#ffffff` / `paper-2` `#f2f5f3` | 라이트 바탕 두 단 — body·Layout·Section default/alternate. 2026-10-07 2차 개정: 1차의 따뜻한 베이지(`#faf7f2`/`#f2ede4`)가 올리브 그린과 짝지어 "텁텁하다"는 반려를 받아, 차갑고 깨끗한 순백/근접백으로 교체. 글래스 카드 틴트(흰 0.72)는 그대로라 카드가 paper-2보다 살짝 밝게 뜬다 |
| `kakao` | `#FEE500` / hover `#FADA0A` / ink `#191600` | **카카오톡 진입점 전용** |

`gray` 50~950은 커스텀 스케일이다(`500`을 `#4b5563`로 어둡게 조정 — WCAG AA). 다크 바탕은 gray-900 그대로다.
**slate·zinc·neutral·stone은 쓰지 않는다.** 회색은 `gray` 하나다.

> 2026-10-06 **라이너 노트**(`docs/design-liner-notes-plan-2026-10.md`): 보라 primary를 로고의 녹색으로, 순백을 종이로
> 바꿨다. **2026-10-07 운영자가 이 1차 값을 "텁텁하다"며 반려** — 종이(베이지)를 순백/쿨그레이로, primary를
> 올리브에서 에메랄드로 다시 틀었다(2차 개정, 위 표가 그 값). 서체·히어로·CTA 위계는 그 문서 §3-2~3-4를 따른다.

### 카카오 옐로 — 양방향 규칙

- 목적지가 카카오톡인 링크는 **전부** 옐로, 카카오가 아닌 링크에는 **절대** 옐로를 쓰지 않는다.
- 옐로 위 글자·아이콘은 **항상 `text-kakao-ink`**. 흰 글씨는 대비 1.3:1로 WCAG 미달이다.
- 비-ko 로케일은 같은 자리라도 목적지가 `/contact` 폼이므로 옐로 금지.
- `yellow-*` 원시 유틸리티는 쓰지 않는다. 노란색이 카카오 말고 다른 의미를 갖는 순간
  "노란 건 카톡"이라는 학습이 무너진다. 별점·경고는 아래 상태색을 쓴다.

### 상태색

| 의미 | 토큰 |
|---|---|
| 성공 | `accent` 또는 `green-*` |
| 오류 | `red-*` (`rose-*` 쓰지 않는다) |
| 경고·주의 | `amber-*` (`yellow-*` 금지 — 카카오와 충돌) |
| 정보 | `blue-*` |
| 별점 | `amber-400` |

### 다크모드

`.dark` 클래스 전략이다(`components/Layout.tsx`가 `<html>`에 토글). 배경·텍스트·보더를 지정하는
모든 곳에 `dark:` 짝을 함께 쓴다. 라이트 고정 예외는 두 곳이다 — `pages/admin/**`(운영자 전용
백오피스)과 계약 서명·완료 화면(`pages/[locale]/contracts/[id]/{sign,complete}.tsx`, 종이처럼
보여야 하는 법적 문서). 두 경로에도 `theme-init.js`가 `<html class="dark">`를 붙이므로, 라이트
고정은 "다크 스타일을 안 쓰는 것"이 아니라 **`dark:` 짝을 라이트 값으로 되돌려 쓰는 것**이다.

#### 브랜드색 텍스트는 다크 짝을 함께 쓴다

`primary`·`secondary`·`accent`의 DEFAULT는 **흰 배경에서 AA를 통과하도록** 고른 값이다
(secondary·accent는 그래서 -700 계열로 승격돼 있다). 같은 이유로 다크 배경에서는 반대로
너무 어둡다. 2026-09-11 실측(프로덕션, 알파 합성 + 대형 텍스트 완화 적용)에서 8개 페이지
1,273개 인터랙티브 요소 중 **41건**이 이것 때문에 미달했다.

해결은 새 토큰이 아니라 **이미 있는 변형**이다. 배경 `gray-900`(`#030712`) 기준 실측:

| 토큰 | 값 | 대비 | 다크 텍스트로 |
|---|---|---|---|
| `primary`(DEFAULT) | `#065f46` | 2.62:1 | ✗ |
| `primary-light` | `#059669` | 5.34:1 | ✗ (쓰지 말 것 — 토큰 역할상 "작은 텍스트 아님" 규칙을 유지, `tailwind.config.test.ts`의 허용 다크 짝은 `primary-lighter` 하나뿐이다) |
| `primary-lighter` | `#6ee7b7` | 13.2:1 | ✓ |

(2026-10-07 2차 개정 값. 1차 라이너 노트·보라 시절 수치는 git 이력에 있다.)

따라서 짝은 하나다 — `text-primary` + `dark:text-primary-lighter` (secondary·accent 짝은 토큰과 함께 2026-10-06에 지웠다).
`hover:`·`group-hover:`·`focus-visible:` 같은 variant도 **같은 variant의 다크 짝**이 필요하다
(`hover:text-primary` → `dark:hover:text-primary-lighter`). 아이콘은 `stroke`/`fill`이
currentColor라 같은 텍스트 색 규칙을 그대로 따른다.

`tailwind.config.test.ts`의 「브랜드색 텍스트의 다크 짝」이 CI에서 이를 강제한다. 텍스트가
아닌 자리(체크박스·라디오의 채움색, `opacity-10` 장식 워터마크)만 `BRAND_TEXT_ALLOW`에
**이유와 함께** 등재한다 — 이유 없이 넣으면 가드가 무의미해진다. 라이트 고정 경로
(`pages/admin/**`·계약 서명·완료)는 스캔에서 제외된다: 흰 카드 위에 밝은 보라를 올리면
대비가 **오히려** 깨진다.

#### 다크 짝은 "있는지"가 아니라 "충분한지"를 본다 (2026-09-11 2라운드)

1라운드 가드는 `dark:text-` 짝의 **존재**만 봤다. 그래서 `text-primary
dark:text-primary-light`가 통과했는데 그 짝 자체가 3.53:1로 미달이었다 — 자물쇠를 걸고
열쇠를 옆에 걸어 둔 꼴이다. 측정 범위도 링크·버튼(`a`·`button`)에 한정돼 있어
`<span>`·`<div>`·`<strong>` 같은 일반 텍스트를 통째로 빠뜨렸다.

범위를 **텍스트 노드를 직접 가진 모든 엘리먼트**로 넓혀 다시 재니 같은 8개 페이지에서
**71건**이 더 나왔다(pricing 17 · practice-room 19 · recording 10 · release-project 9 ·
portfolio 8 · 홈 4 · about 4). 세 부류였다.

| 부류 | 원인 | 조치 |
|---|---|---|
| A | `dark:text-primary-light`(3.53:1) — 가장 많다 | 전부 `dark:text-primary-lighter`로 승격. `dark:text-accent`(3.67:1)·`dark:text-primary`(2.83:1)·`dark:text-primary/80`도 같이 |
| B | 메타·캡션이 `dark:text-gray-500`(2.45:1)이거나 다크 짝이 아예 없음 | 아래 역할표대로 `dark:text-gray-400` |
| C | portfolio·AudioPlayer의 임의 hex 패널 위 `dark:text-white/40`(3.78:1) | `dark:text-white/60`(7.4:1). 임의 hex 자체는 별도 부채로 남긴다 |

대형 텍스트(24px↑ 또는 18.66px↑ bold)는 완화 기준 3:1이라 `primary-light`가 산술적으로는
통과하지만 **함께 올렸다.** 클래스 문자열만 보고는 그 자리가 대형인지 알 수 없고, 같은
컴포넌트(`PricingCard`·`PriceLeader`)가 작은 자리에 재사용되면 조용히 깨진다. 그래서
`primary-light`는 크기와 무관하게 다크 짝으로 금지한다.

`tailwind.config.test.ts`의 「다크 짝의 대비가 충분한가」가 이를 CI에서 강제한다. 예외는
`DARK_BRAND_ALLOW`에 **이유와 함께** 등재한다(현재 1건 — `Button`의 `light` 옵트인).

#### 다크 짝을 "추가하는 행위" 자체가 hover 색을 죽인다 (2026-09-11 3라운드)

`dark:text-*`를 붙이는 순간 **같은 요소의 non-dark `hover:text-*`가 적용되지 않는다.**
Tailwind가 내는 `.dark\:text-x:is(.dark *)`와 `.hover\:text-white:hover`는 명시도가
둘 다 `(0,2,0)`으로 **같고**, `dark:` 규칙이 CSS에서 **뒤에** 나오기 때문이다. 1·2라운드
가드는 "다크 짝이 있는가 / 충분한가"만 봤으므로 이 회귀를 초록 CI로 통과시켰다 — 53곳.

아웃라인 pill(`border-2 border-primary text-primary dark:text-primary-lighter
hover:bg-primary hover:text-white`)에서 hover 실측:

| | 다크 짝 추가 전 | 추가 후(회귀) | `dark:hover:` 짝까지 넣은 뒤 |
|---|---|---|---|
| primary | 7.10:1 | **2.61:1** | 15.6:1 |
| secondary | 5.48:1 | **1.71:1** | 8.6:1 |
| accent | 6.04:1 | **2.16:1** | 6.4:1 |

따라서 **`dark:text-*`와 `hover:text-*`는 항상 같이 다닌다** — `hover:text-white`에는
`dark:hover:text-white`, `group-hover:text-primary-dark`에는 `dark:group-hover:text-primary-lighter`.
`dark:hover:`는 명시도 `(0,3,0)`이라 둘 다 이긴다. `focus-visible:`·`focus:`도 같다.

`tailwind.config.test.ts`의 「다크 짝이 variant 색을 덮어쓰지 않는가」가 이를 CI에서 막는다.
같은 라운드에서 짝 검사 범위도 **줄 전체 → 문제 토큰이 든 문자열 리터럴**로 좁혔다:
`isActive ? 'text-primary' : 'text-gray-900 dark:text-white'`에서 **다른 분기의**
`dark:text-white`를 짝으로 오인해 활성 트랙 제목(2.64:1)을 통과시킨 적이 있다.
가드가 면제하는 라이트 고정 계약 라우트도 이 문서와 같게 서명·완료 **두 장으로** 좁혔다.

남은 부채: `AudioPlayer`·포트폴리오 카드의 `dark:bg-[#121212]`·`#1a1a1a` 같은 임의 hex.
이번엔 그 위의 **텍스트 색만** 올렸고, 배경을 `gray` 토큰으로 바꾸는 것은 별건이다.

본문 회색의 역할별 기본값:

| 역할 | 라이트 | 다크 |
|---|---|---|
| 제목 | `text-gray-900` | `dark:text-white` |
| 본문 | `text-gray-700` | `dark:text-gray-300` |
| 보조·설명 | `text-gray-600` | `dark:text-gray-400` |
| 메타·캡션 | `text-gray-500` | `dark:text-gray-400` |

## 2. 타이포그래피

본문·UI·숫자는 **Pretendard Variable**, 제목은 **디스플레이 세리프**(기본 Hahmlet, OFL) — 2026-10-06 라이너 노트 §3-2.
`sans`/`title`/`display`/`logo` 네 토큰은 Pretendard를 가리키고, `hero`가 디스플레이 서체다. `hero`는 hero h1과
v2 섹션 제목(`.typo-display-section`)이 쓰는 글자만 담은 ~80KB 서브셋(`lib/fonts/display.woff2`)에 `preload:true`라
LCP 경로에서 거의 즉시 swap된다. 카드 제목·버튼·가격 숫자·스토리 마크다운 제목은 Pretendard 그대로다(세리프 숫자는
가격표에서 약하다). hero h1·섹션 제목·`data/*.ts`의 title 문자열을 바꾸면 `scripts/generate-hero-font.mjs`를 돌려
woff2와 `display.chars.json`을 **함께 커밋**해야 한다(CI가 `--check`로 잡는다). 서체 후보 비교는 `DISPLAY_FONT=maruburi`
같은 스위치로 같은 파일명에 생성한다 — `lib/fonts.ts`는 바뀌지 않는다.

### 역할 클래스 — 이걸 쓴다

| 클래스 | 크기/굵기 | 쓰는 곳 |
|---|---|---|
| `.typo-section-title` | 2.5rem / 700 | 섹션 제목(h2) |
| `.typo-section-lead` | 1.25rem / 500 | 섹션 부제 |
| `.typo-page-title` | 1.5rem / 700 | 트랜잭션·결과 페이지 h1(예약 완료, 서명, 관리) |
| `.typo-card-title` | 1.5rem / 700 | 카드 제목 |
| `.typo-card-subtitle` | 1.125rem / 700 | 카드 소제목 |
| `.typo-card-body` | 1rem / 300 | 카드 본문 |
| `.typo-body` | 1rem / 300 | 일반 본문 |
| `.typo-card-cta` | 1rem / 500 | 카드 안 CTA 라벨 |
| `.typo-button` | 1rem / 500 | 버튼 라벨 |
| `.typo-card-meta` | 0.875rem / 300 | 메타 정보 |
| `.typo-caption` | 0.75rem / 300 | 캡션·주석 |
| `.typo-nav-link` / `.typo-footer-*` | — | 내비·푸터 전용 |

마케팅 히어로 h1만 예외로 `font-hero text-5xl md:text-7xl lg:text-8xl`을 쓴다(`ImageHero`가 담당).

**하지 말 것**: 카드·섹션 제목을 `text-lg font-bold` 같은 원시 조합으로 새로 만들기. 역할
클래스에는 크기뿐 아니라 자간(-0.01~-0.02em)과 라이트/다크 색까지 들어 있어, 원시 조합으로
만들면 같은 위계인데 자간만 다른 제목이 섞인다.

## 3. 간격·레이아웃

### 섹션

페이지 섹션은 **항상 `components/ui/Section.tsx`를 경유**한다. 직접 `<section className="py-…">`을
쓰지 않는다.

| `spacing` | 값 | 쓰는 곳 |
|---|---|---|
| `default`(생략) | `py-16 md:py-24` | 일반 섹션 |
| `tight` | `py-10 md:py-12` | 짧은 고지·요약 밴드 |
| `loose` | `py-20 md:py-32` | 히어로 직후 등 강조 구간 |

컨테이너는 Section이 제공한다: `container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl`.
좁은 본문이 필요하면 안쪽에 `max-w-3xl mx-auto`를 쓰고, 컨테이너를 다시 선언하지 않는다.

### 반경 — 네 단, 역할로 정한다 (2026-10-05 개정)

| 단 | 값 | 대상 |
|---|---|---|
| 컨트롤 | `rounded-lg` (8px) | input·select·textarea |
| 카드급 | `rounded-xl` (12px) | 카드(BaseCard)·고르는 항목(ChoiceCard)·안내/상태 박스(Notice·Panel)·접기(Disclosure)·카드·폼 안의 버튼 |
| 패널급 | `rounded-2xl` (16px) | 모달·결과 카드(ResultCard)·빈 상태(EmptyState)·독립 글래스 패널 |
| 알약 | `rounded-full` | 자유 배치 CTA(히어로·스티키·FAB)·배지·칩·알약 선택지 |

**`rounded-md`는 어느 역할에도 없다.** 2026-10-04 조사에서 예약·구독·연락처 흐름이 `md`,
개설자가 `lg`, 펀딩이 `xl`, 마케팅이 `2xl`로 — 같은 사이트에 네 가지 손맛이 섞여 있었다.
`PricingCard`의 `rounded-3xl`(동심원 24px/12px)만 예외로 남긴다.
`components/ui/uiPatterns.baseline.test.ts`가 `rounded-md`를 기준선 대비로 막는다(늘면 실패).

### 패딩 — 세 단

| 단 | 값 | 대상 |
|---|---|---|
| compact | `p-4` | 안내/상태 박스·요약·고르는 항목 |
| default | `p-6` | 카드 |
| roomy | `p-6 sm:p-8` | 결과 카드·모달 본문·독립 패널 |

### 테두리·선택 상태

- 테두리는 한 종: `border border-gray-200 dark:border-gray-700`. `border-2`·`border-l-4`로 강조하지 않는다.
- 강조는 `border-primary` + `ring-1 ring-primary/30`(다크 `primary-lighter`)로만.
- **선택 상태는 틴트다**: `border-primary bg-primary/5 dark:bg-primary-lighter/10`. 채움(`bg-primary text-white`)은
  설명 없는 짧은 라벨(세그먼트·칩·시간 슬롯)에만 쓴다. 판정은 `:has(:checked)` — JS 삼항으로 클래스를
  바꾸지 않는다(`ChoiceCard`).
- 눈에 보이는 라디오·체크박스의 틴트는 **`accent-primary`**. `text-primary`는 forms 플러그인이 없어
  네이티브 입력에 아무 효과가 없다(크롬 기본 파랑이 뜬다).

### 거래 화면 뼈대 — `components/ui/PageHeader.tsx`

예약·주문·펀딩 결제·구독·관리·결과처럼 히어로가 없는 화면은 `PageShell` + `PageHeader`로 시작한다.

| 요소 | 규칙 |
|---|---|
| 폭 | `PageShell width`: `form`(max-w-2xl, 폼·관리) · `result`(max-w-lg, 결과) · `wide`(max-w-3xl, 목록·개설자) |
| 세로 여백 | `py-12 sm:py-16` 하나. Layout이 `pt-20`을 이미 넣는다 — 더하지 않는다 |
| `<main>` | Layout이 제공한다. 페이지가 다시 만들지 않는다(2026-10-04 조사: 전 거래 화면이 main을 겹쳐 두고 있었다) |
| 머리 | 브랜드 줄(헤더 없는 화면만) → 뒤로 링크 → `typo-page-title` h1 → 리드 → `Stepper` |
| 단계 | `Stepper` — "STEP 1 / 2" 텍스트 금지 |
| 금액 | `PriceSummary` — 항목별 `dl` + 부가세 + 합계. 합계 한 줄만 쓰지 않는다 |
| 결과 | `ResultCard` — tone 아이콘 원 + 제목 + 설명 + `Button` 행동 |
| 1차 CTA | **반드시 `Button`**. 결과·관리 화면의 손으로 짠 `<a>`(11곳)는 1단계에서 걷는다 |

### 그리드

같은 성격의 카드 그리드는 브레이크포인트를 통일한다: **2열은 `sm:grid-cols-2`, 3열은
`lg:grid-cols-3`, 4열은 `lg:grid-cols-4`**, gap은 `gap-6`(카드) / `gap-4`(조밀한 목록).

### 히어로

`ImageHero`가 담당한다. `minHeight`는 **뷰포트를 채우는 랜딩 히어로만 `svh`**(모바일 URL바 대응),
나머지는 `vh`. 히어로가 없는 페이지는 `Layout`이 `pt-20`을 넣으므로 첫 섹션에서 상단 여백을
따로 계산하지 않는다(`NextPageWithLayout.hasHero`로만 분기).

## 4. 컴포넌트

### 버튼 — `components/ui/Button.tsx`

버튼·버튼처럼 보이는 링크는 이걸 쓴다. `<a>`/`<Link>`에 직접 스타일을 입히지 않는다.
링크로 쓸 때는 `asChild`로 감싼다.

| variant | 용도 |
|---|---|
| `solid` | 1차 액션 — 잉크(라이트 `gray-950` 위 흰 글씨, 다크는 흰 버튼 위 잉크 글씨) |
| `inverse` | 어두운 히어로 사진 위 1차 액션(흰 버튼 + 잉크 글씨, 테마 무관) |
| `kakao` | 카카오톡 목적지 전용 |
| `outline` / `ghost` / `secondary` | 2차·3차 액션(`outline`은 잉크 테두리) |
| `glass` | 글래스 표면 위 |
| `scrim` | 어두운 히어로 이미지 위 2차 액션 |

`shape`: `pill`(자유 배치 CTA) / `block`(카드·폼 안). `size`: `sm`/`md`/`lg`/`icon`.

**버튼은 잉크, 녹색은 표시** (2026-10-08 운영자 결정): 브랜드 녹색은 링크·가격 숫자·배지·현재 위치·선택
상태가 함께 써서, 녹색 버튼은 "누르는 것"으로 구분되지 않았다. 행동 버튼(`solid`·`outline`과 손으로 짠
재생·주문 버튼)은 잉크, 녹색 채움은 선택·진행 상태(필터·페이지 번호·단계·시간 슬롯)에만 둔다.
한국어 페이지의 주 행동은 카카오 옐로이고, 옐로 + 잉크는 위계가 충돌하지 않는다.

**히어로 위계**: 1차가 카카오 옐로면 2차는 `solid`를 쓰지 않는다 — 어두운 사진 위에서
채움 버튼이 옐로와 경쟁해 위계가 뒤집힌다(잉크는 사진에 묻히기도 한다). 2차는 `scrim`(어두운 반투명 + 흰 테두리 +
text-shadow). 흰 틴트(`bg-white/*`)는 배경을 밝혀 흰 글씨 대비를 떨어뜨리므로 쓰지 않는다.

### 폼 — `components/ui/Field.tsx`

레이블·필수 표시·에러·도움말·다크모드가 한 컴포넌트에 들어 있다. 폼마다 input 클래스
문자열을 새로 만들지 않는다.

- 컨트롤: `rounded-lg`, `px-3 py-2`, `border-gray-300 dark:border-gray-600`
- 필수: 레이블 뒤 `*`(`text-red-600`) + `aria-required`
- 에러: `border-red-500` + 컨트롤 아래 `text-xs text-red-600`, `aria-invalid`·`aria-describedby` 연결
- 포커스: 아래 포커스 규칙과 동일 (`focus-visible`)
- 라이트 고정 화면(위 다크모드 절의 두 예외)에서는 컨트롤에 **`light` prop**을 넘긴다
  (`<TextInput light />`). 래퍼(레이블·힌트·에러)는 `lightOnlyField`를
  `Field`의 `className`으로 준다. **같은 클래스를 문자열로 `className`에 얹지 말 것** —
  `cn`은 twMerge라 뒤에 온 `dark:border-gray-300`이 오류 테두리의 `dark:border-red-500`을
  지운다. 합성 순서는 `fieldControlClass → light → invalid → className`으로 고정돼 있고,
  `Field.test.tsx`의 "light 옵트인" 케이스가 이 순서를 지킨다.

### 카드 — `components/ui/BaseCard.tsx`

variant: `default`·`highlight`·`outline`·`glass`·`glass-highlight`. 기본 재질은 `.glass-card`
(blur 없는 글래스)다. **glass 카드 hover에 `SHADOW_HOVER`를 섞지 않는다** — inline boxShadow가
inset 스펙큘러를 지운다.

### 티어 카드와 노란 띠 — `PricingCard kakaoEmphasis` · `components/common/KakaoSectionBar.tsx` (2026-10-06)

티어 카드가 행으로 놓이는 자리(LP 가격 절·가격 페이지)에서는 카드 안에 솔리드 옐로를 두지 않는다 — 한 행에 노랑이
셋이면 신호가 소음이 된다(라이너 노트 §3-4). 규칙:

- `<PricingCard kakaoEmphasis="band">`: 카드는 온라인 주문·예약(`secondaryCta`)을 **잉크 solid 블록**으로 올리고 카카오
  CTA는 그리지 않는다. 비-ko(/contact 목적지)는 영향 없다. 카드가 혼자 있는 자리는 기본값 `'solid'`.
- 행 아래 `<KakaoSectionBar>` **하나** — 띠 전체가 카카오 목적지 링크 하나다(`bg-kakao` + `text-kakao-ink` + pill + 포커스 링,
  `ctaButtonContract`가 본다). 문구는 카드가 못 하는 말("어디에 해당하는지 모르겠다면 세션 화면을 보내 주세요")이고
  키는 **그 페이지가 싣는 i18n 섹션** 안에 둔다(`mixingMastering.tierBar.*` 등 — `pricing.*`에 두면 그 섹션을 안 싣는 LP에서
  키 이름이 그대로 찍힌다. `content/i18nKeys.test.ts`가 잡는다).
- 카카오 목적지를 잉크 텍스트 링크로 "조용히" 그리는 안은 쓰지 않는다 — 카카오 목적지 = 옐로 규칙(§1)에 어긋나고
  계약 테스트가 막는다. 노랑을 줄이는 방법은 **개수**(띠 하나)뿐이다.
- 데스크톱 뷰포트당 솔리드 옐로 ≤ 2(헤더 + 띠 또는 히어로).
- 카드 재질: 종이 위 흰 카드 + 괘선(`variant="outline"` + `bg-white`), 그림자 없음. 추천 카드만 `border-primary ring-1`.
  배지는 `actions.popularBadge`("가장 많이 고르는") — 영문 `RECOMMENDED`는 없앴다.

### 소리 — `components/audio/GlobalPlayerProvider.tsx` · `GlobalPlayerDock` · `ServiceExcerpt` · `CoverPlayButton` (2026-10-06)

사이트의 소리는 **한 번에 하나만** 난다(`lib/audio/audioBus.ts`: 재생을 시작하는 쪽이 `announcePlay`, 나머지는 `onOtherPlay`로
멈춘다 — 글로벌 플레이어·믹싱 전후 비교·포트폴리오 플레이어 셋이 서로 모른 채 겹치지 않는다). 규칙:

- 30초 발췌·커버 재생은 전부 `useGlobalPlayer().play(track)` 하나로 들어온다. `<audio>`는 `_app`의 Provider가 하나만 갖고
  **첫 재생에서야 만든다**(`preload="none"`, 재생 전 0바이트 — /ko/portfolio LCP 21s 사고의 교훈). 도크 청크도 첫 재생 때 받는다.
- 도크는 잉크(gray-950) 단색, 데스크톱 좌하단(우하단은 카카오 FAB 행), 모바일 바닥 바. 전폭 하단 바가 이미 있는 화면
  (스토리·펀딩·공연 상세, 결제·예약 마법사)에서는 모바일 바를 숨긴다. 파형 막대는 트랙 id로 고정된 장식이다 — 실제 파형이 아니다.
- 재생 아이콘은 버튼이 아니라 오디오의 `playing`/`pause` 이벤트를 따라간다(블루투스 해제·통화·미디어 키).
- 발췌 데이터는 `data/audioExcerpts.ts` 한 곳. 파일은 `public/audio/excerpt-<slug>-<YYYYMMDD>.mp3`(256k·30초·페이드 0.25/0.8).
  LP의 발췌 줄(`ServiceExcerpt`)은 **절이 아니라 절 안의 블록**이고, 그 서비스에 발췌가 없으면 아무것도 그리지 않는다.
  커버 위 재생 버튼(`CoverPlayButton`)은 `<a>` 안이 아니라 **형제**로, 정사각 오버레이 안에 44px.
- 계측은 `micro_audio_play`(트랙당 세션 한 번, component = 자리, cta_id = 트랙 id). 리드가 아니다.
- 작은 썸네일 반경은 `rounded-lg`(`rounded-md`는 §3대로 없다).

### 괘선 목록 — `components/ui/RuleList.tsx` (2026-10-06)

**읽는 것은 카드가 아니다.** FAQ 요약·절차·이유처럼 나란히 읽는 항목은 `RuleList`(굵은 괘선 위 번호·제목·본문 — 홈 "이유" 절의
문법)로 그린다. 떠 있는 카드(BaseCard·ChoiceCard)는 **고르는 것**(티어·리워드·시간 슬롯)에만. `numbered`는 순서가 정보일 때(`<ol>`),
`labelPrefix="Q"`는 FAQ 요약처럼 라벨만 필요할 때(`as="ul"`). 카드 그리드에 걸던 hover 스케일·스크롤 모션은 없다.
`QuickAnswers`와 LP 절차 절(믹싱·녹음·축가·커버)이 이걸 쓴다.

### 서비스 링크 pill — `components/ui/ServiceLinkPill.tsx`

브랜드색 아웃라인 링크 pill(`<ServiceLinkPill href tone="primary|secondary|accent">라벨</ServiceLinkPill>`).
홈·contact·about·pricing·studio-info·portfolio·mixing-mastering·stories 하단의 "다른 서비스
바로가기" 줄과, 그 줄을 감싸는 두 셸(`ServiceQuickLinksSection`·연습실 `ServiceLinksSection`)이
전부 이걸 쓴다. `prefetch={false}`가 기본값이고(fold 안에 pill이 무더기로 놓여 목적지의 SSG
JSON을 한꺼번에 당겨오는 것을 막는다), 라벨 뒤 화살표는 `showArrow={false}`로 끈다.
패딩·반경 같은 차이는 `className`으로 넘긴다 — twMerge라 뒤가 이긴다.

**직접 짜지 말 것.** 이 pill은 접근성 회귀 **두 번의 진원지**였다. 같은 className이 9개
파일에 45번 복붙돼 있었고, 다크 텍스트 대비 미달(§1 1·2라운드)도 다크 짝이 `hover:text-white`를
명시도로 덮어쓴 회귀(§1 3라운드)도 전부 그 45곳에서 났다. 한 번은 고쳐도 다음 복붙이
옛 문자열을 도로 심는다. 게다가 **45곳 전부 `focus-visible` 링이 없었다** — 키보드 사용자는
포커스 위치를 볼 수 없었고, "틀린 클래스"가 아니라 "없는 클래스"라 어떤 대비 가드도 볼 수
없었다. 세 규칙(다크 짝은 `-lighter`/`-light` · `dark:hover:` 짝 동반 · 포커스 링 + 44px)이
이제 이 파일 한 곳에만 있다.

`ServiceLinkPill.test.tsx`가 tone 3종의 포커스 링·`dark:hover:text-white`·다크 텍스트 토큰을
렌더 className으로 고정하고, `tailwind.config.test.ts`의 「아웃라인 pill은 손으로 다시 짜지
않는다」가 `border-{brand}` + `text-{brand}` + `hover:bg-{같은 brand}` 조합을 손으로 다시 심는
것을 CI에서 막는다(예외 1건 — 링크가 아닌 공유 `<button>`). **조건에 `border-2`를 넣지 않는
이유**: 흡수한 셸 둘은 `border-2`가 JSX 템플릿에 있고 색은 별도 상수에 있는 형태였다
(`ServiceQuickLinksSection`의 옛 `COLOR_CLASS`, 연습실 `ServiceLinksSection`의 per-link
className) — 같은 리터럴에서 `border-2`를 요구하면 그 형태로 되돌려도 가드가 초록이다.
스캔 범위도 카카오 토큰 가드와 같은 `components`·`pages`·`data`·`lib`·`utils`의 `.ts`까지다
(pill 클래스가 상수 파일로 옮겨가면 보이지 않으므로). 라이트 고정 화면은 다른 가드와 같게
면제한다 — 강제하면 admin·계약 서명 화면에 `dark:` 클래스를 심게 된다.

### 중간 계층 프리미티브 (2026-10-05 신설) — 손으로 짜지 않는다

2026-10-04 조사의 결론: 토큰과 위 상위 프리미티브는 좋았는데, **그 사이를 채우는 요소**에 공용
컴포넌트가 하나도 없어 흐름마다 손으로 짰다. 아래가 그 자리의 정본이다. 전부 `components/ui/`,
규칙은 `components/ui/primitives.test.tsx`가 className으로 고정한다.

| 컴포넌트 | 자리 | 핵심 규칙 |
|---|---|---|
| `ChoiceCard` / `ChoiceGroup` | 상품·리워드·티어·수단 고르기 | 카드 `rounded-xl p-4` / 알약 `rounded-full`. 선택은 `:has(:checked)` 틴트. 링은 **카드**에(`FOCUS_RING_WITHIN`). 입력 `accent-primary` |
| `Checkbox` / `Radio` | 동의·옵션 한 줄 | `accent-primary h-5 w-5`, `<label>` 44px, `focus-visible` 링 |
| `Notice` | 오류·성공·주의·정보·중립·브랜드 안내 | `rounded-xl border p-4`, tone 6종의 라이트/다크 값은 이 파일에만. error→`alert`, success→`status` |
| `Panel` | 중립 요약·규정·"선택" 구획 | `rounded-xl`, gray-50 / gray-800/50, 패딩 세 단, `inset`(카드 안)·`outline` |
| `Badge` | 상태·분류·짧은 라벨 | `rounded-full text-xs font-semibold`, sm `px-2 py-0.5` / md `px-2.5 py-1`, tone 8종. (옛 정본 `typo-caption`은 굵기 300이라 배지에 가늘어 폐기) |
| `PageShell` / `PageHeader` | 거래 화면 틀·머리 | 위 "거래 화면 뼈대" |
| `Stepper` | 단계 표시 | 완료 체크 · 현재 보라 원+링 · 예정 아웃라인. `aria-current="step"` + sr-only 요약 |
| `PriceSummary` | 금액 요약 | 항목 `dl` + 부가세 + 합계, `formatPriceAmount`만, `tabular-nums` |
| `ResultCard` | 결제 완료·실패·확인 중 | `glass-card rounded-2xl p-6 sm:p-8`, 아이콘 원 48/24, `typo-page-title` |
| `Modal` | 모달 셸 | `utils/useFocusTrapDialog`(iframe 포함)·ESC·스크롤 잠금·모바일 바닥 시트. 패널은 솔리드 |
| `EmptyState` | 빈 목록 | 점선 `rounded-2xl`, lucide 아이콘(이모지 금지) |
| `Disclosure` | 접기 한 줄 | 네이티브 `<details>`, 마커 숨김 + chevron, summary 44px + 링 |

포커스 링 문자열은 `components/ui/focusRing.ts`(`FOCUS_RING`·`FOCUS_RING_WITHIN`) 한 곳이다.

**아이콘**: lucide(`@/lib/lucide-icons`)만. 크기는 카드 머리·안내 20, 인라인·배지 16, 상태 아이콘 원
(ResultCard·EmptyState) 안 24. `text-2xl`로 크기를 주지 않는다 — lucide에는 무효라 24로 그려진다.
이모지(🌐 📭 💬)·`✓` 글리프는 쓰지 않는다.

**모션**: hover 리프트·스케일은 `Button`·`BaseCard`가 소유한다. 카드가 떠야 하면 BaseCard를 쓴다 —
CSS `hover:-translate-y`·`hover:scale` 복제가 네 가지 다른 움직임을 만들었다.

**가드** — `components/ui/uiPatterns.baseline.test.ts`. 규칙 7종(`rounded-md` · 상태 박스 손조립 · 배지
손조립 · 입력 틴트 · 원시 h1 · 이모지 · 모션 복제)을 **파일별 기준선 대비**로 본다. 기준선
`ui-patterns.baseline.json`은 2026-10-05에 **전부 0**이 됐다(184건 → 0, 세 PR) — 즉 지금은 "있으면
실패"다. 갱신은 `UPDATE_UI_PATTERN_BASELINE=1`이고 **올리는 갱신은 거부된다** — 정말 예외여야 하면
그 규칙의 `ALLOW`에 이유와 함께 등재한다(현재 1건: 비교표 강조 열). 라이트 고정 화면(계약 서명·완료)은
Notice에 `dark:bg-red-50` 같은 라이트 값을 `className`으로 덮어 쓴다 — Field의 `light` 옵트인과 같은
처방이다.

### 배지

`components/ui/Badge.tsx`를 쓴다(위 표). `rounded-full` + 12px 600, tone·size 두 축만 고른다.

## 5. 포커스 — 접근성 필수

모든 인터랙티브 요소에 **`focus-visible`** 기반 링을 준다(`focus:`가 아니다 — 마우스 클릭에도
링이 떠서 디자인이 지저분해진다).

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
```

| 표면 | 링 색 / 오프셋 색 |
|---|---|
| 일반 배경 | `ring-primary/70 dark:ring-primary-lighter/70` + `ring-offset-white dark:ring-offset-gray-900` |
| 브랜드 아웃라인 pill | tone에 맞춰 `ring-{tone}/70` + 다크는 밝은 짝 `/70`(§4 `ServiceLinkPill`) |
| 카카오 옐로 버튼 | `ring-kakao-ink dark:ring-kakao` + 표면에 맞는 오프셋 |
| 잉크 버튼(`solid`·`outline`) | `ring-gray-950/70 dark:ring-white/70` + `ring-offset-white dark:ring-offset-gray-900` |
| 어두운 히어로 이미지 위(`inverse`·`scrim`) | `ring-white/70` + `ring-offset-black/20` |
| 스토리 amber 고정 바 | `ring-primary/70 dark:ring-white/70` + `ring-offset-amber-50 dark:ring-offset-amber-900` — 다크 짝이 `primary-lighter`가 아닌 이유는 amber-900 위 2.32:1로 미달이라서다(`white/70`은 통과) |

터치 타깃은 최소 44×44px(`min-h-[44px]` 또는 `h-11`). 아이콘 전용 버튼에는 `aria-label`.

### 알파가 낮으면 "있지만 안 보이는" 링이 된다 — 기준은 4.5:1이 아니라 **3:1**

포커스 표시기는 텍스트가 아니라 **WCAG 2.2 SC 1.4.11(비텍스트 대비)**의 대상이고, 요구값은
**3:1**이다. 그리고 링은 표면색 위에 알파로 그려지므로 재는 대상은 토큰 원색이 아니라
**"링 합성색 vs 표면색"**이다. 이 문서가 오랫동안 표준으로 적어 온 `/40`은 그 기준을 어디서도
통과하지 못한다(실측, `getComputedStyle`의 `boxShadow`에서 읽은 실제 링 색 기준):

| 알파 | 라이트(#fff) | 다크(gray-900 #030712, 원색) | 다크(밝은 짝) |
|---|---|---|---|
| `/40` | primary 2.04 · secondary 2.04 · accent 1.83 ✗ | 1.33 · 1.37 · 1.47 ✗ | 2.03 · 1.74 · 2.09 ✗ |
| `/70` | **3.84 · 3.69 · 3.11** ✓ | 1.91 · 2.10 · 2.32 ✗ | **4.06 · 3.22 · 4.28** ✓ |

읽는 법 두 가지:

1. **알파는 `/70`**. `/40`은 링을 "주기는 했는데 보이지 않는" 상태다 — 코드 리뷰도 가드도
   클래스가 있으면 통과시키므로 육안·실측 말고는 드러나지 않는다.
2. **다크에서는 원색을 쓰지 않는다.** 링도 텍스트와 같은 논리로 밝은 짝
   (`primary-lighter`·`secondary-light`·`accent-light`)을 써야 3:1을 넘는다. gray-900 위
   원색은 `/70`에서도 1.91~2.32:1로 미달이다.
3. **카카오 버튼의 `ring-kakao-ink`도 라이트 전용이다**(2026-09-14에 알게 된 것).
   `#191600`은 흰 배경 위 18.16:1로 훌륭하지만, 오프셋이 `dark:ring-offset-gray-900`이라
   다크에서는 **어두운 표면 위에 검은 링**이 놓여 1.11:1 — 사실상 보이지 않는다.
   다크 짝은 `dark:ring-kakao`(`#FEE500`, gray-900 위 15.74:1)를 쓴다. 카카오 배색
   규칙과도 어긋나지 않는다 — 옐로가 곧 카카오 신호다.

### 오프셋 색은 "실제 표면"이어야 한다

링 대비는 **오프셋 색을 기준으로** 잰다. `ring-offset-2`만 쓰고 색을 빼면 Tailwind 기본값인
흰색이 들어가므로, 다크 화면에서는 재는 기준과 실제 표면이 달라 계산이 통째로 무의미해진다
(2026-09-14 실측: 카카오/전화 버튼·갤러리 화살표·AudioPlayer 슬라이더 등 다크에서 15곳).
`focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900`을 기본으로 두고,
표면이 페이지 배경이 아니면 그 색으로 맞춘다(AudioPlayer 패널 `dark:ring-offset-[#121212]`,
스토리 고정 바 `ring-offset-amber-50 dark:ring-offset-amber-900`).

반대로 **표면이 한 테마로 고정된 자리에는 다크 짝을 주지 않는다.** 흰 카드·흰 버튼 위
(`ring-offset-white`만 있고 `dark:` 오프셋 짝이 없는 줄)에 `primary-lighter/70`을 올리면
1.96:1로 **오히려 나빠진다**. 어두운 히어로 위(`ring-offset-black/20`)도 같은 이유로
`ring-white/70` 하나로 둔다. `pages/admin/**`·계약 서명·완료 화면도 마찬가지다.

`tailwind.config.test.ts`의 **'포커스 링이 실제로 보이는가'** 가드가 이 두 규칙을 CI에서
지킨다: 알파가 `/50` 미만이면 실패, 오프셋이 테마에 따라 바뀌는데 다크 짝이 없으면 실패.
예외는 `FOCUS_RING_ALLOW`에 **실측 대비값과 함께** 등재한다.

### 링은 box-shadow다 — transition에 box-shadow를 넣으면 링이 늦게 뜬다

Tailwind의 `ring-*`는 outline이 아니라 **box-shadow로** 그려진다(`--tw-ring-shadow`가
`box-shadow` 슬롯에 들어간다). 그래서 같은 요소가 box-shadow를 보간하면 — `transition-all`,
`transition-shadow`, `transition-[...box-shadow...]`, 접두사 없는 `transition` — 포커스 링이
**0px·투명에서 시작해 duration에 걸쳐 서서히 나타난다.** 2026-09-14 실측(헤더 카카오 CTA,
`transition-all duration-300`):

| t | 링 |
|---|---|
| 0ms | `0px` 투명 |
| 50ms | `0.34px` α0.06 |
| 150ms | `3.3px` α0.58 |
| 300ms | `4px` α0.70 ✓ |

클래스도(`focus-visible:ring-2`), CSS 변수도(`--tw-ring-color`), 생성된 규칙도 전부 정상이다 —
**아직 그려지지 않았을 뿐**이다. Tab으로 빠르게 넘기는 키보드 사용자는 링을 온전히 못 보고,
알파 가드는 클래스와 색이 다 맞으므로 이 형태를 그냥 통과시킨다.

규칙: **포커스 링을 가진 요소는 box-shadow를 transition 목록에 넣지 않는다.** 필요한 속성만
명시한다(`transition-transform`, `transition-[background-color,border-color,color,transform]`).
hover의 `shadow-md → shadow-lg`가 즉시 바뀌는 것은 허용된 비용이다 — 포커스 표시기가 우선이다.
`tailwind.config.test.ts`의 **'포커스 링이 늦게 나타나지 않는가'** 가드가 CI에서 지킨다.

### 포커스 링 측정은 반드시 **Tab**으로 — `.focus()`는 `:focus-visible`을 켜지 못한다

`el.focus()`는 프로그램적 포커스라 브라우저가 "보여줄 포커스"로 판정하지 않는다. 즉
`:focus-visible` 규칙이 적용되지 않으므로, `.focus()`로 잰 측정은 **링이 실제로 그려지는
상태를 한 번도 보지 못한다.** 2026-09-14 라운드가 "미달 0"이라고 잘못 보고한 원인이 이것이다.

측정은 이렇게 한다:

1. `page.keyboard.press('Tab')`으로 이동하며 `document.activeElement`를 대상으로 삼는다.
2. `el.matches(':focus-visible')`가 **true**인 것만 센다.
3. **전환이 끝난 뒤에 읽는다.** Tab 직후 같은 tick에 `getComputedStyle`을 읽으면 위 표의
   0ms 값을 읽게 되어, 실제로는 멀쩡한 요소까지 "링 없음"으로 잡힌다(반대 방향 오진).
   `el.getAnimations()`가 빌 때까지 기다리거나 duration보다 넉넉히(≥400ms) 기다린다.
4. 대비는 토큰 원색이 아니라 `getComputedStyle(el).boxShadow`에서 읽은 **합성 링 색 vs
   오프셋 색**으로 잰다(§5 앞 절).

라이트·다크 양쪽을 다 잰다(`page.emulateMediaFeatures`의 `prefers-color-scheme`).

## 6. 모션

`utils/animationUtils.ts`의 프리셋과 `duration-fast|base|slow`(200/300/700ms) ·`ease-standard`
토큰을 쓴다. framer-motion의 `DUR`/`EASE_STANDARD`와 값이 동기화돼 있다.
`transition-all`은 쓰지 않는다 — iOS Safari에서 레이아웃 트리거 속성까지 보간해 hover 시
reflow가 튄다. 바꾸는 속성만 지정한다(`transition-[colors,box-shadow,transform]`).

## 7. Liquid Glass 재질

`.glass-regular`(기본 표면) · `.glass-menu`(텍스트 밀도 높은 플로팅 메뉴) · `.glass-clear`(화려한
배경 위 소수 요소) · `.glass-bar`(전폭 sticky 바) · `.glass-card`(인플로우 카드, blur 없음).

가드레일:

- 뷰포트당 **상시 고정 blur 레이어 ≤ 2**(현재 헤더 + ScrollToTop). 인플로우 카드는 `.glass-card`로
  blur 없이 쓴다 — 정적 배경 위 backdrop-filter는 시각 이득 0에 GPU만 소모한다.
- 본문 텍스트를 글래스 위에 직접 올리지 않는다. 글래스 위 텍스트 대비는 AA(4.5:1) 유지.
- 자동 폴백 3종(`prefers-reduced-transparency` / 터치+≤768px / `NEXT_PUBLIC_DISABLE_GLASS=1`)이
  토큰 레이어에서 솔리드로 강등한다. 컴포넌트 코드는 건드리지 않는다.
- **히어로 이미지 위 CTA에 `glass-clear`를 쓰지 않는다** — 모바일 폴백에서 불투명 흰색이 되어
  흰 글씨가 사라진다.

글래스 확대 적용 전에는 PSI 모바일 실측을 거친다(이 프로젝트는 iOS Safari GPU 때문에 blur를
걷어낸 이력이 있다).

## 8. 새 화면 체크리스트

1. 섹션은 `Section`, 버튼은 `Button`, 입력은 `Field`, 카드는 `BaseCard`를 썼는가?
2. 제목·본문에 `.typo-*` 역할 클래스를 썼는가? 원시 `text-*` + `font-*` 조합으로 위계를
   새로 만들지 않았는가?
3. 색이 전부 토큰인가? `yellow-*`를 카카오 아닌 곳에 쓰지 않았는가?
4. 배경·텍스트·보더에 `dark:` 짝이 있는가?
5. 인터랙티브 요소에 `focus-visible` 링과 44px 터치 타깃이 있는가?
6. 새로 만든 클래스명이 실제로 `tailwind.config.ts`에 정의돼 있는가? (0절)
7. 고르는 항목은 `ChoiceCard`, 안내·상태 박스는 `Notice`/`Panel`, 배지는 `Badge`, 거래 화면은
   `PageShell`+`PageHeader`+`Stepper`+`PriceSummary`+`ResultCard`를 썼는가? (§4 중간 계층)
8. 반경이 네 단(lg·xl·2xl·full) 안에 있는가? `rounded-md`를 쓰지 않았는가? (§3)
9. 라디오·체크박스에 `accent-primary`를 줬는가? 이모지를 아이콘으로 쓰지 않았는가?
10. **본뜬 화면이 이 문서를 지키는가?** 규칙의 정본은 이 문서지 이웃 파일이 아니다. 운영 도구(입장 스캔)·
    감상실·계약 화면은 의도한 예외라 본보기로 쓰면 예외가 그대로 따라온다(2026-10-08 기획자 현황 화면).
    히어로 없는 화면의 본보기는 `pages/[locale]/booking/manage/[orderNo].tsx`다.
    `tests/pages/pageScaffold.test.ts`가 v2 미설정·페이지의 `<main>`·`min-h-screen` 바탕을 막는다.

## 9. 부채 현황

### 해소됨 (2026-09-11 감사 → 2026-09-12)

| 항목 | 어떻게 |
|---|---|
| 정의 없이 쓰이던 `.typo-*` 3종 | 정의 추가 + 가드가 CI에서 미정의 사용을 막는다(§0) |
| 버튼·폼·간격·색·타이포 원시 유틸리티 난립 | `Button`·`Field`·`Section` 프리미티브로 흡수, 역할 클래스 치환 |
| 히어로 오버레이 `[#a8c0ff]` 복붙 4곳 | `--hero-title-accent`·`--hero-title-glow` CSS 변수로 토큰화 |
| 카테고리 배지 반경 불일치 | `rounded-full`로 통일(색은 맥락이 달라 유지) |
| 다크모드 브랜드색·메타색 텍스트 AA 미달 | 8개 페이지 실측 112건 → 0건. 대비 부족한 다크 짝을 가드가 막는다 |
| 아웃라인 pill className이 9개 파일에 45번 복붙 + 45곳 전부 `focus-visible` 링 없음 | `components/ui/ServiceLinkPill`로 흡수(§4). 포커스 링·44px 타깃을 함께 얻었고, 재복붙은 `tailwind.config.test.ts`의 조합 스캔이 막는다 |
| 나머지 `focus-visible` 링 `/40` 75곳이 SC 1.4.11(3:1) 미달 | §5 표대로 `ring-primary/70 dark:ring-primary-lighter/70`로 일괄 교체(2026-09-14). 카카오 다크 링 6곳·불투명 `ring-primary` 4곳·오프셋 색 누락 23곳도 함께. 6개 페이지 × 라이트·다크 실측 미달 336건(테마당 168) → **0건** |
| "클래스가 있으면 통과"하던 포커스 가드 | `tailwind.config.test.ts`의 '포커스 링이 실제로 보이는가'가 알파 하한(`/50`)과 다크 짝을 CI에서 강제한다(§5) |

### 판단을 내린 것 — 더 이상 미결이 아니다

**스토리 본문과 정적 페이지의 제목 스케일이 다른 것은 의도로 둔다.**
`MarkdownRenderer`는 반응형(`text-3xl md:text-4xl`), 역할 클래스는 고정 크기다. 스토리 본문은
길게 읽는 산문이라 뷰포트에 따라 제목이 커지는 편이 낫고, 마케팅·정적 페이지는 레이아웃이
설계된 화면이라 고정이 맞다. 둘은 **다른 타이포 영역**이며 서로 맞출 대상이 아니다.
역할 클래스(`.typo-*`)는 화면 구조(카드·섹션·내비)를 지배하고, 마크다운 스케일은 본문 안에서만 산다.

**`body-1`의 weight 300은 v1의 산문 기준이다 — 디자인 v2는 400으로 올린다(2026-09-25 개정).**
300을 "의도"로 확정할 때 zh·th 폴백 폰트와 Windows 렌더링 조건은 검토되지 않았다. 그 환경에서
300 획은 더 가늘어져 계산상 AA여도 읽히는 대비가 떨어진다. 그래서 본문 토큰의 굵기를
`var(--body-weight, 300)`으로 빼 두고, v2 스코프(`[data-edition='v2']`)만 400을 준다(§10).
v1 페이지는 이행될 때까지 300이다. 아래 문단은 v1에 대해 여전히 유효하다.

**v1에서 실사용의 medium·semibold는 결함이 아니다.**
`font-medium`·`font-semibold`가 많이 보이는 자리는 산문이 아니라 레이블·강조·수치다. 그것들은
각자의 역할 클래스(`.typo-card-cta`·`.typo-button`·`.typo-card-subtitle`)나 의도된 강조를 쓰고 있다.
산문 본문에 굵기를 올려 쓰는 것만 피하면 된다.

### 남아 있는 것

| 항목 | 판단 |
|---|---|
| 대비 가드가 줄 단위라 hover 색과 텍스트 색이 **다른 줄**에 있으면 못 잡는다 | pill 45곳은 `ServiceLinkPill`로 흡수돼 더는 이 형태가 아니다. 남은 자리(`ServiceLinksSection`은 해소)에 대해서는 hover 실측 CI화가 근본 해법 |
| 대비 측정이 그라디언트·사진 배경 위 텍스트를 못 잰다 | 투명 헤더가 히어로 사진 위에 있어 스크립트가 흰색으로 폴백한다. 그 자리는 육안 확인에 의존 |
| `pages/admin/**` h1이 `text-xl`~`3xl` 혼용 | 운영자 전용 백오피스라 우선순위 낮음. 공개 페이지만 `typo-page-title`로 통일했다 |
| 히어로 `minHeight`에 `vh`와 `svh` 혼용 | 규칙은 §3에 적어 뒀고 기존 값은 손대지 않았다 |
| 그리드 브레이크포인트(2열 `sm:`/`md:` 반반, 4열 4종) | 카드 너비가 페이지마다 달라 일괄 통일은 보류 |
| ~~중간 계층 패턴의 기존 위반 184건~~ | 2026-10-05 세 PR로 0건. 가드가 재발을 막는다(§4). 경위는 `docs/design-ui-refinement-plan-2026-10.md` §5-1 |

## 10. 디자인 v2 — 페이지 단위로 이행 중

2026-09-25 디자인 회의(아트·모션·성능·전환·접근성·아키텍트)에서 합의한 개편이다. 한 번에
전역으로 뒤집지 않는다 — 공용 CTA·카드 컴포넌트가 진행 중인 전환 실험의 계측 지점이라
거기를 바꾸면 실험이 판정 불가가 된다. 첫 적용 페이지는 홈이다.

**켜는 법**: 페이지 컴포넌트에 `Page.designEdition = 'v2'`. `_app`이 `DesignEditionContext`
(`lib/designEdition.ts`)와 wrapper의 `data-edition="v2"`를 내려보낸다. v1 페이지에는 속성조차
붙지 않는다.

**분기하는 곳은 셋뿐이다**: `SectionHeading`·`Footer`(컨텍스트), 그리고 CSS 스코프
`[data-edition='v2']`. 그 밖의 공용 컴포넌트 파일은 v2 작업에서 건드리지 않는다.

| 항목 | v1 | v2 |
|---|---|---|
| 섹션 제목 | 원형 아이콘 + 보라·핑크·초록 그라디언트, 가운데 | eyebrow(`.typo-eyebrow`, `<p>`, 번호 `aria-hidden`) + 잉크 대형 제목(`.typo-display-section`), 좌측 |
| 텍스트 그라디언트 | 섹션 제목 전부 | 0곳(forced-colors에서 글자가 사라지고, 모든 제목이 외치면 강조가 없다) |
| 브랜드색 | 보라·핑크·초록 | 보라 하나. 고채도는 카카오 옐로만 남긴다 |
| 본문 굵기 | 300 | 400 |
| 푸터 | 3색 전폭 그라디언트 | 잉크(`gray-950`) 단색 |
| 스크롤 모션 | 없음(2026-05 iOS fix로 사실상 꺼짐) | 섹션 제목만 CSS `view()` 등장 — 카드 그리드 금지 |

**다문자**: 대형 제목의 행간·자간은 `--display-lh`/`--display-ls` 변수로 두고 th·vi(행간 1.4)·
zh(자간 0)에서 재정의한다. eyebrow 라벨은 i18n 키(`home.v2.eyebrow.*`)이고 대문자 변환은 CSS가 한다.

**모션 규칙**: `prefers-reduced-motion: no-preference` + `@supports (animation-timeline: view())`에서만 켠다.
시작 opacity는 0이 아니라 .35다. 킬스위치 `NEXT_PUBLIC_DISABLE_MOTION=1`. 모바일도 켠다(2026-09-27) —
그 전엔 정밀 포인터 기기로 막아 두었다. iOS 26 미만 Safari는 `view()`를 몰라 정적으로 남는다.
점검은 Playwright WebKit(26.x)의 iPhone 에뮬레이션으로 했다. 이때 사이트 CSP의
`upgrade-insecure-requests` 때문에 WebKit이 localhost 리소스를 https로 올려 CSS가 통째로 안 뜬다
(Chromium은 localhost를 예외로 둔다) — `context.route`로 https를 http로 돌려받아야 진짜 화면이다.
`content-visibility: auto` 섹션은 화면에 들어오며 높이가 바뀌므로, 제목을 가운데로 한 번 스크롤하고
재면 밀려난 위치를 재게 된다 — 위치가 멈출 때까지 다시 맞춘 뒤 잰다.

**v1이 그대로인지 확인하는 법**: `npm run visual:golden`(빌드 HTML 전수 비교, 허용 목록 밖
변경이 있으면 실패)과 `npm run visual:shots`(스크린샷 픽셀 비교). 사용법은 각 스크립트 머리말.

**페이지 코드에 박힌 v1 장식은 스코프 CSS가 일괄로 걷는다**(styles/globals.css, v2 블록). 페이지를 켤 때마다
파일을 고치지 않으려는 것이다.
- 그라디언트 텍스트(`.bg-clip-text.text-transparent`) → 잉크(다크는 흰색). 히어로 h1 안만 흰색
- 보라→핑크 그라디언트 면(FeatureCard 띠·뱃지·아이콘 원, `to-r`·`to-br`) → 보라 단색
- 보라·핑크·초록 파스텔 배경 패널(`from-primary/N … secondary/N`) → 옅은 보라 단색
- SectionHeading v2는 `titleClassName`을 받지 않는다 — v1 호출부가 넘기던 그라디언트·크기가 v2 제목을 덮었다
- v2 제목(`.v2-heading`) **바로 뒤**가 가운데 좁은 블록(`mx-auto max-w-lg`~`6xl`)이면 제목도 그 폭으로 맞춘다
  (`:has()`) — v1 본문의 좁은 체크리스트·카드 그리드 위에서 제목만 왼쪽 끝에 붙어 선이 어긋났다

**스크린샷 주의**: /practice-room처럼 `Section defer`(content-visibility: auto)를 쓰는 페이지는 전체 페이지
캡처에서 화면 밖 섹션이 빈 면으로 찍힌다. 렌더 결함이 아니다 — 스크롤해 뷰포트 단위로 찍어 확인한다.

**v2 페이지**(2026-09-27): 홈, /release-project, /release-project/{single,ep,album}, /pricing, /recording,
/mixing-mastering, /practice-room, /about, /author, /contact, /cover-video, /crowdfunding-design, /lesson,
/music-promotion, /portfolio, /studio-info, /voice-acting, /wedding-song, /stories(목록·카테고리·상세), /guides/*,
/artists(목록·상세), /portfolio/[id], 그리고 거래 화면 — 예약·구독(#307), 계약 서명·404·500(#308),
펀딩 12개(#309). **사이트의 모든 페이지가 v2다.** 새 페이지는 `designEdition = 'v2'`로 시작한다. 공용 컴포넌트 중 v2 분기가 있는 것: SectionHeading, Footer, ReleaseProducerIntro(홈 프로듀서
섹션과 같은 문법), ServiceLinkPill(v2에서는 tone과 무관하게 보라). 섹션 앵커 내비의 다크 hover 초록도 v2 CSS가 보라로 바꾼다.

**가드**: `components/ui/SectionHeading.test.tsx`가 v1/v2 분기와 v2 파일의 색 규칙(그라디언트·
secondary·accent 금지)을 고정한다. v2 파일이 늘면 그 목록에 더한다.
