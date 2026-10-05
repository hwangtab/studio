# UI 정제 계획 — "중간 계층" 프리미티브와 지침 보강 (2026-10-04)

디자인 v2 이행(2026-09-27 전 페이지 완료) 뒤에도 "성의 없어 보인다"는 지적이 나온 자리는
섹션·히어로가 아니라 **그 사이를 채우는 요소**다 — 고르는 카드, 안내 박스, 배지, 거래 화면의
머리·단계·요약·결과. 이 문서는 2026-10-04 전수 조사(components·pages, 테스트·admin 제외)의
현황과, 그것을 고치는 순서를 적는다. 정본은 여전히 `docs/design-system.md`이고, 이 문서는
그 문서에 **빠져 있는 절을 채우기 위한 작업 계획**이다.

## 0. 한 줄 진단

토큰(색·타이포·반경 표)과 상위 프리미티브(Section·SectionHeading·Button·Field·BaseCard)는
잘 돼 있다. 그런데 **"선택 항목 · 안내/상태 패널 · 배지 · 페이지 머리 · 단계 표시 · 금액 요약 ·
모달"에 해당하는 공용 컴포넌트가 하나도 없다.** 그래서 흐름을 만든 사람마다 자기 반경 체계를
갖게 됐다 — 예약·구독은 `rounded-md`, 개설자는 `rounded-lg`, 펀딩은 `rounded-xl`, 마케팅은
`rounded-2xl`. 같은 사이트 안에서 네 가지 "손맛"이 보이는 것이 고급스럽지 않은 이유다.

`?pay=v2` 같은 쿼리나 v2 스코프 CSS는 이 문제와 무관하다 — v2는 제목·본문 굵기·그라디언트만
걷었고 폼 표면은 손대지 않았다.

## 1. 현황 — 같은 역할, 다른 모양

### 1-1. 고르는 항목 (라디오 카드·알약·토글)

| 자리 | 모양 | 선택 상태 | 입력 틴트 | 포커스 |
|---|---|---|---|---|
| 예약·믹싱 상품 카드 (`BookingWizard` `MixingOrderWizard`) | `rounded-md p-3` | `border-primary bg-primary/5`, 다크 짝 없음 | `text-primary`(forms 플러그인 없어 **무효** → 크롬 파랑) | 입력에만 |
| 후원자 이름 선택 (`PublicNameChoice`) | `rounded-lg px-3 py-2` | `has-[:checked]`, 다크 짝 있음 | `accent-primary` ✓ | 없음 |
| 아티스트 구독 티어 (`ArtistSupportCallout`) | `rounded-xl p-4` | 위 + `ring-2 ring-primary/40` | sr-only | **없음** |
| 견적·목표액 계산기 알약 (`QuoteWizard` `FundingGoalCalculator`) | `rounded-full px-4 py-2` (바이트 단위 복제 2벌) | `bg-primary/10` + 텍스트색 | sr-only | focus-within ✓, hover 없음 |
| 펀딩 리워드 줄 (`PledgeWizard`) | `rounded-xl p-4` | 다크 짝 있음 | 스테퍼 | — |
| 예약 시간 슬롯 | `rounded-md h-11` | **보라 채움**(다른 곳은 틴트) | — | **없음** |
| 카테고리 칩·앵커 내비·페이지네이션 | `rounded-full`/`rounded-md` | 보라 채움 | — | ✓ |
| 믹싱 전·후 세그먼트 | `rounded-xl border-2` | **검정/흰 반전** | — | ✓ |

체크박스는 세 계열(`accent-primary` / `text-primary`+`rounded` / 무스타일)이고 크기도 `h-4`·`h-5`
혼용, 포커스는 `focus:`와 `focus-visible:` 혼용. 단계 표시는 "STEP 1 / 2" 텍스트(예약) 대
번호 원(펀딩) 대 없음(견적). 아코디언 4종(`<details>` 2종·버튼 1종·마커 숨김 1종).

### 1-2. 안내·상태 박스

같은 "환불 규정" 박스가 예약에서는 `rounded-md`, 펀딩 `FundingTrustNotice`에서는 `rounded-2xl`.
상태색 박스는 패딩 `p-3`~`p-8`, 테두리 유/무, 다크 틴트가 **같은 tone 안에서도** 다섯 가지:

| tone | 다크 배경이 쓰인 값들 |
|---|---|
| 중립 gray-50 | `gray-800/50` · `gray-800/40` · `gray-900/50` · `gray-900/40` · `gray-900` |
| amber | `amber-500/10` · `amber-950/40` · `amber-900/30` · `amber-950`(불투명) · `amber-500/30` |
| red | `red-900/20`(테두리 없음) · `red-950/40`+`border-red-200` |
| primary/5 콜아웃 | lg·xl·2xl 반경, `border` / `border-2` / `border-l-4`, 다크 짝 없는 곳 5 |

### 1-3. 카드·배지·그림자

- **카드 반경**: StoryCard·PortfolioMiniCard·ContactFormCard `rounded-lg`, BaseCard `rounded-xl`,
  독자 글래스 패널 대부분 `rounded-2xl`, PricingCard `rounded-3xl`. 연락처 페이지는 `lg` 카드와
  `2xl` 카드가 나란히 놓인다. RewardCard는 바깥 xl 안에 안쪽 2xl.
- **카드 패딩**: BaseCard 소비처가 `p-4`~`p-8 sm:p-10`까지 역할과 무관하게 흩어짐.
- **hover 모션 4종**: framer 리프트(BaseCard) / CSS `-translate-y-0.5` / `-translate-y-1` /
  framer `HOVER_SCALE`(공정 카드). StoryCard는 안 움직이고 이미지만 확대.
- **배지**: 정본 `rounded-full px-2 py-0.5 typo-caption`을 쓰는 곳이 **0곳**. 패딩 4종, 글꼴 5종.
  같은 포트폴리오 카테고리 배지가 세 화면에서 세 모양.
- **그림자**: 카드는 `.glass-card` 변수 하나로 통일돼 있어 양호. 손으로 짠 1차 버튼
  (펀딩 success·fail·manage)만 `shadow-md` 고정, 히어로 CTA는 lg→xl.
- **아이콘**: `size={22}`·`24`·`text-2xl`(lucide에 무효) 혼용, 이모지 4곳(🌐 📭 💬 ✓).

### 1-4. 거래 화면 뼈대

| 항목 | 갈라진 모양 |
|---|---|
| 컨테이너 | `max-w-lg`·`xl`·`2xl`·`3xl`·`4xl`, 상단 여백 `py-12`·`py-16`·`py-24`·`pt-28`(+Layout `pt-20`) |
| h1 | `typo-page-title`(예약·구독) / `typo-section-title`(펀딩 pledge·manage·견적) / 생 `text-3xl font-bold`(개설자) |
| 브랜드 줄(헤더 없는 화면) | `typo-card-meta` / `text-sm text-gray-500` 두 벌 |
| 뒤로 링크 | 위 보라 ← / 위 회색 밑줄 / 아이콘+보라 / 아래 "홈으로" 밑줄 — 4종 |
| 결과 화면 | 예약·구독은 맨바닥 텍스트, 펀딩은 글래스 카드 |
| 관리 화면 카드 | 예약·구독 솔리드 `bg-white dark:bg-gray-800`, 펀딩 글래스 |
| 금액 요약 | 예약 한 줄 회색 박스 / 펀딩 항목별 `dl` + 합계 / 견적 `text-3xl` 틴트 박스 |
| 1차 CTA | 마법사는 `Button`, **결과·관리 화면은 전부 손으로 짠 `<a>`**(카카오 포함), 높이·굵기 제각각 |
| CTA 위치 | 펀딩만 바닥 고정 바, 나머지는 폼 끝 인라인 |
| 로딩 | `LoadingSpinner`를 쓰는 거래 화면 0곳, 텍스트 "불러오는 중…" |
| 생 `<input>` | `funding/apply` · `creator/auth` · `StorySectionForm` · `FundingGoalCalculator`(포커스 링 없음 포함) |

## 2. 목표 — "고급스럽다"를 규칙으로 바꾸면

고급스러움은 장식을 더하는 게 아니라 **선택지를 줄이는 것**이다. 아래를 지침으로 못 박는다.

1. **반경은 네 단, 역할로 정한다.** 컨트롤 `lg`(8) · 카드·선택 항목·알림 `xl`(12) · 패널·모달·
   결과 카드 `2xl`(16) · 알약·배지 `full`. **`rounded-md`는 없앤다**(현재 20곳). PricingCard의
   `3xl`은 동심원 예외로 남긴다.
