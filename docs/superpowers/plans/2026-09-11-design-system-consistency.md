# 디자인 시스템 일관성 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-09-11 디자인 감사에서 나온 불일치를 없앤다 — 정의되지 않은 `.typo-*` 클래스 결함을 고치고, 포커스 링 누락을 메우고, 버튼·폼을 공용 프리미티브로 모으고, 간격·색·타이포를 정본(`docs/design-system.md`)에 맞춘다.

**Architecture:** 새 컴포넌트를 만들기보다 **이미 있는 프리미티브의 채택률을 올린다.** `Button.tsx`에 카카오·스크림 variant와 `shape`를 더해 CTA 소비처를 흡수하고, 흩어진 input 클래스 문자열 4벌을 `components/ui/Field.tsx` 하나로 모은다. 시각적 결과는 현행 유지가 기본이고, 정본이 통일을 지시한 축(반경·포커스·경고색)만 바꾼다.

**Tech Stack:** Tailwind(플러그인 `addComponents`), class-variance-authority(기존), jest + @testing-library(기존). **신규 의존성 없음** — `asChild`는 `@radix-ui/react-slot` 없이 `cloneElement`로 구현한다.

**Spec:** `docs/design-system.md` (이 저장소의 디자인 정본)

## Global Constraints

- **카카오 배색 규칙(양방향)**: 목적지가 카카오톡인 링크는 전부 `bg-kakao` + `text-kakao-ink`, 카카오가 아닌 링크에는 절대 옐로 금지. 비-ko 로케일은 목적지가 `/contact` 폼이라 옐로 금지 — 기존 `isKorean`/locale 분기를 그대로 보존한다.
- **전환 표면 보호**: 카카오 CTA는 GA4로 검증된 유일한 전환 채널이다. 마이그레이션은 **시각적 결과와 DOM 구조(추적 속성·`data-*`·`onClick` 핸들러·`href`)를 보존**하는 것이 기본이고, 정본이 명시적으로 통일을 지시한 축만 바꾼다. `utils/analytics.ts`의 `trackLeadEvent`/`trackMicroEvent` 호출을 하나도 잃지 않는다.
- **미정의 클래스 금지**: 새 클래스명은 반드시 `tailwind.config.ts`에 정의한다. Tailwind는 미정의 클래스를 조용히 버린다(2026-08-13 카카오 사고, 2026-09-11 `typo-*` 사고).
- **글래스 규칙**: 뷰포트당 상시 고정 blur 레이어 ≤ 2. 인플로우 카드는 `.glass-card`(blur 없음). glass variant hover에 `SHADOW_HOVER`를 섞지 않는다. 히어로 이미지 위 CTA에 `glass-clear` 금지.
- **`transition-all` 금지**: 바꾸는 속성만 지정한다.
- **다크모드**: 배경·텍스트·보더에 `dark:` 짝. 예외는 `pages/admin/**`(라이트 고정).
- **접근성**: 인터랙티브 요소는 `focus-visible` 링 + 44px 터치 타깃. 아이콘 전용 버튼은 `aria-label`.
- **검증 순서**: `npx tsc --noEmit` → `npx eslint <touched>` → `npx jest <touched tests>` → 태스크 완료 시 `npm test`.
- **작업 위치**: worktree `feat/design-system-consistency`. 푸시는 컨트롤러가 한다.

## 실행 전 확인 입력

| 항목 | 이 계획의 결정 | 바꾸려면 |
|---|---|---|
| 자유 배치 CTA 반경 | `rounded-full` | 정본 §3 반경표 |
| 카드·폼 안 버튼 반경 | `rounded-xl` | 〃 |
| 폼 컨트롤 반경 | `rounded-lg` | 〃 |
| 경고색 | `amber-*`(‌`yellow-*` 전면 제거) | 정본 §1 상태색 |
| 별점 색 | `amber-400` | 〃 |
| `pages/admin/**` | 다크모드·타이포 통일 대상에서 제외 | 정본 §1, §9 |

---

### Task 1: 미정의 `.typo-*` 클래스 정의 + 가드 테스트 확장

지금 `typo-button`(404·500 버튼) · `typo-caption`(연습실 6곳) · `typo-body`(연습실 2곳)가 정의 없이 쓰여 스타일이 통째로 빠진 채 렌더된다. 정의를 추가하고, 같은 사고가 다시 나지 않게 색 토큰만 보던 가드 테스트를 `.typo-*`까지 넓힌다.

**Files:**
- Modify: `tailwind.config.ts` (플러그인 `addComponents` 타이포 블록, 현재 `.typo-footer-meta` 다음)
- Modify: `tailwind.config.test.ts` (describe 추가)

**Interfaces:**
- Produces: `.typo-page-title`, `.typo-body`, `.typo-caption`, `.typo-button` — 이후 Task 9가 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tailwind.config.test.ts` 끝에 추가한다. 기존 `walk`/`SCAN_DIRS`/`ROOT` 헬퍼를 재사용한다:

```ts
// `.typo-*` 컴포넌트 클래스도 같은 사고를 냈다(2026-09-11): typo-button·typo-caption·
// typo-body가 정의 없이 6곳에서 쓰여 404/500 버튼과 연습실 캡션이 스타일 없이 렌더됐다.
// 색 토큰과 달리 Tailwind 기본 팔레트 같은 "정의 없이도 유효한 이름"이 없으므로
// typo- 접두사 전체를 검사해도 오탐이 생기지 않는다.
const definedTypoClasses = (): Set<string> => {
  const source = readFileSync(path.join(ROOT, 'tailwind.config.ts'), 'utf-8');
  const names = new Set<string>();
  for (const match of source.matchAll(/'\.(typo-[\w-]+)'\s*:/g)) names.add(match[1]);
  return names;
};

