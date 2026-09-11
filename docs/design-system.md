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
| `primary` | `#7c3aed` / `#6d28d9` / `#5b21b6` | 1차 액션, 강조, 링크 |
| `secondary` | `#ec4899` / `#be185d` / `#9d174d` | 보조 강조 (DEFAULT는 AA 5.88:1 확보를 위해 pink-700 상당으로 승격) |
| `accent` | `#10b981` / `#047857` / `#065f46` | 성공·긍정 (DEFAULT는 AA 5.64:1 확보를 위해 emerald-700 상당) |
| `kakao` | `#FEE500` / hover `#FADA0A` / ink `#191600` | **카카오톡 진입점 전용** |

`gray` 50~950은 커스텀 스케일이다(`500`을 `#4b5563`로 어둡게 조정 — WCAG AA).
**slate·zinc·neutral·stone은 쓰지 않는다.** 회색은 `gray` 하나다.

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
| `primary`(DEFAULT) | `#6d28d9` | 2.83:1 | ✗ |
| `primary-light` | `#7c3aed` | 3.53:1 | ✗ (간발의 차로 미달 — 쓰지 말 것) |
| `primary-lighter` | `#a78bfa` | 7.40:1 | ✓ |
| `secondary`(DEFAULT) | `#be185d` | 3.33:1 | ✗ |
| `secondary-light` | `#ec4899` | 5.71:1 | ✓ |
| `accent`(DEFAULT) | `#047857` | 3.67:1 | ✗ |
| `accent-light` | `#10b981` | 7.94:1 | ✓ |

따라서 짝은 셋뿐이다 — `text-primary` + `dark:text-primary-lighter`,
`text-secondary` + `dark:text-secondary-light`, `text-accent` + `dark:text-accent-light`.
`hover:`·`group-hover:`·`focus-visible:` 같은 variant도 **같은 variant의 다크 짝**이 필요하다
(`hover:text-primary` → `dark:hover:text-primary-lighter`). 아이콘은 `stroke`/`fill`이
currentColor라 같은 텍스트 색 규칙을 그대로 따른다.

`tailwind.config.test.ts`의 「브랜드색 텍스트의 다크 짝」이 CI에서 이를 강제한다. 텍스트가
아닌 자리(체크박스·라디오의 채움색, `opacity-10` 장식 워터마크)만 `BRAND_TEXT_ALLOW`에
**이유와 함께** 등재한다 — 이유 없이 넣으면 가드가 무의미해진다. 라이트 고정 경로
(`pages/admin/**`·계약 서명·완료)는 스캔에서 제외된다: 흰 카드 위에 밝은 보라를 올리면
대비가 **오히려** 깨진다.

남은 부채: `dark:text-primary-light`(3.53:1)를 쓰는 자리가 약 47곳 남아 있다. 대부분
`aria-hidden` 아이콘이거나 `text-3xl` 이상 대형 숫자라 완화 기준(3:1)은 통과하지만,
본문 크기 텍스트에 남은 것은 `-lighter`로 올려야 한다. `ProjectRowCard`의
`dark:text-primary/80`도 같은 부채다.

본문 회색의 역할별 기본값:

| 역할 | 라이트 | 다크 |
|---|---|---|
| 제목 | `text-gray-900` | `dark:text-white` |
| 본문 | `text-gray-700` | `dark:text-gray-300` |
| 보조·설명 | `text-gray-600` | `dark:text-gray-400` |
| 메타·캡션 | `text-gray-500` | `dark:text-gray-400` |

## 2. 타이포그래피

폰트는 **Pretendard Variable 하나**다. `sans`/`title`/`display`/`logo` 네 토큰이 전부 같은 폰트를
가리키고, `hero`만 별도다 — hero h1 글자만 담은 ~30KB 서브셋에 `preload:true`라 LCP 경로에서
거의 즉시 swap된다. hero h1 텍스트를 바꾸면 `scripts/generate-hero-font.mjs`를 돌려 woff2와
`pretendard-hero.chars.json`을 **함께 커밋**해야 한다(CI가 `--check`로 잡는다).

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