2. **테두리는 한 종.** `border-gray-200 dark:border-gray-700` 1px. 강조는 `border-primary` +
   `ring-1 ring-primary/30`(다크 `primary-lighter`)로만. `border-2`·`border-l-4`는 쓰지 않는다.
3. **선택 상태는 한 모양.** `border-primary bg-primary/5 dark:bg-primary-lighter/10` + 안쪽
   `accent-primary` 입력. "채움"은 세그먼트·칩(짧은 라벨)만, "틴트"는 카드(설명 있는 항목)만.
4. **패딩은 세 단.** compact `p-4` · default `p-6` · roomy `p-8`. 알림은 `p-4`, 카드는 `p-6`,
   결과·모달 카드는 `p-6 sm:p-8`.
5. **상태색 패널은 tone 표에서만.** neutral·info·success·warning·error 다섯 tone × 라이트/다크
   값을 컴포넌트 안에 고정한다. 손으로 `bg-amber-50`을 조립하지 않는다.
6. **거래 화면의 머리는 한 컴포넌트.** 브랜드 줄 → 뒤로 링크 → `typo-page-title` h1 → 리드 →
   단계 표시. 컨테이너는 폼 `max-w-2xl`, 결과 `max-w-lg`, 상단 여백 `py-12 sm:py-16` 하나.
7. **금액은 항목별로.** 한 줄 요약 금지. 리워드·곡 수·부가세·합계를 `dl`로, 합계만 굵게.
8. **아이콘은 20과 16.** 카드 머리 아이콘 20, 인라인·배지 16. 이모지 금지(lucide로).
9. **움직임은 하나.** 클릭 가능한 카드만 BaseCard 리프트. CSS translate·scale 복제는 지운다.
10. **버튼은 전부 `Button`.** 결과·관리 화면의 손으로 짠 `<a>` 11곳 포함.

## 3. 새로 만드는 프리미티브 (`components/ui/`)

| 컴포넌트 | 흡수하는 자리 | 비고 |
|---|---|---|
| `ChoiceCard` + `ChoiceGroup` | 1-1의 라디오 카드·티어·리워드 줄 | `variant="card" \| "pill"`, radio/checkbox 겸용, 제목·설명·가격(오른쪽) 슬롯, `has-[:checked]` 기반, focus-within 링, 다크 짝 내장 |
| `Checkbox` · `Radio` (Field에 추가) | 체크박스 11곳 | `accent-primary h-5 w-5`, 레이블·힌트 배선, `focus-visible` 링 |
| `Notice` | 1-2 전부 | `tone` 5종, `rounded-xl p-4`, 아이콘 선택, `role` 자동(error→alert, success→status) |
| `Panel` | 중립 요약·규정 박스, 선택 구획 | `rounded-xl` gray-50, 변형 `inset`(카드 안) |
| `Badge` | 1-3 배지 전부 | `tone`·`size="sm\|md"`, 정본 `rounded-full px-2 py-0.5 typo-caption` 실제 적용 |
| `PageHeader` | 거래 화면 머리 | 브랜드 줄·뒤로 링크·제목·리드·`Stepper` 슬롯 |
| `Stepper` | STEP 텍스트·번호 원 | 현재/완료/예정 3상태, `aria-current="step"` |
| `PriceSummary` | `PriceBreakdown`·펀딩 결제 요약·견적 결과 | 항목 `dl` + 합계, `formatPriceAmount`만 사용 |
| `ResultCard` | success·fail·manage 공통 | `rounded-2xl p-6 sm:p-8` 글래스, 아이콘·제목·설명·CTA 슬롯 |
| `Modal` 셸 | `RewardModal`·`PortfolioDetailModal` | 포커스 트랩·ESC·바닥 시트(모바일) 한 벌 |
| `EmptyState` | 📭 텍스트 빈 상태 3곳 | lucide 아이콘 + 안내 + 선택 CTA |
| `Disclosure` | `<details>` 3종·FAQ | 마커 통일, 포커스 링, `rounded-xl` |