describe('typo 컴포넌트 클래스', () => {
  it('쓰이는 .typo-* 클래스는 전부 tailwind.config.ts에 정의돼 있어야 한다', () => {
    const defined = definedTypoClasses();
    const missing: string[] = [];

    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        for (const match of content.matchAll(/\btypo-[\w-]+/g)) {
          if (!defined.has(match[0])) {
            missing.push(`${path.relative(ROOT, file)}: ${match[0]}`);
          }
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        'tailwind.config.ts에 정의되지 않은 .typo-* 클래스를 쓰는 곳이 있습니다:\n' +
          missing.join('\n'),
      );
    }
  });

  it('역할 클래스 최소 구성이 존재한다', () => {
    const defined = definedTypoClasses();
    for (const name of [
      'typo-section-title', 'typo-section-lead', 'typo-page-title',
      'typo-card-title', 'typo-card-subtitle', 'typo-card-body', 'typo-card-meta',
      'typo-card-cta', 'typo-body', 'typo-caption', 'typo-button',
    ]) {
      expect(defined.has(name)).toBe(true);
    }
  });
});
```

`walk`·`SCAN_DIRS`·`ROOT`가 기존 describe 블록 바깥(모듈 스코프)에 있는지 확인하고, 안에 있다면 밖으로 끌어올린다.

- [ ] **Step 2: 실패 확인**

Run: `npx jest tailwind.config.test.ts`
Expected: FAIL — `pages/404.tsx: typo-button`, `pages/[locale]/practice-room.tsx: typo-caption`, `components/practice-room/PriceLeader.tsx: typo-body` 등이 missing 목록에 나온다. 두 번째 테스트도 `typo-page-title` 부재로 실패.

- [ ] **Step 3: 클래스 정의 추가**

`tailwind.config.ts`의 `addComponents({...})` 타이포 블록에서 `.typo-footer-meta` 항목 **뒤에** 추가한다(같은 객체 안):

```ts
        // 트랜잭션·결과 페이지 h1(예약 완료, 서명, 구독 관리). 마케팅 페이지 h1은
        // ImageHero의 font-hero 스케일을 쓰므로 여기 해당하지 않는다.
        '.typo-page-title': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.heading-3[0]'),
          lineHeight: theme('fontSize.heading-3[1].lineHeight'),
          letterSpacing: theme('fontSize.heading-3[1].letterSpacing'),
          fontWeight: '700',
          color: theme('colors.gray.900'),
          '.dark &': {
            color: theme('colors.white'),
          },
        },
        // 카드 밖 일반 본문. .typo-card-body와 값은 같고 의미만 다르다 —
        // 호출부가 text-gray-* 를 덧붙이면 utilities 레이어가 이겨서 그 색이 적용된다.
        '.typo-body': {
          fontSize: theme('fontSize.body-1[0]'),
          lineHeight: theme('fontSize.body-1[1].lineHeight'),
          fontWeight: theme('fontSize.body-1[1].fontWeight'),
          color: theme('colors.gray.700'),
          '.dark &': {
            color: theme('colors.gray.300'),
          },
        },
        '.typo-caption': {
          fontSize: theme('fontSize.caption[0]'),
          lineHeight: theme('fontSize.caption[1].lineHeight'),
          fontWeight: theme('fontSize.caption[1].fontWeight'),
          color: theme('colors.gray.500'),
          '.dark &': {
            color: theme('colors.gray.400'),
          },
        },
        // 버튼 라벨. 색은 버튼 variant가 정하므로 여기서 지정하지 않는다.
        '.typo-button': {
          fontFamily: theme('fontFamily.title'),
          fontSize: theme('fontSize.body-1-medium[0]'),
          lineHeight: theme('fontSize.body-1-medium[1].lineHeight'),
          fontWeight: theme('fontSize.body-1-medium[1].fontWeight'),
        },
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest tailwind.config.test.ts && npx tsc --noEmit`
Expected: PASS (기존 카카오 테스트 2개 + 신규 2개)

- [ ] **Step 5: 빌드 CSS에 실제로 들어갔는지 확인**

Run: `npm run build 2>&1 | tail -5 && grep -c "typo-page-title\|typo-button\|typo-caption\|typo-body" .next/static/css/*.css`
Expected: 빌드 성공, grep 결과 1 이상. (0이면 Tailwind가 클래스를 못 찾은 것 — content 경로 확인)
빌드 산출물(`utils/imageMetadata.json`, `lib/fonts/pretendard-variable.woff2` 등)이 수정되면 `git checkout --`로 되돌리고 커밋에 넣지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add tailwind.config.ts tailwind.config.test.ts
git commit -m "fix(design): 정의 없이 쓰이던 .typo-* 4종 정의 + 가드 테스트를 typo 클래스로 확장

typo-button·typo-caption·typo-body가 정의 없이 6곳에서 쓰여 404/500 버튼과
연습실 캡션이 스타일 없이 렌더되고 있었다. 2026-08-13 카카오 색 사고와 같은
실패 유형(Tailwind는 미정의 클래스를 조용히 버린다)이라 가드도 같이 넓힌다."
```

---

### Task 2: 포커스 링 누락 CTA 보강

키보드 포커스 시 시각 피드백이 없는 CTA 4곳을 메운다. 정본 §5의 표준 조합을 쓴다.

**Files:**
- Modify: `components/booking/BookingEntryButton.tsx:28`
- Modify: `components/inline/StickyBottomCTA.tsx` (카카오 버튼 ~L113, 전화 버튼 ~L124, ~L143)
- Modify: `components/inline/InlinePriceCallout.tsx:149`
- Modify: `components/inline/InlineServiceCallout.tsx:231`
- Test: `components/inline/focusRing.test.tsx` (신규)

**Interfaces:**
- Consumes: 없음. Produces: 없음(스타일만).

- [ ] **Step 1: 실패하는 테스트 작성**

`components/inline/focusRing.test.tsx` (신규):

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import BookingEntryButton from '../booking/BookingEntryButton';
import InlineBookingCallout from './InlineBookingCallout';
import InlinePriceCallout from './InlinePriceCallout';
import InlineServiceCallout from './InlineServiceCallout';

/**
 * 전환 CTA에 키보드 포커스 링이 있는지 지킨다. 2026-09-11 감사에서 네 곳이
 * focus-visible 링 없이 배포돼 있었다 — 마우스로는 드러나지 않는 결함이라
 * 테스트로 고정한다. Task 4의 Button 전환 때 이 테스트가 안전망이 된다.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue || _key,
  }),
}));

const cases: [string, React.ReactElement][] = [
  ['BookingEntryButton', <BookingEntryButton service="recording" locale="ko" />],
  ['InlineBookingCallout', <InlineBookingCallout message="EP 제작·발매 일정 상담" locale="ko" />],
  ['InlinePriceCallout', <InlinePriceCallout id="recording" locale="ko" />],
  ['InlineServiceCallout', <InlineServiceCallout type="lesson" locale="ko" />],
];

describe('전환 CTA 포커스 링', () => {
  it.each(cases)('%s의 모든 링크·버튼에 focus-visible 링이 있다', (label, element) => {
    const { container } = render(element);
    const targets = container.querySelectorAll('a, button');
    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((el) => {
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:ring-2/);
      expect(`${label} > ${el.textContent?.trim()}: ${el.className}`).toMatch(/focus-visible:outline-none/);
    });
  });
});
```

`InlinePriceCallout`의 `id`로 `'recording'`이 유효한지는 `components/inline/InlinePriceCallout.tsx`의 `PRICE_LABELS` 키(`recording`·`mixing`·`mastering`·`special`·`additional`)로 확인했다. 렌더가 비면 유효한 키로 바꾼다.

`StickyBottomCTA`는 IntersectionObserver mock과 노출 트리거가 필요해 이 파일에 넣지 않는다. 대신 **기존 `components/inline/StickyBottomCTA.test.tsx`의 "노출된 상태"를 만드는 테스트 안에** 같은 단언을 추가한다:

```tsx
    // 포커스 링 회귀 방지 (2026-09-11 감사)
    screen.getAllByRole('link').forEach((el) => {
      expect(el.className).toMatch(/focus-visible:ring-2/);
    });
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/inline/focusRing.test.tsx components/inline/StickyBottomCTA.test.tsx`
Expected: FAIL — `BookingEntryButton`, `InlinePriceCallout`, `InlineServiceCallout`, `StickyBottomCTA`가 걸린다. `InlineBookingCallout`은 이미 링이 있어 통과할 수 있다(감사 결과와 일치하면 정상).

- [ ] **Step 3: 링 추가**

각 요소의 className에 표면에 맞는 조합을 덧붙인다. **다른 클래스는 건드리지 않는다.**

- 카카오 옐로 버튼(`bg-kakao`가 있는 것):
  ```
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
  ```
- 그 외 일반 배경 위:
  ```
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
  ```
- `StickyBottomCTA`는 하단 고정 바라 오프셋 배경이 바 자체다. 바의 배경색을 읽고 `ring-offset-*`를 그 색으로 맞춘다(바가 흰색/어두운색 분기면 `dark:` 짝도).

- [ ] **Step 4: 통과 확인**

Run: `npx jest components/inline components/booking/BookingEntryButton.test.tsx && npx tsc --noEmit`
Expected: PASS. 기존 `StickyBottomCTA.test.tsx`·`InlineCtaTracking.test.tsx`도 그대로 통과해야 한다(추적 속성 보존 확인).

- [ ] **Step 5: 커밋**

```bash
git add components/booking/BookingEntryButton.tsx components/inline/
git commit -m "fix(a11y): 포커스 링이 없던 전환 CTA 4곳 보강 + 회귀 테스트"
```

---

### Task 3: Button에 kakao·scrim variant와 shape 추가, asChild 실제 구현

`Button.tsx`는 지금 CTA 어디에서도 안 쓰인다. 소비처를 흡수하려면 카카오·스크림 variant와 pill/block 반경, 그리고 링크로 쓸 수 있는 `asChild`가 필요하다. `asChild`는 **타입에만 있고 구현이 없어** 지금 넘기면 조용히 `<button>`이 렌더된다.

**Files:**
- Modify: `components/ui/Button.tsx`
- Test: `components/ui/Button.test.tsx` (신규)

**Interfaces:**
- Produces:
  ```tsx
  buttonVariants({ variant?, size?, shape?, fullWidth?, className? }): string
  <Button variant="solid|outline|ghost|secondary|glass|kakao|scrim"
          size="sm|md|lg|icon" shape="pill|block" fullWidth asChild />
  ```
  `asChild`면 단일 자식 엘리먼트에 클래스를 합성해 그 자식을 렌더한다(`<a>`·`next/link`).
  Task 4가 이걸 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/ui/Button.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Button, buttonVariants } from './Button';

describe('Button', () => {
  it('기본은 button 엘리먼트를 렌더한다', () => {
    render(<Button>보내기</Button>);
    expect(screen.getByRole('button', { name: '보내기' })).toBeInTheDocument();
  });

  it('asChild면 자식 엘리먼트를 렌더하고 클래스를 합성한다', () => {
    render(
      <Button asChild variant="kakao" shape="pill">
        <a href="https://open.kakao.com/x" data-cta="k">카카오톡 문의</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '카카오톡 문의' });
    expect(link).toHaveAttribute('href', 'https://open.kakao.com/x');
    expect(link).toHaveAttribute('data-cta', 'k'); // 자식 속성 보존
    expect(link.className).toMatch(/bg-kakao/);
    expect(link.className).toMatch(/rounded-full/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('asChild가 자식의 기존 className을 잃지 않는다', () => {
    render(
      <Button asChild>
        <a href="/x" className="custom-class">링크</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: '링크' });
    expect(link.className).toMatch(/custom-class/);
    expect(link.className).toMatch(/bg-primary/);
  });

  it('kakao variant는 옐로 배경에 kakao-ink 글자와 kakao-ink 포커스 링을 쓴다', () => {
    const cls = buttonVariants({ variant: 'kakao' });
    expect(cls).toMatch(/bg-kakao\b/);
    expect(cls).toMatch(/text-kakao-ink/);
    expect(cls).toMatch(/focus-visible:ring-kakao-ink/);
    expect(cls).not.toMatch(/text-white/);
  });

  it('shape이 반경을 정한다 — pill은 full, block은 xl', () => {
    expect(buttonVariants({ shape: 'pill' })).toMatch(/rounded-full/);
    expect(buttonVariants({ shape: 'block' })).toMatch(/rounded-xl/);
    expect(buttonVariants({ shape: 'pill' })).not.toMatch(/rounded-xl/);
  });

  it('모든 variant가 44px 이상 터치 타깃과 focus-visible 링을 갖는다', () => {
    const variants = ['solid', 'outline', 'ghost', 'secondary', 'glass', 'kakao', 'scrim'] as const;
    for (const variant of variants) {
      const cls = buttonVariants({ variant });
      expect(cls).toMatch(/focus-visible:ring-2/);
      expect(cls).toMatch(/\bh-11\b/); // size md 기본
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/ui/Button.test.tsx`
Expected: FAIL — `asChild`가 자식을 렌더하지 않고(`<button>`이 나옴), `kakao`/`scrim`/`shape`가 없다.

- [ ] **Step 3: 구현**

`components/ui/Button.tsx`를 아래로 바꾼다. **기본 클래스 문자열에서 `rounded-xl`을 빼고** `shape` variant로 옮기는 것이 핵심이다(빼지 않으면 `rounded-full`과 충돌해 CSS 순서에 따라 결과가 흔들린다).

```tsx
import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  // transition-all → 명시 property: iOS Safari에서 transition-all은 layout 트리거 가능 속성도
  // 보간해 hover 시 reflow 깜빡 유발. 시각 변화는 colors·shadow·transform만.
  // 반경은 shape variant가 소유한다 — 여기에 rounded-*를 두면 pill과 충돌한다.
  "inline-flex items-center justify-center gap-2 typo-button transition-[colors,box-shadow,transform] duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        solid: "bg-primary text-white hover:bg-primary-dark shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        outline: "border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/5 hover:border-primary/40 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        ghost: "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        secondary: "bg-white text-gray-900 shadow-sm hover:bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:text-white dark:border-gray-700 dark:hover:bg-gray-700 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // Liquid Glass 재질 버튼. bg/border/shadow는 .glass-regular(components 레이어)가
        // 제공하므로 여기에 bg-* 등 충돌 유틸리티를 추가하지 말 것 — utilities 레이어가
        // 재질을 덮어써 폴백(솔리드 강등)까지 깨진다.
        glass: "glass-regular text-gray-700 dark:text-gray-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 카카오톡 목적지 전용. 옐로 위 글자는 항상 kakao-ink(흰 글씨는 대비 1.3:1로 미달),
        // 포커스 링도 옐로 위에서 보이도록 ink를 쓴다.
        kakao: "bg-kakao text-kakao-ink hover:bg-kakao-dark shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-kakao-ink focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
        // 어두운 히어로 이미지 위 2차 액션. 흰 틴트(bg-white/*)는 배경을 밝혀 흰 글씨
        // 대비를 오히려 떨어뜨리므로 어두운 스크림 + 흰 테두리를 쓴다.
        scrim: "bg-black/30 border border-white/40 text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.55)] hover:bg-black/45 hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-white/70 focus-visible:ring-offset-black/20",
      },
      size: {
        sm: "h-11 px-3 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-14 px-8 text-lg",
        icon: "h-11 w-11",
      },
      shape: {
        // 자유 배치 CTA(히어로·스티키·FAB·인라인 콜아웃)
        pill: "rounded-full",
        // 카드·폼 안의 버튼
        block: "rounded-xl",
      },
      fullWidth: {
        true: "w-full",
      }
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
      shape: "block",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * 단일 자식 엘리먼트(<a>·next/link)에 버튼 스타일을 합성해 그 자식을 렌더한다.
   * 링크를 버튼처럼 보이게 할 때 쓴다 — 이 저장소는 @radix-ui/react-slot을 두지 않으므로
   * cloneElement로 직접 구현한다. 자식의 className과 나머지 props는 보존된다.
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, fullWidth, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, shape, fullWidth, className }));

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        ...child.props,
        // 자식의 className을 뒤에 둬 호출부가 개별 조정을 이길 수 있게 한다.
        className: cn(classes, child.props.className),
        ref,
      } as React.Attributes);
    }

    return <button className={classes} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest components/ui/Button.test.tsx && npx tsc --noEmit && npx eslint components/ui/Button.tsx`
Expected: PASS. `cn`이 tailwind-merge 기반이면 `rounded-full`/`rounded-xl` 충돌이 자동 해소되지만, 그렇지 않더라도 기본 문자열에서 `rounded-xl`을 뺐으므로 충돌 자체가 없다. `lib/utils.ts`의 `cn` 구현을 확인하고 보고서에 적어라.

- [ ] **Step 5: 커밋**

```bash
git add components/ui/Button.tsx components/ui/Button.test.tsx
git commit -m "feat(ui): Button에 kakao·scrim variant와 pill/block shape 추가, asChild 실제 구현

asChild가 타입에만 있고 구현이 없어 넘겨도 조용히 button이 렌더되던 것을 고친다."
```

---

### Task 4: CTA 소비처를 Button으로 전환

CTA 10종이 `<a>`/`<button>`에 직접 스타일을 입혀 반경이 4갈래(`rounded-full`·`2xl`·`xl`·`lg`)로 갈렸다. Task 3의 Button으로 모은다.

**전환 표면이라 규칙이 엄격하다.** 각 컴포넌트에서 `href`·`onClick`·`target`·`rel`·`data-*`·`aria-*`·추적 호출(`trackLeadEvent`/`trackMicroEvent`)을 **하나도 바꾸지 않는다.** 바뀌는 것은 시각 클래스뿐이고, 그중에서도 반경만 정본에 맞춰 통일된다.

**Files:**
- Modify: `components/common/HeroKakaoCta.tsx` (pill 유지)
- Modify: `components/common/ContactCTA.tsx` (`rounded-2xl` → pill)
- Modify: `components/booking/BookingEntryButton.tsx` (pill 유지)
- Modify: `components/inline/InlinePriceCallout.tsx`, `components/inline/InlineServiceCallout.tsx` (`rounded-lg` → pill)
- Modify: `components/inline/InlineBookingCallout.tsx` (pill 유지)
- Modify: `components/inline/StickyBottomCTA.tsx` (pill 유지)
- Modify: `components/ui/PricingCard.tsx` (카드 안 → block 유지)
- Modify: `pages/404.tsx`, `pages/500.tsx` (pill 유지)
- Test: 기존 `components/common/ContactCTA.test.tsx`, `components/inline/StickyBottomCTA.test.tsx`, `components/inline/InlineCtaTracking.test.tsx`, `components/release/ReleaseHeroCtas.test.tsx`, `components/contact/{Korean,English}FastContactActions.test.tsx`, `components/inline/focusRing.test.tsx`(Task 2) 전부 통과 유지

**Interfaces:**
- Consumes: Task 3의 `Button`/`buttonVariants`.

- [ ] **Step 1: 전환 전 스냅샷 확보**

```bash
npx jest components/common/ContactCTA.test.tsx components/inline components/release/ReleaseHeroCtas.test.tsx components/contact components/booking/BookingEntryButton.test.tsx 2>&1 | tail -20
```
현재 전부 통과하는지 먼저 확인하고 결과를 보고서에 적는다. 하나라도 실패하면 **전환을 시작하지 말고 BLOCKED로 보고**한다.

- [ ] **Step 2: 한 컴포넌트씩 전환**

각 파일에서 버튼처럼 생긴 `<a>`/`<button>`을 다음 형태로 바꾼다:

```tsx
// 링크인 경우
<Button asChild variant="kakao" shape="pill" size="lg">
  <a href={kakaoUrl} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
    <MessageCircle size={20} aria-hidden="true" />
    {label}
  </a>
</Button>

// 버튼인 경우
<Button variant="solid" shape="block" onClick={handleClick}>{label}</Button>
```

**컴포넌트별 지정:**

| 파일 | variant | shape | size |
|---|---|---|---|
| `HeroKakaoCta` 1차(카카오) | `kakao` | `pill` | `lg` |
| `HeroKakaoCta` 2차(전화, onImage) | `scrim` | `pill` | `lg` |
| `HeroKakaoCta` 2차(전화, onSurface) | `outline` | `pill` | `lg` |
| `ContactCTA` 1차 | ko는 `kakao`, 비-ko는 `solid` | `pill` | `lg` |
| `ContactCTA` 2차 | `scrim` 또는 기존 스타일에 대응하는 variant | `pill` | `lg` |
| `BookingEntryButton` | `solid` | `pill` | `lg` |
| `Inline{Price,Service,Booking}Callout` 카카오 | `kakao` | `pill` | `md` |
| `StickyBottomCTA` 카카오 | `kakao` | `pill` | `md` |
| `StickyBottomCTA` 전화(아이콘) | `secondary` 또는 기존 대응 | `pill` | `icon` |
| `PricingCard` 카카오 CTA | `kakao` | `block` | `md`, `fullWidth` |
| `PricingCard` 2차 | `outline` | `block` | `md`, `fullWidth` |
| `404`/`500` 1차 | `solid` | `pill` | `md` |
| `404`/`500` 2차 | `outline` | `pill` | `md` |

**보존 규칙:**
- ko/비-ko 분기(`isKorean`)와 그에 딸린 목적지·라벨·색 분기를 그대로 둔다. 비-ko가 `/contact`로 가면 **절대 `kakao` variant를 쓰지 않는다.**
- 기존 className 중 variant가 대체하지 못하는 것(레이아웃 `w-full sm:w-auto`, `whitespace-normal`, `min-h-[48px]` 등)은 `className`으로 넘겨 유지한다.
- `HeaderActions`의 `kakaoCtaButtonClass`·`formCtaButtonClass`는 **이번 범위 밖**이다. 투명 헤더 위 특수 규칙이 얽혀 있어 따로 다룬다.

한 파일 고칠 때마다 그 파일의 테스트를 돌리고 넘어간다. 테스트가 클래스 문자열을 단언하고 있으면(예: `toMatch(/rounded-2xl/)`) **테스트를 정본 값으로 갱신**하고, 갱신 사실을 보고서에 남긴다.

- [ ] **Step 3: 전체 테스트**

Run: `npx jest components pages && npx tsc --noEmit && npx eslint components pages --ext .ts,.tsx`
Expected: PASS

- [ ] **Step 4: 렌더 결과 클래스 확인**

전환이 시각적으로 무엇을 바꿨는지 근거를 남긴다. 임시 스크립트로 각 CTA의 최종 className을 뽑아 보고서에 붙인다:

```bash
cat > /tmp/cta-classes.test.tsx <<'EOF'
import React from 'react';
import { render } from '@testing-library/react';
import BookingEntryButton from '../../components/booking/BookingEntryButton';
import InlineServiceCallout from '../../components/inline/InlineServiceCallout';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: {defaultValue?: string}) => o?.defaultValue || k }) }));
it('dump', () => {
  for (const el of [<BookingEntryButton service="recording" locale="ko" />, <InlineServiceCallout type="lesson" locale="ko" />]) {
    render(el).container.querySelectorAll('a,button').forEach((n) => console.log(n.textContent?.trim(), '|', n.className));
  }
});
EOF
```
이 파일은 저장소에 두지 말고(`/tmp`) 실행 후 지운다. 출력에서 확인할 것:
- 카카오 버튼에 `bg-kakao`와 `text-kakao-ink`가 **둘 다** 있는가 (흰 글씨가 섞이면 대비 1.3:1로 미달)
- 반경이 표의 지정대로인가 (`rounded-full` 또는 `rounded-xl`, 둘이 동시에 있으면 안 된다)
- `focus-visible:ring-2`가 있는가

확인 결과를 보고서에 적는다.

- [ ] **Step 5: 커밋**

```bash
git add -A components pages
git commit -m "refactor(ui): CTA 10종을 Button 프리미티브로 전환 — 반경 4갈래를 pill/block 2종으로 통일

목적지·추적 호출·ko 분기는 그대로 두고 시각 클래스만 바꾼다."
```

---

### Task 5: 공용 폼 프리미티브 `Field`

input 스타일이 최소 4벌(`rounded-md`/`lg`/`xl`)이고, 필수 항목 시각 표시가 어느 폼에도 없다. 하나로 모은다.

**Files:**
- Create: `components/ui/Field.tsx`
- Test: `components/ui/Field.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export const fieldControlClass: string;   // input/select/textarea 공용 클래스
  export interface FieldProps {
    id: string; label: string; required?: boolean; error?: string; hint?: string;
    className?: string; children: React.ReactElement;  // 컨트롤을 감싼다
  }
  export const Field: React.FC<FieldProps>;
  export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>;
  export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>;
  export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>;
  ```
  Task 6이 소비한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/ui/Field.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Field, TextInput, TextArea, fieldControlClass } from './Field';

describe('Field', () => {
  it('레이블을 컨트롤에 연결한다', () => {
    render(
      <Field id="name" label="이름">
        <TextInput id="name" />
      </Field>,
    );
    expect(screen.getByLabelText('이름')).toBeInTheDocument();
  });

  it('required면 시각적 * 표시와 aria-required를 함께 준다', () => {
    render(
      <Field id="email" label="이메일" required>
        <TextInput id="email" />
      </Field>,
    );
    const input = screen.getByLabelText(/이메일/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('error가 있으면 메시지를 보여주고 aria-invalid·aria-describedby를 연결한다', () => {
    render(
      <Field id="email" label="이메일" error="이메일 형식이 아닙니다">
        <TextInput id="email" />
      </Field>,
    );
    const input = screen.getByLabelText('이메일');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain('email-error');
    expect(screen.getByRole('alert')).toHaveTextContent('이메일 형식이 아닙니다');
  });

  it('hint가 있으면 aria-describedby에 함께 들어간다', () => {
    render(
      <Field id="phone" label="연락처" hint="숫자만 입력하세요">
        <TextInput id="phone" />
      </Field>,
    );
    const input = screen.getByLabelText('연락처');
    expect(input.getAttribute('aria-describedby')).toContain('phone-hint');
    expect(screen.getByText('숫자만 입력하세요')).toBeInTheDocument();
  });

  it('error와 hint가 함께 있으면 둘 다 describedby에 들어간다', () => {
    render(
      <Field id="phone" label="연락처" hint="숫자만" error="필수입니다">
        <TextInput id="phone" />
      </Field>,
    );
    const describedBy = screen.getByLabelText('연락처').getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('phone-hint');
    expect(describedBy).toContain('phone-error');
  });

  it('컨트롤 클래스가 정본 반경·포커스 규칙을 따른다', () => {
    expect(fieldControlClass).toMatch(/rounded-lg/);
    expect(fieldControlClass).toMatch(/focus-visible:ring-2/);
    expect(fieldControlClass).toMatch(/dark:/);
    expect(fieldControlClass).not.toMatch(/\bfocus:ring/); // focus-visible만 쓴다
  });

  it('TextArea도 같은 컨트롤 클래스를 쓴다', () => {
    render(<TextArea id="msg" aria-label="메시지" />);
    expect(screen.getByLabelText('메시지').className).toMatch(/rounded-lg/);
  });

  it('invalid면 컨트롤에 오류 테두리가 붙는다', () => {
    render(<TextInput id="x" aria-label="x" invalid />);
    expect(screen.getByLabelText('x').className).toMatch(/border-red-500/);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/ui/Field.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`components/ui/Field.tsx`:

```tsx
import React from 'react';
import { cn } from '../../lib/utils';

/**
 * 폼 컨트롤 공용 클래스. 반경·포커스·다크모드는 docs/design-system.md §3·§5가 정본이다.
 * 폼마다 input 클래스 문자열을 새로 만들지 않는다 — 2026-09-11 감사에서 최소 4벌
 * (rounded-md/lg/xl)이 흩어져 있었다.
 */