### 반경

| 대상 | 값 |
|---|---|
| 자유 배치 CTA(히어로·스티키·FAB·인라인 콜아웃) | `rounded-full` |
| 카드·폼 안의 버튼 | `rounded-xl` |
| 카드 | `rounded-xl` (PricingCard는 동심원 24px/12px) |
| 폼 컨트롤(input·select·textarea) | `rounded-lg` |
| 배지·칩 | `rounded-full` |

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
| `solid` | 1차 액션(보라) |
| `kakao` | 카카오톡 목적지 전용 |
| `outline` / `ghost` / `secondary` | 2차·3차 액션 |
| `glass` | 글래스 표면 위 |
| `scrim` | 어두운 히어로 이미지 위 2차 액션 |

`shape`: `pill`(자유 배치 CTA) / `block`(카드·폼 안). `size`: `sm`/`md`/`lg`/`icon`.

**히어로 위계**: 1차가 카카오 옐로면 2차는 `bg-primary`를 쓰지 않는다 — 어두운 사진 위에서
채도 높은 보라가 옐로와 경쟁해 위계가 뒤집힌다. 2차는 `scrim`(어두운 반투명 + 흰 테두리 +
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

### 배지

`rounded-full px-2 py-0.5 typo-caption`을 기본으로 하고, 색만 의미에 따라 바꾼다.

## 5. 포커스 — 접근성 필수

모든 인터랙티브 요소에 **`focus-visible`** 기반 링을 준다(`focus:`가 아니다 — 마우스 클릭에도
링이 떠서 디자인이 지저분해진다).

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
```

| 표면 | 링 색 / 오프셋 색 |
|---|---|
| 일반 배경 | `ring-primary/40` + `ring-offset-white dark:ring-offset-gray-900` |
| 카카오 옐로 버튼 | `ring-kakao-ink` + 표면에 맞는 오프셋 |
| 어두운 히어로 이미지 위 | `ring-white/70` + `ring-offset-black/20` |

터치 타깃은 최소 44×44px(`min-h-[44px]` 또는 `h-11`). 아이콘 전용 버튼에는 `aria-label`.

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

## 9. 미해결 부채 (2026-09-11 감사)

| 항목 | 상태 |
|---|---|
| 스토리 본문(MarkdownRenderer) 제목 스케일이 정적 페이지와 다름 | 의도 확인 필요 — 마크다운은 반응형(`md:`) 스케일, 정적 페이지는 고정 |
| `body-1`이 weight 300인데 실제 본문 상당수가 medium/semibold | 스케일을 실사용에 맞출지, 사용처를 스케일에 맞출지 미결 |
| `pages/admin/**` h1이 `text-xl`~`3xl` 혼용 | 백오피스라 우선순위 낮음. 공개 페이지만 `typo-page-title`로 통일 |
| 히어로 오버레이 `[#a8c0ff]` + rgba가 4개 파일에 복붙 | 토큰화 대상 |
| 카테고리 배지 3종(포트폴리오·스토리·프로젝트)의 색 체계가 서로 다름 | 맥락이 달라 색은 유지, 반경만 `rounded-full`로 통일 |
| 히어로 `minHeight`에 `vh`와 `svh` 혼용 | 규칙은 §3에 적어 뒀고 기존 값은 손대지 않음 |
| 공개 컴포넌트 38곳에서 `bg-white`/`text-gray-900`에 `dark:` 짝 없음 | 푸터·내비처럼 고정 배경 위라 정상인 경우가 섞여 있어 개별 확인 필요 |
| 그리드 브레이크포인트(2열 `sm:`/`md:` 반반, 4열 4종) | 카드 너비가 페이지마다 달라 일괄 통일은 보류 |
