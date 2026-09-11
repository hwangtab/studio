# 다크모드 접근성 2라운드 — 보고서

브랜치 `fix/dark-mode-brand-contrast` · 1라운드 커밋(`ce49cde618`, `36e4e75408`) 위에 3개 추가.
측정: `/tmp/a11y-all.mjs`(알파 합성 + 대형 텍스트 완화 3:1), Chrome headless 1280×900,
`prefers-color-scheme` 에뮬레이션, dev 서버 `localhost:3130`. 스크립트는 저장소 루트에
`.a11y-all.mjs`로 복사해 실행하고 측정 후 삭제했다(커밋 없음).

---

## 1. 실측 — 수정 전/후

### 다크모드

| 페이지 | 전 | 후 |
|---|---:|---:|
| `/ko` | 4 | **0** |
| `/ko/pricing` | 17 | **0** |
| `/ko/about` | 4 | **0** |
| `/ko/portfolio` | 8 | **0** |
| `/ko/recording` | 10 | **0** |
| `/ko/release-project` | 9 | **0** |
| `/ko/practice-room` | 19 | **0** |
| `/ko/stories` | 0 | **0** |
| **합계** | **71** | **0** |

남은 것 없음. 8개 페이지 전부 0이다.

### 라이트모드

| 페이지 | 전 | 후 | diff |
|---|---:|---:|---|
| `/ko` | 43 | 43 | 없음 |
| `/ko/pricing` | 43 | 43 | 없음 |
| `/ko/about` | 43 | 43 | 없음 |
| `/ko/portfolio` | 39 | 39 | 없음 |
| `/ko/recording` | 43 | 43 | 없음 |
| `/ko/release-project` | 48 | 48 | 없음 |
| `/ko/practice-room` | 45 | 45 | 없음 |
| `/ko/stories` | 39 | 39 | 없음 |

8개 페이지 모두 **수정 전/후 출력이 바이트 단위로 동일**하다(`diff` 무출력). 새로 깨진 것 없음.

라이트 실패의 성격(지시받은 대로 diff만 봤지만, 무엇인지는 확인했다):

- **오탐 대부분** — 39/43이 `rgb(255,255,255) on rgb(255,255,255)` 1:1이다. 투명 헤더(히어로
  이미지 위)와 그라디언트 푸터에서 스크립트가 배경을 흰색으로 폴백한 결과다. `PriceLeader`의
  `bg-gradient-to-r from-primary to-secondary text-white` 배지(1.05:1)도 같은 이유다.
