# 다크모드 브랜드색 텍스트 대비 수정 보고서

- 브랜치: `fix/dark-mode-brand-contrast` (base `e6f13689aa`)
- 커밋: `c044477eb0` (수정), `7e09a4ebd3` (가드 테스트 + 정본 문서)
- 실측 결과: **다크 미달 41건 → 0건**, 라이트 모드 전후 완전 동일

---

## 1. 원인과 해결 방향

`tailwind.config.ts`의 `primary`·`secondary`·`accent` DEFAULT는 **흰 배경에서 AA를 통과하도록**
고른 값이다(설정 주석: "흰 배경 버튼 모두 통과", "흰 배경 대비 4.5:1 미달이라 emerald-700로 승격").
그래서 다크 배경 `gray-900`(`#030712`)에서는 반대로 너무 어둡다.

| 토큰 | 값 | 대비 | 판정 | 다크 짝으로 채택 |
|---|---|---|---|---|
| `primary` (DEFAULT) | `#6d28d9` | 2.83:1 | 미달 | — |
| `primary-light` | `#7c3aed` | 3.53:1 | 미달 | ✗ (쓰지 않음) |
| `primary-lighter` | `#a78bfa` | 7.40:1 | 통과 | ✓ |
| `secondary` (DEFAULT) | `#be185d` | 3.33:1 | 미달 | — |
| `secondary-light` | `#ec4899` | 5.71:1 | 통과 | ✓ |
| `accent` (DEFAULT) | `#047857` | 3.67:1 | 미달 | — |
| `accent-light` | `#10b981` | 7.94:1 | 통과 | ✓ |

**새 토큰은 만들지 않았다.** 기존 변형 3개만 `dark:` 짝으로 붙였다.

---

## 2. 후보 분류

전수 추출은 `\btext-primary\b` 대신 **`(?<![-\w])text-(primary|secondary|accent)(?![-\w/])`**
로 다시 했다. 지시문의 `\b` 패턴은 `-`가 비단어 문자라 `text-primary-dark`·`text-primary/70`까지
잡는다(189건 중 상당수가 그 오탐이었다). 정확한 전수는 **바레 토큰 305건**이고, 그중 같은 줄에
같은 variant의 다크 짝이 없는 것이 **218줄**이었다.

### 수정 (192건 / 61개 파일)

| variant | 건수 | 적용한 짝 |
|---|---|---|
| `text-primary` | 145 | `dark:text-primary-lighter` |
| `text-secondary` | 17 | `dark:text-secondary-light` |
| `text-accent` | 13 | `dark:text-accent-light` |
| `hover:text-primary` | 10 | `dark:hover:text-primary-lighter` |
| `group-hover:text-primary` | 3 | `dark:group-hover:text-primary-lighter` |
| `focus-visible:text-primary` | 1 | `dark:focus-visible:text-primary-lighter` |
| `hover:text-primary-dark` (방향 역전) | 4 | `dark:hover:text-white` |
| `dark:text-primary-light` → `-lighter` | 1 | `PhoneAwareText.tsx` (아래 §5) |
| 2차 수동 보정 | 2 | `music-promotion.tsx` 아이콘 2개 |

배경 검증: 수정 대상이 올라앉은 표면은 전부 라이트/다크가 전환되는 표면이었다 —
`Section`(`bg-white dark:bg-gray-900` / `bg-gray-50 dark:bg-gray-950/50`), `glass-card`,
`bg-primary/10 dark:bg-primary/20` 배지, `PortfolioDetailModal`(`bg-gray-50 dark:bg-gray-900`).
전 후보 파일을 대상으로 `bg-white`·`bg-*-50/100`에 `dark:` 짝이 없는 줄을 기계적으로 훑어
**영구 밝은 표면은 admin 외에 없음**을 확인했다.

### 제외

| 분류 | 건수 | 대표 위치 | 이유 |
|---|---|---|---|
| 라이트 고정 화면 | 7 | `pages/admin/{bookings,funding,subscriptions}/*`, `components/admin/ContractForm.tsx`, `pages/[locale]/contracts/[id]/sign.tsx` | 정본 §1. `theme-init.js`가 모든 라우트에 `.dark`를 붙이므로, 흰 카드 위에 밝은 보라를 올리면 대비가 **오히려** 깨진다. `ContractForm`은 `pages/admin/contracts/{new,[id]/edit}`에서만 쓰여 같은 취급 |
| 이미 다크 짝 있음 | 96 | `ContactInfoCard`(`dark:hover:text-primary-light`), `TableOfContents`·`DropdownMenu`(`dark:hover:text-accent`), funding 계열 | 규칙 2 |
| 폼 컨트롤 채움색 | 6 | `BookingWizard:329,517`, `MixingOrderWizard:180,213,312`, `ContactFormCard:279` | `<input type=checkbox/radio>`의 체크 표시 채움색이지 읽는 텍스트가 아니다 |
| 장식 워터마크 | 1 | `CurriculumCard:18` (`opacity-10 text-6xl`) | 10% 불투명도 배경 장식. 밝게 올리면 디자인 의도가 바뀐다 |
| 영구 밝은 배경 위 | 2 | `BuyerIntentHubPage:149`, `ReleaseHeroCtas:19` (`bg-white text-primary-dark`) | 규칙 3. 애초에 `-dark` 변형이라 대상 아님 |
| 주석 | 2 | `Button.tsx:14`, `QuickAnswers.tsx:47` | 코드가 아님 |