기존 `BaseCard`는 10/14 이후 `padding="compact|default|roomy"` prop을 더해 소비처의 임의 `p-*`를
걷는다. `LoadingSpinner`는 새로 만들지 않고 거래 화면 로딩 자리에 **채택**한다.

## 4. 가드 — 재발을 CI가 막게 (`tailwind.config.test.ts` 추가분)

| 가드 | 잡는 것 | 예외 등재 |
|---|---|---|
| 반경 어휘 | `rounded-md` 사용 금지(components·pages, admin 제외) | 없음 |
| 상태 박스 손조립 금지 | `bg-{red,green,amber,blue}-50` + `rounded-*` 같은 리터럴 → `Notice` | `NOTICE_ALLOW` 이유 필수 |
| 배지 손조립 금지 | `rounded-full` + `text-xs\|text-[10px]` + `px-*` 조합 → `Badge` | 히어로 위 칩 |
| 입력 틴트 | `type="radio"\|"checkbox"`에 `text-primary`만 있고 `accent-primary` 없음 → 실패 | 없음 |
| 거래 h1 | `pages/[locale]/**`의 `<h1 className="text-…xl font-bold` → `typo-page-title`/`section-title` | 없음 |
| 이모지 아이콘 | TSX 리터럴의 이모지·`✓` → lucide | 로케일 JSON은 범위 밖 |
| 모션 복제 | `hover:-translate-y`·`hover:scale` 리터럴은 Button·BaseCard 밖에서 금지 | 히어로 CTA |

스크린샷 매트릭스(`scripts/visual/screenshots.mjs`)에 거래 화면 6종을 더한다 — 예약 마법사
1·2단계, 믹싱 주문, 펀딩 pledge, 예약 manage, 구독 setup. DB가 채우는 영역은 `page.route`로
고정 응답을 준다(CLAUDE.md 로컬 프로덕션 절).

## 5. 순서 — 동결과 실험을 피해서

전제: `recording-price1` 실험 리뷰일 **10/13**까지 `BaseCard`·`Button`·`PricingCard`·카카오
버튼·`StoryCTA` 파일은 수정 0(메모 `design-v2-redesign-plan`). 측정 중 LP(`/voice-acting`
11/11, `/release-project` 11/10, `/recording` 10/13)는 본문·H2·타이틀을 건드리지 않는다.
관측 중 스토리 3편도 같다(`node scripts/seo-preflight.mjs`로 매번 확인).

### 0단계 (지금 ~ 10/13) — 지침·프리미티브·비동결 흐름

1. `design-system.md`에 §3 반경 표 개정(4단·md 폐지), §4에 위 프리미티브 절, 새 §"거래 화면
   뼈대", §"상태 패널 tone 표", §"선택 상태" 추가. §8 체크리스트 갱신.
2. 프리미티브 신설 + 단위 테스트(각 variant의 className 고정, 포커스 링, 다크 짝).
3. 가드 추가 — 처음엔 **현재 위반 목록을 기준선으로** 두고 "늘어나면 실패"(중복 섹션
   게이트와 같은 방식). 0단계 끝에 기준선을 비운다.
4. 비동결 흐름 전환(파일 단위 PR, 각각 `npx jest` 전체 + `npm run build`):
   - 예약: `BookingWizard`·`MixingOrderWizard`·`PriceBreakdown`·manage·success·fail
     (믹싱 1단계는 상품을 믹싱/마스터링/통합 세 묶음으로, 곡 수는 스테퍼)
   - 구독: setup·manage·success·fail, `BillingAuthButton`
   - 펀딩: `PledgeWizard`·`RewardModal`·manage·success·fail·`FundingTrustNotice`·
     `PublicNameChoice`·`apply`·creator 5화면·`ArtistSupportCallout`
   - 견적 `QuoteWizard`, `FundingGoalCalculator`, 연락처 `ContactFormCard`(lg→2xl)·
     `Contact*Actions`·`ErrorFallback`
   - 체크박스·라디오 11곳 → `Checkbox`/`Radio`
5. 스크린샷 매트릭스 확장, 전후 비교 캡처 보관(`.visual/shots/`).

### 1단계 (10/14 ~ 10/31) — 동결 해제분

- `Button`: `transition-[colors,transform]`의 사문 `colors`를 실제 속성 4개로 고쳐 hover 색이
  전환되게(44곳 동작이 바뀌므로 스크린샷으로 확인), `secondary` variant 반경·그림자 정리.