export const fieldControlClass = cn(
  'w-full rounded-lg border px-3 py-2 typo-body',
  'bg-white text-gray-900 placeholder:text-gray-400',
  'dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
  'border-gray-300 dark:border-gray-600',
  'transition-[colors,box-shadow] duration-fast ease-standard',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

const invalidClass = 'border-red-500 dark:border-red-500';

type ControlProps<T> = T & { invalid?: boolean };

export const TextInput = React.forwardRef<HTMLInputElement, ControlProps<React.InputHTMLAttributes<HTMLInputElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <input ref={ref} className={cn(fieldControlClass, invalid && invalidClass, className)} {...props} />
  ),
);
TextInput.displayName = 'TextInput';

export const TextArea = React.forwardRef<HTMLTextAreaElement, ControlProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldControlClass, 'min-h-[8rem]', invalid && invalidClass, className)} {...props} />
  ),
);
TextArea.displayName = 'TextArea';

export const Select = React.forwardRef<HTMLSelectElement, ControlProps<React.SelectHTMLAttributes<HTMLSelectElement>>>(
  ({ className, invalid, ...props }, ref) => (
    <select ref={ref} className={cn(fieldControlClass, invalid && invalidClass, className)} {...props} />
  ),
);
Select.displayName = 'Select';

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  /** 컨트롤 엘리먼트 하나. id는 Field의 id와 같아야 레이블이 연결된다. */
  children: React.ReactElement;
}