- **진짜 실패 (이번 범위 밖, 아래 §6 우려 참조)** — 메타·캡션의 **라이트** 값이
  `text-gray-400`(#9ca3af)이라 흰 카드 위 2.51:1이다(후기 날짜, release-project 기준일).
  정본 §1 역할표는 메타·캡션 라이트를 `text-gray-500`으로 정한다. "라이트 모드 값은 바꾸지
  마라"는 지시가 있어 **손대지 않았다.**

---

## 2. 부류별 수정 목록

### A. `dark:text-primary-light`(#7c3aed, 3.53:1) → `dark:text-primary-lighter`(#a78bfa, 7.40:1)

가장 많은 부류다. 1라운드가 "이미 `dark:` 짝이 있으면 건드리지 않는다"로 남겨 뒀는데
그 짝 자체가 미달이었다.

- **비-hover 48곳 + hover/group-hover 25곳 = 76곳 전부 승격.**
  hover 상태는 실측이 불가능하므로 정적 추론으로 같은 기준을 적용했다.
- 대표 실패: pricing 가격 `500,000원`·`1,800,000원`(16px/700, 9건), FAQ 배지
  `Q 1`~`Q 4`(12px/600), practice-room `월 6만원 상당` 계열(12px/600, 6건),
  `RegionLinksSection` h3 `도보권 (사이트 인접)` 등(14px/700, 4건),
  `RelatedGuidesSection` `가이드 + 640 개 더 보기`(14px/600).
- 같은 이유로 함께 올린 것:
  - `dark:text-accent`(#047857, 3.67:1) → `dark:text-accent-light`(#10b981, 7.94:1) — 11곳
    (DesktopNav·MobileNav·DropdownMenu·LanguageSwitcher·SectionAnchorNav·TableOfContents의
    내비 활성/hover 색). 실측엔 안 잡혔지만 같은 결함이고 새 가드가 잡는다.
  - `dark:text-primary`(2.83:1) → `-lighter` — ProjectRowCard `group-hover`.
  - `dark:text-primary/80`(1.96:1 on #1a1a1a) → `dark:text-primary-lighter` (§C 참조).
  - `dark:hover:text-primary-light/80` → `dark:hover:text-primary-lighter` (홈).
- 주요 파일: `PricingCard` · `FAQSection` · `QuickAnswers` · `SectionHeading` · `FeatureCard` ·
  `InlinePriceCallout`(5) · `ContactInfoCard`(4) · `PracticeRoomCards`(4) · `about.tsx`(5) ·
  `PriceLeader`(2) · `MediaGallery`(2) · `ServicePriceTable` · `MarkdownRenderer`(strong) ·
  `404/500` · 서비스 페이지 5종 등 총 90개 파일 스캔, 실제 변경 60여 개.

**제외**: `components/ui/Button.tsx`의 `light` 옵트인 compoundVariant(`dark:text-primary`).
`theme-init.js`가 라이트 고정 화면에도 `.dark`를 붙이므로 그 자리는 **일부러** 라이트 값을
써야 한다(흰 카드 위 `primary-lighter` = 2.72:1). 새 가드의 허용목록에 이유와 함께 등재했다.

### B. `gray-500`(#4b5563, 2.45:1) → `dark:text-gray-400`

정본 §1 역할표 「메타·캡션 = 라이트 `text-gray-500` / 다크 `dark:text-gray-400`」대로 맞췄다.

`dark:text-gray-500`을 쓰던 곳(짝이 **틀린** 경우):
`ReviewSection`(후기 날짜 — 8개 페이지 중 6개에 같은 컴포넌트로 떠서 실패 24건 중 대부분) ·
`release-project/index`(티어 note, 기준일) · `TierPage`(3곳) · `PortfolioDetailSummary` ·
`music-promotion` · `ContactFormCard` · `InputField`.

다크 짝이 **아예 없던** 곳(같은 결함이라 함께 확인·수정, 8개 측정 페이지 밖이라 실측 검증은 안 됨):
`lesson.tsx`(가격 단위 20px) · `booking/{fail,success}` · `subscribe/[id]/{success,fail}` ·
`subscribe/manage/[id]` · `stories/[id]`(관련 글 없음 안내) · `MarkdownRenderer`(비허용 링크 폴백).

덤으로 잡은 잠재 버그: `LanguageSwitcher`의 비플로팅 분기가
`text-gray-500 hover:text-gray-900 hover:bg-gray-100`에 다크 짝이 없어, 다크에서 hover 시
**밝은 회색 배경 위에 밝은 글씨**가 된다. 실측에는 안 잡혔지만(해당 분기가 측정 페이지에서
렌더되지 않음) 명백한 결함이라 `dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800`을 줬다.

**손대지 않은 것**: `dark:text-gray-600`은 전부 **비활성(disabled) 상태**다
(`BookingWizard` 선택 불가 날짜, `Pagination` 끝 페이지, `MediaGallery` 비활성 점,
`Button`의 light ghost). WCAG 1.4.3은 비활성 컨트롤을 대비 요건에서 제외한다.

### C. portfolio·AudioPlayer의 임의 hex 패널

`dark:bg-[#121212]`·`#1a1a1a` 위 텍스트. 지시대로 **텍스트 색만** 고쳤다.

| 자리 | 전 | 후 |
|---|---|---|
| `ProjectRowCard` 서비스 배지 (10px, 기획·믹싱·마스터링…) | `dark:text-white/40` 3.83:1 | `dark:text-white/60` ≈7.4:1 |
| `TrackInfo` 캡션 (고음질 오디오 · 트랙 01) | `dark:text-white/40` 3.78:1 | `dark:text-white/60` ≈7.4:1 |
| `ProjectRowCard` "프로젝트 보기" | `dark:text-primary/80` 1.96:1 | `dark:text-primary-lighter` |
| `release-project` 스텝 번호 01~05 | `text-primary/60`, 다크 짝 없음 1.68:1 | `dark:text-primary-lighter/80` ≈4.9:1 |

`ProjectRowCard`의 "프로젝트 보기"는 `-lighter/80`이면 4.56:1로 기준을 **간신히** 넘길 뿐이라
알파를 떼고 불투명으로 갔다. `Playlist`의 `dark:text-white/50`은 #121212 위 5.38:1로 통과라 유지.
임의 hex를 gray 토큰으로 바꾸는 것은 범위 밖 — 정본에 남은 부채로 적었다.

---

## 3. 대형 텍스트 판단 — 함께 올렸다

24px↑ 또는 18.66px↑ bold는 완화 기준 3:1이라 `primary-light`(3.53:1)로도 산술적으로는
통과한다(`PricingCard`의 `text-3xl`, `PriceLeader`의 `text-4xl md:text-5xl`). 그래도 올렸다.

이유 셋:

1. **클래스 문자열만 보고는 그 자리가 대형인지 알 수 없다.** 가드를 크기 인지형으로 만들려면
   Tailwind 크기 유틸리티를 파싱하고 반응형 분기(`md:text-5xl`)와 상속까지 따라가야 하는데,
   그건 실측을 텍스트로 흉내 내는 일이고 틀리는 쪽이 조용하다.
2. **같은 컴포넌트가 작은 자리에 재사용되면 조용히 깨진다.** `PricingCard`가 실제로 그렇다 —
   카드에서는 `text-3xl`인데 `ServicePriceTable`·`pricing.tsx` 표에서는 같은 브랜드색이
   16px/700(대형 아님)으로 뜬다. 실측 71건 중 9건이 바로 그 16px 가격이었다.
3. **일관성.** 정본 §1은 짝이 셋뿐이라고 못 박는다. 예외를 크기 조건부로 두면 "이 자리는
   대형이니 괜찮다"는 판단이 매번 필요해지고, 그 판단이 한 번 틀리면 가드가 못 잡는다.

그래서 `primary-light`는 **크기와 무관하게** 다크 짝으로 금지한다(가드 주석에 명시).

---

## 4. 가드 갱신 — `tailwind.config.test.ts`

1라운드 가드 「브랜드색 텍스트의 다크 짝」은 짝의 **존재**만 봤다. `text-primary
dark:text-primary-light`가 그대로 통과했고, 이번 71건이 정확히 그 구멍으로 빠져나갔다.

새 describe 블록 **「다크 짝의 대비가 충분한가」**를 추가했다.

- **정규식**: `/(?<![-\w])((?:[a-z-]+:)*dark:(?:[a-z-]+:)*)text-(primary-light|primary-dark|secondary-dark|accent-dark|primary|secondary|accent)(?![-\w])(\/\d+)?/g`
  - `dark:` 앞뒤의 임의 variant 체인(`dark:hover:`, `group-hover:dark:`)을 모두 잡는다.
  - `(?![-\w])`가 `primary-lighter`·`accent-light`를 배제한다(뒤따르는 `e`가 `\w`).
  - `(\/\d+)?`로 알파 변형(`dark:text-primary/80`)까지 잡는다.
- **금지**: `primary` 2.83 · `primary-dark` 1.96 · `primary-light` 3.53 · `secondary` 3.33 ·
  `secondary-dark` 2.25 · `accent` 3.67 · `accent-dark` 2.21 — 다크 배경 #030712 기준 전부 AA 미달.
- **허용**: `primary-lighter` 7.40 · `secondary-light` 5.71 · `accent-light` 7.94.
  회색·white 계열은 이 가드의 대상이 아니다(역할표가 따로 있다).
- **라이트 고정 경로 제외**: 1라운드의 `LIGHT_FIXED`를 그대로 재사용한다
  (`pages/admin/`, `components/admin/`, `*/contracts/*`). `.test.tsx`도 제외.
- **허용목록** `DARK_BRAND_ALLOW` — 현재 1건:
  `components/ui/Button.tsx`의 `dark:text-primary dark:border-primary/20`. 이유를 함께 적었다
  (`light` 옵트인 compoundVariant. `theme-init.js`가 라이트 고정 화면에도 `.dark`를 붙이므로
  거기서는 다크 분기를 라이트 값으로 되돌려야 한다 — 흰 카드 위 `primary-lighter`는 2.72:1).
- **두 번째 it**: 금지 토큰 4개가 실제로 `tailwind.config.ts`에 정의돼 있는지 확인한다.
  오탈자로 가드가 조용히 비는 것을 막는 장치다(정본 §0의 "정의되지 않은 클래스는 조용히
  사라진다"와 같은 취지).

**회귀 감지 검증**: `PricingCard`를 일부러 `dark:text-primary-light`로 되돌려 돌리니
`components/ui/PricingCard.tsx:115: dark:text-primary-light — <span …>`를 찍고 실패했다.
되돌린 뒤 다시 통과.

정본 `docs/design-system.md` §1의 「남은 부채: `dark:text-primary-light` 약 47곳」 문단을
이번 2라운드 결과로 교체했다(부류 표, 대형 텍스트 판단 근거, 새 가드, 남은 임의 hex 부채).

---

## 5. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 (0) |
| `npm run lint` | **0 errors**, 11 warnings (전부 `scripts/` 기존 미사용 변수 — 이번 변경과 무관) |
| `npx jest` (전체) | **224 suites / 1,956 tests 전부 통과** |
| 다크 실측 | 71 → 0 |
| 라이트 실측 | diff 0바이트 |

커밋 3개, `36e4e75408` 위:

1. `bb1d987754` fix(a11y): 다크 짝 자체가 미달이던 브랜드색·메타 회색 승격 — 다크 71건 중 63건
2. `acf7ef491a` fix(a11y): 임의 hex 패널 위 텍스트 대비 — portfolio·AudioPlayer 8건
3. `214d7f2b11` test(a11y): 다크 짝의 "존재"가 아니라 "충분함"을 보는 가드 + 정본 갱신

합계 66 파일, +225 −120. push 하지 않았다. `.a11y-all.mjs`는 삭제됐다(`git status` 깨끗,
1라운드가 남긴 `report.md`만 untracked).

---

## 6. 자기 리뷰 · 우려

### 지킨 것

- 라이트 고정 경로(`pages/admin/**`, `components/admin/**`, `*/contracts/*`)는 **한 파일도**
  건드리지 않았다(`git diff --name-only`로 확인).
- 라이트 모드 값은 한 곳도 바꾸지 않았다. 라이트 실측 출력이 전/후 바이트 동일한 것이 증거다.
- 카카오 클래스(`bg-kakao`·`text-kakao-ink`·`kakao-dark`)는 건드리지 않았다.
- `KakaoFab`은 `dark:text-primary-light` 한 곳만 바뀌었는데, 이는 FAB 옆의 **보조 흰 원형
  버튼**(`bg-white dark:bg-gray-800`) 아이콘 색이지 노란 카카오 버튼이 아니다.

### 우려

1. **[가장 중요] 메타·캡션의 라이트 값이 정본과 반대다.** 코드가 광범위하게
   `text-gray-400 dark:text-gray-500`을 쓰는데, 정본 §1은 `text-gray-500 / dark:text-gray-400`이다.
   이번엔 다크 쪽만 뒤집어서 결과가 `text-gray-400 dark:text-gray-400`이 된 자리가 많다 —
   **다크는 맞았고 라이트는 여전히 2.51:1로 미달**이다(후기 날짜, release-project 기준일 등
   8개 페이지 라이트 실패의 유일한 진짜 항목). "라이트 값은 바꾸지 마라"는 지시를 지켜
   손대지 않았지만, 3라운드에서 `text-gray-400` → `text-gray-500`으로 마저 뒤집어야 한다.
   `Field.tsx`에는 이미 "플레이스홀더 명암을 뒤집지 말 것"이라는 같은 취지의 주석이 있다.

2. **hover 상태는 실측이 아니라 정적 추론이다.** `dark:hover:text-*` 25곳은 지시대로 같은
   기준을 적용했을 뿐 브라우저로 확인하지 않았다. 값 자체는 비-hover와 동일한 토큰이라
   대비 계산은 같지만, hover 시 배경이 함께 바뀌는 자리가 있으면 결론이 달라질 수 있다.

3. **8개 측정 페이지 밖의 수정은 실측 검증이 없다.** `booking/*`·`subscribe/*`·`lesson`·
   `stories/[id]`의 `text-gray-500` 다크 짝 추가가 그렇다. 변경 방향이 "어두운 회색 →
   밝은 회색"이라 다크에서 나빠질 수는 없고, 라이트 값은 안 건드렸으니 안전하다고 본다.

4. **새 가드는 `text-*`만 본다.** `dark:bg-primary`·`dark:border-primary`는 대상이 아니다.
   테두리는 비텍스트 대비 3:1 기준이라 요건이 다르고, 배경은 그 위 텍스트와 함께 봐야 한다.
   이번 범위에서 벗어나지만 언젠가는 필요하다.

5. **임의 hex 패널이 그대로 남아 있다.** `dark:bg-[#121212]`·`#1a1a1a`는 `gray` 토큰이 아니라
   다크 팔레트 밖의 값이다. 지금은 그 위 텍스트를 `white/60`으로 맞춰 놨는데, 배경을
   토큰으로 옮기면 이 비율이 다시 흔들린다. 정본에 부채로 적어 뒀다.

6. **측정 스크립트의 배경 폴백.** 투명 헤더·그라디언트 배경에서 흰색으로 폴백해 1:1 오탐을
   만든다(라이트 39건). 이번엔 지시대로 diff만 봤지만, 이 오탐이 **진짜 실패를 가릴** 수 있다 —
   실제로 라이트 진짜 실패 4종이 오탐 39건 사이에 묻혀 있었다. 스크립트를 계속 쓸 거라면
   그라디언트·이미지 배경을 만나면 "미상"으로 따로 분류하도록 고치는 편이 낫다.