- `BaseCard` `padding` prop, 소비처 임의 `p-*` 제거. `StoryCard`·`PortfolioMiniCard`
  `rounded-lg`→BaseCard. `RewardCard` 이중 반경 해소. CSS translate/scale 복제 제거.
- `PricingCard` 추천 리본 → `Badge`, `StoryCTA` 반경 정리.
- 손으로 짠 카카오 `<a>`(예약 success·fail·연락처) → `Button variant="kakao"`.
- 배지 전환(포트폴리오 3화면·펀딩·스토리 카테고리), 아이콘 20/16 정리, 이모지 제거.
- 가드 기준선 비우기 → 위반 0에서 "있으면 실패"로 전환.

### 2단계 (11/11 이후) — 측정 중 LP·마케팅 콜아웃

- `/recording`·`/release-project`·`/voice-acting`의 콜아웃·공정 카드·배지 전환.
- 마케팅 페이지 primary/5 콜아웃 7곳 → `Notice tone="brand"` 또는 `Panel`, 인라인 콜아웃
  3종(`InlinePrice/Service/Booking`)의 `border-2`·amber 정리 — **StoryCTA 계열은 리드 계측
  지점이라 lead-verdict 대조군을 미리 정하고** 바꾼다.
- 관리자 화면(`pages/admin`)은 범위 밖. 다만 `adminFieldClass`가 새 프리미티브의 `light`
  옵트인을 그대로 타게 한다.

## 5-1. 진행 기록

- **2026-10-05 PR #486** — 0단계 1~3: 지침·프리미티브 12종·기준선 가드.
- **2026-10-05 PR(feat/ui-primitives-adopt)** — 운영자 결정으로 10/13 동결·11/11 측정창을 기다리지 않고
  0단계 4·5와 1단계를 한 번에: 예약·구독·펀딩(후원·관리·결과·개설자)·견적·연락처·아티스트 구독·공연·
  결제수단 화면 전환, Button hover 색 전환 복구, BaseCard `padding` prop, StoryCard·포트폴리오·펀딩 배지 →
  `Badge`, 인라인 콜아웃·고정 바 반경·톤 통일, 모션 복제 제거, 이모지 제거. 기준선: rounded-md 59→12 ·
  notice 44→11 · badge 18→5 · tint 9→3 · h1 6→1 · emoji 6→2 · motion 30→20. 교락은
  `docs/ctr-surgery-log.md` 2026-10-05 행. **남은 것(2단계 몫)**: 마케팅 페이지(측정 중 LP 3종 포함)의
  콜아웃·배지·아이콘·히어로 CTA 모션, 계약 서명·완료(라이트 고정, 프리미티브에 `light` 옵트인 필요),
  `shows/scan` h1, 스토리 목록 빈 상태 2곳.

## 6. 게이트와 판정

- 각 PR: `npm run type-check` → `lint` → `npx jest`(디렉터리 좁히지 않기) → `npm run build` →
  `npm run visual:shots` 비교. 거래 화면은 Tab 순회로 포커스 링 실측(design-system §5 방법).
- 성능: 새 프리미티브는 전부 `.glass-card`(blur 없음) 또는 솔리드라 blur 예산 불변. PSI 모바일
  ≥94·CLS ≤0.02 무회귀 게이트 유지(`psi-measurement-method`).
- 전환: 트래픽이 작아 리드로 판정하지 않는다(메모). 대신 결제 폼 이탈 지점
  (`payment_window_opens` 대비 결제 완료)과 카카오 클릭 하한만 본다.
- 접근성: 선택 항목·세그먼트·탭의 포커스 링 누락 4곳(시간 슬롯·티어 카드·개설자 탭·
  RelatedGuides details)은 0단계에서 해소되고, 가드가 유지한다.

## 7. 하지 않을 것

- 토큰 색·폰트·히어로·섹션 헤딩 재설계 — v2에서 끝났고 다시 열면 실험이 흔들린다.
- 글래스 blur 확대 — 모바일 솔리드 폴백 정책 그대로.
- 전역 CSS로 `rounded-md`를 `xl`로 덮는 꼼수 — 반경을 따르지 않는 요소를 가드가 못 보게 된다.
- 로고·카카오 옐로 규칙 변경.