/**
 * 레이블·필수 표시·도움말·에러를 한 자리에서 배선한다. 컨트롤에는 aria-required·
 * aria-invalid·aria-describedby를 자동으로 붙인다.
 */
export const Field = ({ id, label, required, error, hint, className, children }: FieldProps) => {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    id,
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    invalid: Boolean(error) || undefined,
  });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="typo-card-meta font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">*</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="typo-caption text-gray-500 dark:text-gray-400">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="typo-caption text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
```

**주의**: `aria-required`는 boolean이 아니라 문자열 `"true"`로 직렬화돼야 테스트가 통과한다. React는 `aria-*`에 `true`를 주면 `"true"`로 렌더하므로 위 코드로 맞다. `invalid`를 cloneElement로 넘길 때 DOM에 새지 않는지(TextInput이 구조분해로 걷어냄) 확인하라.

- [ ] **Step 4: 통과 확인**

Run: `npx jest components/ui/Field.test.tsx && npx tsc --noEmit && npx eslint components/ui/Field.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/ui/Field.tsx components/ui/Field.test.tsx
git commit -m "feat(ui): 공용 폼 프리미티브 Field — 레이블·필수·에러·도움말·다크모드 배선"
```

---

### Task 6: 폼을 Field로 전환

**Files:**
- Modify: `components/contact/InputField.tsx`(Field 기반으로 재구현하거나 호출부를 Field로 교체), `components/contact/ContactFormCard.tsx`
- Modify: `components/booking/BookingWizard.tsx`, `components/booking/MixingOrderWizard.tsx` (`inputClass` 제거)
- Modify: `pages/[locale]/contracts/[id]/sign.tsx` (`rounded-xl` 컨트롤)
- Modify: `components/admin/ContractForm.tsx`, `pages/admin/login.tsx` (`INPUT_CLASS` 제거)
- Modify: 펀딩·구독 폼에 자체 input 클래스가 있으면 함께 (`components/funding/PledgeWizard.tsx` 등 — 구현 시 `grep -rn "rounded-md\|rounded-lg\|rounded-xl" components/funding "pages/[locale]/subscribe"`로 확인)
- Test: 기존 폼 테스트 전부 통과 유지

**Interfaces:**
- Consumes: Task 5의 `Field`·`TextInput`·`TextArea`·`Select`·`fieldControlClass`.

- [ ] **Step 1: 전환 전 테스트 통과 확인**

Run: `npx jest components/contact components/booking components/funding pages 2>&1 | tail -20`
현재 상태를 보고서에 기록. 실패가 있으면 BLOCKED로 보고한다.

- [ ] **Step 2: 자체 input 클래스 전수 파악**

```bash
grep -rn "rounded-md\|rounded-lg\|rounded-xl" components pages --include=*.tsx | grep -iE "input|textarea|select|INPUT_CLASS|inputClass" | tee /tmp/form-controls.txt
wc -l /tmp/form-controls.txt
```
목록을 보고서에 붙이고, 각 항목을 전환 대상/제외로 분류한다. **`pages/admin/**`도 전환 대상**이다(다크모드만 제외 대상이지 폼 통일은 해당된다).

- [ ] **Step 3: 한 폼씩 전환**

- `components/contact/InputField.tsx`는 삭제하지 말고 **내부를 `Field` + `TextInput`으로 갈아끼운다** — 호출부(`contact.tsx`)의 props 계약을 유지해 변경 범위를 좁힌다. 아이콘 슬롯(`pl-10` + 왼쪽 아이콘)이 있으므로 `TextInput`에 `className="pl-10"`을 넘기고 아이콘은 기존대로 절대 위치로 얹는다.
- 위저드·계약·관리자 폼은 `inputClass`/`INPUT_CLASS` 상수를 지우고 `fieldControlClass` 또는 `TextInput`/`Select`/`TextArea`로 바꾼다. 레이블이 이미 있으면 `Field`로 감싸고, 없으면 최소한 컨트롤만 교체한다.
- 필수 항목에는 `required`를 넘겨 `*`가 뜨게 한다. 기존에 `aria-required`만 있던 곳은 이제 시각 표시도 함께 생긴다.

한 파일마다 해당 테스트를 돌리고 넘어간다.

- [ ] **Step 4: 전체 확인**

Run: `npx jest && npx tsc --noEmit && npx eslint components pages --ext .ts,.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add -A components pages
git commit -m "refactor(form): 흩어진 input 클래스 4벌을 Field 프리미티브로 통일 — 반경·포커스·필수 표시"
```

---

### Task 7: Section spacing variant

**Files:**
- Modify: `components/ui/Section.tsx`
- Modify: `Section`에 py override를 넘기던 소비처(구현 시 `grep -rn "<Section" pages components --include=*.tsx | grep -E "py-[0-9]"`로 전수 확보)
- Test: `components/ui/Section.test.tsx` (신규)

**Interfaces:**
- Produces: `<Section spacing="default|tight|loose">`.

- [ ] **Step 1: 실패하는 테스트**

`components/ui/Section.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { Section } from './Section';

const classOf = (ui: React.ReactElement) =>
  (render(ui).container.firstElementChild as HTMLElement).className;

describe('Section spacing', () => {
  it('기본은 py-16 md:py-24', () => {
    const cls = classOf(<Section>x</Section>);
    expect(cls).toMatch(/py-16/);
    expect(cls).toMatch(/md:py-24/);
  });

  it('tight는 py-10 md:py-12', () => {
    const cls = classOf(<Section spacing="tight">x</Section>);
    expect(cls).toMatch(/py-10/);
    expect(cls).toMatch(/md:py-12/);
    expect(cls).not.toMatch(/py-16/);
  });

  it('loose는 py-20 md:py-32', () => {
    const cls = classOf(<Section spacing="loose">x</Section>);
    expect(cls).toMatch(/py-20/);
    expect(cls).toMatch(/md:py-32/);
  });

  it('container=false면 컨테이너 div를 만들지 않는다', () => {
    const { container } = render(<Section container={false}><span data-testid="c" /></Section>);
    expect(container.querySelector('.container')).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/ui/Section.test.tsx`
Expected: FAIL — `spacing` prop 없음

- [ ] **Step 3: 구현**

`Section.tsx`에 spacing variant를 추가한다. 기존 `py-16 md:py-24` 하드코딩을 맵으로 바꾼다:

```tsx
export type SectionSpacing = 'default' | 'tight' | 'loose';

const SPACING: Record<SectionSpacing, string> = {
  default: 'py-16 md:py-24',
  tight: 'py-10 md:py-12',
  loose: 'py-20 md:py-32',
};
```
`SectionProps`에 `spacing?: SectionSpacing`을 추가하고 `cn(SPACING[spacing], bgClass, className)` 순서로 합성한다(className이 뒤라 호출부 override는 계속 가능).

- [ ] **Step 4: 소비처 정리**

Step 0에서 뽑은 목록의 py override를 spacing variant로 바꾼다:
- `py-10`·`py-12` → `spacing="tight"`
- `py-24`·`py-20` 계열 → `spacing="loose"`
- `py-16 md:py-24`를 그대로 다시 쓴 곳 → override 삭제
- `pt-*`/`pb-*`만 조정하는 곳(한쪽 여백)은 그대로 둔다 — spacing이 대체하지 못한다.

- [ ] **Step 5: 확인·커밋**

Run: `npx jest components/ui/Section.test.tsx && npx tsc --noEmit && npx jest`
```bash
git add -A components pages
git commit -m "refactor(layout): Section에 spacing variant 도입 — py override 6종을 3종으로"
```

---

### Task 8: 색 정리 — 경고색 amber 통일, 별점, 히어로 오버레이 토큰화

**Files:**
- Modify: `components/contracts/AuditTrail.tsx`, `components/contact/ContactFormErrorFallback.tsx`, 그 밖에 `yellow-*`를 쓰는 전 파일(구현 시 `grep -rn "yellow-" components pages --include=*.tsx`로 전수)
- Modify: `components/ui/ReviewSection.tsx`, `components/release/ReleaseReviewsSection.tsx` (별점)
- Modify: `tailwind.config.ts` 또는 `styles/globals.css` (히어로 오버레이 토큰)
- Modify: `pages/[locale]/index.tsx`, `pages/[locale]/release-project/index.tsx`, `components/release/TierPage.tsx`, `components/guides/BuyerIntentHubPage.tsx` (오버레이 소비처)
- Modify: `rose-*` 사용처 → `red-*`
- Test: `tailwind.config.test.ts`에 "카카오 아닌 옐로 금지" 가드 추가

**Interfaces:**
- Produces: 없음(스타일·토큰만). 가드 테스트 1건 추가.

- [ ] **Step 1: 가드 테스트 추가(실패 상태로)**

`tailwind.config.test.ts`에 추가:

```ts
// "노란 건 카카오톡"이라는 학습이 성립하려면 카카오 토큰 밖의 옐로가 없어야 한다.
// 경고·주의는 amber, 별점도 amber를 쓴다(docs/design-system.md §1).
describe('옐로 사용 제한', () => {
  it('kakao 토큰 밖에서 yellow-* 유틸리티를 쓰지 않는다', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      let files: string[] = [];
      try {
        files = walk(path.join(ROOT, dir));
      } catch {
        continue;
      }
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        for (const match of content.matchAll(/\b(?:bg|text|border|ring|from|to|via|fill|stroke)-yellow-\d+\b/g)) {
          offenders.push(`${path.relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        'yellow-*는 카카오 옐로와 충돌합니다. 경고·주의·별점은 amber-*를 쓰세요:\n' +
          offenders.join('\n'),
      );
    }
  });
});
```

Run: `npx jest tailwind.config.test.ts` → FAIL(위반 목록이 나온다). 목록을 보고서에 기록.

- [ ] **Step 2: yellow → amber 치환**

Step 1이 뱉은 목록의 각 항목을 같은 명도의 amber로 바꾼다(`yellow-50`→`amber-50`, `yellow-400`→`amber-400`, …). **`bg-kakao`·`text-kakao-ink`·`bg-kakao-dark`는 건드리지 않는다.**

- [ ] **Step 3: rose → red**

```bash
grep -rn "rose-" components pages --include=*.tsx
```
나오는 항목을 같은 명도의 `red-*`로 바꾼다.

- [ ] **Step 4: 히어로 오버레이 토큰화**

`[#a8c0ff]` + `rgba(255,255,255,0.3)` 조합이 4개 파일에 복붙돼 있다. `styles/globals.css`에 CSS 변수를 두고 4곳이 그걸 참조하게 한다:

```css
:root {
  /* 히어로 제목 그라디언트 — index·release-project·TierPage·BuyerIntentHubPage 공용 */
  --hero-title-accent: #a8c0ff;
  --hero-title-glow: rgb(255 255 255 / 0.3);
}
```
소비처는 `via-[var(--hero-title-accent)]`, `drop-shadow-[0_0_25px_var(--hero-title-glow)]` 형태로 바꾼다. **바꾼 뒤 실제로 같은 색이 나오는지 dev 서버나 빌드 CSS로 확인**하고 결과를 보고서에 적는다(Tailwind arbitrary value 안의 CSS 변수는 따옴표·공백에 민감하다).

- [ ] **Step 5: 확인·커밋**

Run: `npx jest && npx tsc --noEmit && npx eslint components pages --ext .ts,.tsx`
```bash
git add -A
git commit -m "fix(design): 경고색을 amber로 통일하고 별점 옐로 제거 — 카카오 옐로 신호 보호