`hover:`·`group-hover:`·`focus-visible:` variant를 수정 대상에 포함한 판단: 아이콘의
`stroke`/`fill`이 currentColor라는 지시문의 근거가 그대로 적용되고, hover 상태 역시 다크에서
2.83:1로 읽히는 실제 결함이다. 다만 측정 스크립트는 hover를 재현하지 않으므로 이 14건은
실측이 아니라 정적 추론으로 고친 것이다.

`hover:text-primary-dark` 4곳(`TierPage:310`, `PracticeRoomCards:159`, `release-project/index:168,179`)은
다크 짝만 붙이면 **hover할수록 더 어두워지는** 회귀가 남는다. 라이트에서의 의도가 "hover 시 진하게"
이므로 다크의 대칭은 흰색이라고 보고 `dark:hover:text-white`를 붙였다.

---

## 3. 실측 (puppeteer, 알파 합성 + 대형 텍스트 완화 4.5/3.0)

### 다크 모드

| 페이지 | 전 | 후 | 검사 요소 수 |
|---|---|---|---|
| `/ko` | 10 | **0** | 69 |
| `/ko/pricing` | 5 | **0** | 60 |
| `/ko/recording` | 3 | **0** | 55 |
| `/ko/practice-room` | 5 | **0** | 745 |
| `/ko/stories` | 4 | **0** | 129 |
| `/ko/portfolio` | 4 | **0** | 96 |
| `/ko/about` | 7 | **0** | 47 |
| `/ko/release-project` | 3 | **0** | 72 |
| **합계** | **41** | **0** | 1,273 |

중간 측정에서 1건이 남았다: `/ko`의 `010-4255-7893`(3.25:1). `PhoneAwareText.tsx:47`이
**이미 다크 짝을 갖고 있었지만** 그 짝이 `dark:text-primary-light`(3.53:1, 본문 크기라 완화 불가)
였다. 규칙 2("이미 짝이 있으면 건드리지 마라")의 문자적 적용과 목표(0건)가 충돌하는 유일한
지점이라 **실측이 미달을 증명한 이 한 줄만** `-lighter`로 올렸다. 나머지 기존 짝은 손대지 않았다.

### 라이트 모드 — 전후 `diff` 결과 **완전 동일** (0건 차이)

8개 페이지 모두 전 32건 / 후 32건이고 줄 단위로 동일하다. 이 32건은 **측정 스크립트의 한계로
인한 오탐**이며 이번 변경과 무관하다:

- **header 8건** (1.00:1, 흰 글씨 on 흰색): 투명 헤더가 히어로 **이미지** 위에 떠 있다. 스크립트의
  `effBg`는 조상 체인의 `backgroundColor`만 합성하므로 이미지를 못 보고 흰색으로 폴백한다.
- **footer 24건** (1.16~1.18:1): `components/layout/Footer.tsx:43`이
  `bg-gradient-to-r from-primary via-secondary to-accent`다. 그라디언트는 `background-image`라
  `backgroundColor`가 `transparent` → 역시 흰색 폴백. 실제로는 진한 보라~초록 위 흰 글씨다.

---

## 4. 회귀 방지 — 가드 테스트를 **만들었다**

지시문은 "오탐이 많을 것 같으면 만들지 말고 문서만"이었다. 수정 후 실측으로 오탐 후보를 세어
판단했다: 라이트 고정 경로와 주석을 제외한 뒤 **다크 짝 없는 잔여가 정확히 7건**이고, 전부
"텍스트가 아닌 자리"로 한 줄로 설명된다. 허용목록이 7줄로 끝나므로 가드가 성립한다고 보고
`tailwind.config.test.ts`에 「브랜드색 텍스트의 다크 짝」 describe를 추가했다.

- 스캔: `components/**`·`pages/**`의 `.tsx`(테스트 제외), 라이트 고정 경로 제외, 주석 줄 제외
- 판정: `((?:[a-z-]+:)*)text-(primary|secondary|accent)`에 대해 같은 줄에
  `dark:{같은 variant}text-`가 없으면 실패. 실패 메시지가 올바른 짝 3개와
  "primary-light는 3.53:1로 미달이라 쓰지 말 것"을 함께 출력한다
- 허용목록 `BRAND_TEXT_ALLOW`: 파일 + 줄 안의 고정 문자열로 지정(줄 번호는 금방 어긋난다).
  각 항목에 **이유** 필수
- 두 번째 it: `primary-lighter`·`secondary-light`·`accent-light` 토큰 존재 확인
  (§0 "정의되지 않은 클래스는 조용히 사라진다" 대응)

동작 확인: `PracticeRoomCards.tsx`의 짝을 일부러 지우니 해당 줄을 지목하며 실패했고,
되돌리니 통과했다.