rose→red 정리와 히어로 오버레이 색 토큰화를 함께. yellow-* 금지를 가드 테스트로 고정."
```

---

### Task 9: 타이포 역할 클래스 치환

**Files:**
- Modify: 카드·섹션 소제목을 `text-lg font-bold`/`font-semibold`로 만든 곳 → `typo-card-title` 또는 `typo-card-subtitle` (구현 시 `grep -rn "text-lg font-\(bold\|semibold\)" components pages --include=*.tsx`로 전수)
- Modify: 트랜잭션·결과 페이지 h1 → `typo-page-title` (`pages/[locale]/booking/**`, `pages/[locale]/funding/**`, `pages/[locale]/subscribe/**`, `pages/[locale]/contracts/**`). **`pages/admin/**`은 제외**(정본 §9)
- Test: 기존 테스트 통과 유지

**Interfaces:**
- Consumes: Task 1의 `typo-page-title`.

- [ ] **Step 1: 전수 목록 확보**

```bash
grep -rn "text-lg font-bold\|text-lg font-semibold" components pages --include=*.tsx | tee /tmp/subtitles.txt
grep -rn "<h1" "pages/[locale]/booking" "pages/[locale]/funding" "pages/[locale]/subscribe" "pages/[locale]/contracts" 2>/dev/null | tee /tmp/h1.txt
wc -l /tmp/subtitles.txt /tmp/h1.txt
```
두 목록을 보고서에 붙인다.

- [ ] **Step 2: 소제목 치환**

각 항목이 카드/섹션 제목 역할이면 `typo-card-title`(1.5rem) 또는 `typo-card-subtitle`(1.125rem)로 바꾼다. **크기가 눈에 띄게 달라지는 경우** — `text-lg`(1.125rem)를 `typo-card-title`(1.5rem)로 올리는 것 — 은 하지 말고 `typo-card-subtitle`(1.125rem, 같은 크기)로 바꾼다. 즉 **크기는 보존하고 자간·색·굵기만 시스템에 맞춘다.** 제목이 아닌 강조 텍스트(예: 가격 숫자)는 건드리지 않는다.

- [ ] **Step 3: 트랜잭션 h1 치환**

`text-2xl font-bold` 계열 h1을 `typo-page-title`로 바꾼다. `text-xl`(1.25rem)이나 `text-3xl`(1.875rem)로 되어 있던 것도 `typo-page-title`(1.5rem)로 통일한다 — 이 통일이 이 태스크의 목적이다. 색 클래스(`text-gray-900 dark:text-white`)는 클래스가 이미 포함하므로 제거한다.

- [ ] **Step 4: 배지 반경 통일**

카테고리 배지 3종의 **색 체계는 맥락이 달라 그대로 두고, 반경만** `rounded-full`로 맞춘다(정본 §4):
- `components/ui/ProjectRowCard.tsx:97` — `rounded` → `rounded-full`
- `components/ui/PortfolioMiniCard.tsx`의 배지 — `rounded` 계열이면 `rounded-full`
- `components/StoryCard.tsx:80` — 이미 `rounded-full`이면 그대로

- [ ] **Step 5: 확인**

Run: `npx jest && npx tsc --noEmit && npx eslint components pages --ext .ts,.tsx`
Expected: PASS. 스냅샷 테스트가 있으면 변경 내용을 눈으로 확인한 뒤 갱신한다.

- [ ] **Step 6: 커밋**

```bash
git add -A components pages
git commit -m "refactor(design): 카드 소제목·트랜잭션 h1을 typo 역할 클래스로 치환, 배지 반경 통일"
```

---

### Task 10: 전체 검증

- [ ] **Step 1: 전체 검증**

```bash
npm run type-check && npm run lint && npm test && npm run build
```
Expected: 전부 통과. 실패하면 고치지 말고 출력 마지막 40줄과 함께 BLOCKED로 보고한다.

- [ ] **Step 2: 빌드 CSS에 역할 클래스가 실재하는지**

```bash
grep -o "typo-page-title\|typo-button\|typo-caption\|typo-body" .next/static/css/*.css | sort | uniq -c
```
Expected: 네 클래스 모두 1회 이상.

- [ ] **Step 3: 빌드 산출물 정리**

```bash
git status --short
```
`utils/imageMetadata.json`·`lib/fonts/pretendard-variable.woff2` 등 빌드가 건드린 추적 파일이 있으면 `git checkout --`로 되돌리고 **커밋하지 않는다.** 되돌린 파일 목록을 보고한다.

- [ ] **Step 4: 시각 회귀 확인**

로컬 dev 서버로 `/ko`, `/ko/pricing`, `/ko/contact`, `/ko/practice-room`, `/ko/stories/<슬러그>`를 라이트·다크 양쪽으로 열어 확인한다:
- 카카오 버튼이 노란 배경 + 검은 글씨인가
- 404/500 버튼과 연습실 캡션에 타이포가 적용됐는가(Task 1 결함 수정 결과)
- 경고 배지가 amber로 통일됐는가
- 폼 컨트롤 반경·포커스 링이 같은가

확인 결과를 보고서에 적는다. dev 서버를 띄울 수 없으면 그 사실을 보고한다.

---

## 범위 밖

- `pages/admin/**`의 다크모드 지원과 h1 통일 (백오피스, 정본 §9)
- `HeaderActions`의 투명 헤더 CTA 클래스 (특수 규칙이 얽혀 별도 작업)
- 스토리 본문(MarkdownRenderer) 제목 스케일 통일 (정본 §9 — 의도 확인 먼저)
- `body-1` weight 300과 실사용 불일치 (정본 §9 — 스케일을 바꿀지 사용처를 바꿀지 미결)
- 카테고리 배지 **색** 체계 통일 (맥락이 달라 색은 유지 — 반경만 Task 9에서 맞춘다)
- 그리드 브레이크포인트 전수 통일 (카드 너비가 페이지마다 달라 일괄 변경이 위험)
- 히어로 `minHeight`의 `vh`/`svh` 혼용 정리 (정본 §3에 규칙만 적어 두고, 기존 값은 건드리지 않는다)
- 공개 컴포넌트 38곳의 `dark:` 짝 누락 의심 (푸터·내비 등 대부분 고정 배경 위라 정상일 가능성이 높아 개별 확인이 먼저다)