가드를 만들었지만 **정본 문서도 함께 고쳤다.** 가드는 "짝이 있는가"만 알려줄 뿐 "왜 `-light`가
아니라 `-lighter`인가"를 말해주지 못한다. `docs/design-system.md` §1 다크모드 절에
「브랜드색 텍스트는 다크 짝을 함께 쓴다」를 추가하고 위 대비 표, variant 규칙, 아이콘이 같은
규칙을 따르는 이유, 라이트 고정 경로 제외 이유, 남은 부채를 적었다.

---

## 5. 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 (0 errors) |
| `npm run lint` | 11 problems — **0 errors**, 11 warnings (전부 `scripts/` 의 기존 unused-vars) |
| `npx jest` | 212 suites / **1,754 tests 전부 통과** |

주의 — 워크트리에는 prebuild 생성물이 없어 처음엔 3개 suite가 `lib/story-catalog.json`·
`lib/portfolio-meta.json` 부재로 실패했다. `npm run generate:manifests` 후 정상화됐고, 이 생성물은
gitignore라 커밋에 들어가지 않았다. 또 한 번은 `PledgeWizard.test.tsx:162`가 실패했는데 단독 실행과
재실행에서 모두 통과해 플레이키로 판단했다(내 diff에 없는 파일이다).

---

## 6. 자기 리뷰

**한 번 잘못 만들고 되돌린 것.** 첫 변환 스크립트가 variant 접두사를 검사하지 않아
`dark:text-accent`를 다시 매칭해 `dark:dark:text-accent-light`를 만들 뻔했다. 프리픽스 분포를
찍어 보고 발견해 `git checkout`으로 전량 되돌린 뒤 가드를 넣고 다시 돌렸다. 220건 → 189건으로
줄어든 차이가 그 오탐이다.

**한 번 실수로 되돌린 것.** 가드 동작을 확인하려고 `PracticeRoomCards.tsx`를 임시 훼손한 뒤
`git checkout --`로 복구했는데, 커밋 전이라 **내 수정까지 함께 날아갔다.** 곧바로 발견해
해당 줄을 복원했다(`changes.txt` 원장과 대조해 그 파일의 변경이 1건뿐임을 확인).

**기계 치환의 사각.** `h-4 w-4`/`h-5 w-5` 휴리스틱으로 체크박스를 제외했더니
`music-promotion.tsx`의 `<CheckCircle2 className="h-5 w-5 text-primary">` 아이콘 2개가 같이
빠졌다. 변환 후 잔여를 다시 세는 검증 패스를 돌려서 잡았다 — 치환 스크립트만 믿었으면 놓쳤을
자리다. 지금은 그 잔여 검사 로직이 그대로 CI 가드가 됐다.

---

## 7. 우려

1. **`dark:text-primary-light`(3.53:1) 약 47곳이 남아 있다.** 규칙 2에 따라 건드리지 않았다.
   대부분 `aria-hidden` 아이콘이거나 `text-3xl` 이상 대형 숫자라 완화 기준(3:1)은 통과하지만,
   본문 크기 텍스트도 섞여 있다 — `PricingCard:115`(가격, `text-3xl`이라 통과),
   `ServicePriceTable:76`, `FAQSection:67`, `RegionLinksSection:38`,
   `MarkdownRenderer:165`(`<strong>`), `QuickAnswers:48`, `artists/[slug]:83`,
   `404.tsx:44`·`500.tsx:43`. 이번 8개 페이지 실측에서 걸린 건 `PhoneAwareText` 하나뿐이었지만
   다른 페이지에는 더 있을 가능성이 높다. **별도 라운드로 `-lighter` 승격을 권한다.**
   `components/ui/ProjectRowCard.tsx:121`의 `dark:text-primary/80`(#6d28d9 80%)도 같은 부채다.
   가드는 "짝이 있는가"만 보므로 이 부채를 잡지 못한다.

2. **hover·focus 상태는 실측되지 않았다.** 측정 스크립트가 기본 상태만 본다. hover variant 14건은
   정적 추론으로 고쳤고, 기존 `dark:hover:text-primary-light` 28곳은 규칙 2에 따라 두었다 —
   결과적으로 hover의 다크 색이 `-lighter`와 `-light`로 갈린다. 1번 부채를 정리하면 함께 해소된다.

3. **비-ko 로케일과 스토리 상세는 재지 않았다.** 지정된 8개 페이지만 측정했다. 수정은 공용
   컴포넌트 위주라 전파될 것으로 보이지만 검증된 사실은 아니다.

4. **라이트 모드 "0건 회귀"의 근거는 diff 동일성이다.** 스크립트가 헤더·푸터를 못 읽는 한계는
   전후 동일하게 작용하므로 회귀 판정으로는 유효하지만, 그 32건 자체가 실제로 문제없는지는
   이 도구로 확인되지 않았다(육안·수동 계산으로는 정상이다).

5. **`dark:hover:text-white` 4곳은 디자인 판단이다.** 대비상 안전하지만(흰색 = 최대 대비)
   브랜드 hover 색을 흰색으로 바꾼 것이라 디자이너 확인이 필요할 수 있다.
