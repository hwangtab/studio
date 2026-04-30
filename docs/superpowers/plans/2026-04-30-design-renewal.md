# Studio NOL Editorial Cinematic 디자인 전면 리뉴얼 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studio NOL 사이트(13개 페이지 + 30+ 컴포넌트)의 비주얼 톤을 [DESIGN.md](../../../DESIGN.md)의 Editorial Cinematic 시스템으로 전면 교체한다. 보라/핑크/에메랄드 단색 액센트 → atmospheric gradient orb + ink pill CTA + 따뜻한 종이톤 캔버스.

**Architecture:** 위→아래 의존성 순서로 진행. (1) Tailwind 토큰 추가 → (2) globals.css 베이스 재정의 → (3) 공용 primitive(Button/Card/Section/SectionHeading/GradientOrb) 재작성 → (4) 레이아웃 셸(Header/Footer/Layout) → (5) 시그니처 페이지(Home/About/Studio-Info) → (6) 콘텐츠 페이지(Stories/Portfolio/Lesson/Voice/Wedding/Practice) → (7) 폼·기타(Contact/Pricing/Privacy/404/500) → (8) 도메인 컴포넌트 정리 → (9) 옛 토큰 제거 → (10) 최종 검증. 각 phase가 독립적으로 빌드/배포 가능해야 한다 (점진 머지 가능).

**Tech Stack:** Next.js 15.5.12 (Pages Router), React 19.2.4, Tailwind CSS 3.4.7, Framer Motion 12, class-variance-authority, tailwind-merge, Jest, react-i18next (7개 언어).

**작업 시작 전 합의사항:**
- 작업은 워크트리 `~/.config/superpowers/worktrees/studio-nori/editorial-renewal` (브랜치 `design/editorial-renewal`)에서 진행. 머지는 phase 단위로 main에 PR.
- 각 phase 끝마다 `npm run type-check && npm run lint && npm run build && npm test` 통과 + dev server 시각 확인.
- 옛 보라/핑크/에메랄드 토큰은 Phase 9까지 코드에 남겨둠 (alias 형태). Phase 9에서 일괄 제거.
- 7개 locale (ko/en/zh/es/vi/th/uz) 모두 시각 확인 — 각 phase 검증 step에 명시.

---

## File Structure (변경 영향 맵)

### 신규 생성
- `components/ui/GradientOrb.tsx` — atmospheric gradient orb primitive
- `components/ui/Hero.tsx` — Dark Cinematic + Light Editorial 두 variant
- `lib/designTokens.ts` — DESIGN.md 토큰의 TypeScript 상수 (선택)

### 토큰/스타일 (기반)
- `tailwind.config.ts` — 새 색·radius·shadow·typography utilities 추가
- `styles/globals.css` — base layer h1~h6 / body 재정의, CSS 변수
- `pages/_app.tsx` — Noto Sans KR weight 300 추가

### Primitive (재작성)
- `components/ui/Button.tsx`
- `components/ui/BaseCard.tsx`
- `components/ui/FeatureCard.tsx`
- `components/ui/PricingCard.tsx`
- `components/ui/ProjectRowCard.tsx`
- `components/ui/Section.tsx`
- `components/ui/SectionHeading.tsx`
- `components/ui/Breadcrumb.tsx`
- `components/ui/Pagination.tsx`
- `components/ui/LoadingSpinner.tsx`
- `components/ui/ScrollToTop.tsx`
- `components/ui/MediaGallery.tsx`
- `components/ui/QuickAnswers.tsx`
- `components/ui/ReviewSection.tsx`
- `components/ui/FAQSection.tsx`

### 레이아웃 셸
- `components/Layout.tsx`
- `components/layout/Header.tsx`
- `components/layout/HeaderBrand.tsx`
- `components/layout/HeaderActions.tsx`
- `components/layout/DesktopNav.tsx`
- `components/layout/MobileNav.tsx`
- `components/layout/DropdownMenu.tsx`
- `components/layout/Footer.tsx`
- `components/LanguageSwitcher.tsx`
- `components/common/ImageHero.tsx`
- `components/common/ContactCTA.tsx`
- `components/common/ScrollProgress.tsx`

### 페이지
- `pages/[locale]/index.tsx` (홈)
- `pages/[locale]/about.tsx`
- `pages/[locale]/studio-info.tsx`
- `pages/[locale]/stories/index.tsx`
- `pages/[locale]/stories/[id].tsx`
- `pages/[locale]/stories/category/*.tsx`
- `pages/[locale]/portfolio.tsx`
- `pages/[locale]/portfolio/[id].tsx`
- `pages/[locale]/lesson.tsx`
- `pages/[locale]/voice-acting.tsx`
- `pages/[locale]/wedding-song.tsx`
- `pages/[locale]/practice-room.tsx`
- `pages/[locale]/contact.tsx`
- `pages/[locale]/pricing.tsx`
- `pages/[locale]/privacy-policy.tsx`
- `pages/404.tsx`
- `pages/500.tsx`

### 도메인 컴포넌트
- `components/StoryCard.tsx`
- `components/StoryCTA.tsx`
- `components/MarkdownRenderer.tsx` (스토리 prose)
- `components/CategoryFilter.tsx`
- `components/PortfolioDetailModal.tsx`
- `components/portfolio/PortfolioDetailBody.tsx`
- `components/portfolio/PortfolioDetailSummary.tsx`
- `components/story/SessionChecklist.tsx`
- `components/story/OnlineFallback.tsx`
- `components/studio/EquipmentSection.tsx`
- `components/AudioPlayer/*` (테마 정합만 검토)
- `components/SEO.tsx` (theme-color meta 갱신)

### 검증/스냅샷
- `components/__snapshots__/SEO.test.tsx.snap` 갱신

---

## 패턴 정의 (반복 사용)

페이지/컴포넌트 마이그레이션은 아래 4가지 매핑을 반복한다.

### 매핑표 — Tailwind 클래스 치환

| 옛 클래스 | 새 클래스 | 비고 |
|---|---|---|
| `bg-primary` `text-primary` `border-primary` | (제거) | atmospheric orb 또는 ink로 대체 |
| `bg-secondary` `text-secondary` | (제거) | orb-rose / orb-peach 또는 ink로 대체 |
| `bg-accent` `text-accent` | (제거) | orb-mint 또는 ink로 대체 |
| `bg-white` `bg-gray-50` | `bg-canvas` | 페이지 배경 |
| `bg-gray-100` | `bg-canvas-warm` | alternation 섹션 |
| `bg-gray-900` `bg-black` | `bg-canvas-deep` | 다크 시네마틱 |
| `text-gray-900` `text-black` | `text-ink` | 본문 |
| `text-gray-700` `text-gray-800` | `text-ink-muted-80` | 보조 본문 |
| `text-gray-500` `text-gray-600` | `text-ink-muted-60` | tertiary |
| `text-gray-400` | `text-ink-muted-40` | placeholder |
| `border` `border-gray-200` `border-gray-300` | `border-hairline` | whisper border |
| `shadow-md` `shadow-lg` `shadow-xl` | `shadow-card` (또는 `shadow-deep`) | 다층 누적 |
| `rounded-xl` (버튼) | `rounded-pill` | pill CTA |
| `font-bold` (헤딩) | `font-light` | Display weight 300 시그니처 |

### 매핑표 — Variant prop 치환 (Button 등)

| 옛 variant | 새 variant | 효과 |
|---|---|---|
| `variant="solid"` | `variant="primary"` | ink pill |
| `variant="outline"` | `variant="outline"` | transparent + hairline pill |
| `variant="secondary"` | `variant="onDark"` | 다크 위 흰 pill |
| `variant="ghost"` | `variant="text"` | 호버 underline |

### 매핑표 — i18n / locale별 작업

각 페이지 마이그레이션 검증 step에서 `ko · en · zh · es · vi · th · uz` 순으로 dev server에서 헤더/히어로/CTA 1회씩 시각 확인. 한국어 본문에 letter-spacing 음수가 들어가지 않는지 확인.

---

## Task 0: 베이스라인 검증 + 디자인 산출물 커밋

> 워크트리는 이미 `~/.config/superpowers/worktrees/studio-nori/editorial-renewal` (브랜치 `design/editorial-renewal`)에 셋업되어 있음. npm install 완료 + 베이스라인 type-check/test 통과 확인됨.

**Files:**
- New (untracked): `DESIGN.md`, `docs/superpowers/plans/2026-04-30-design-renewal.md`

- [ ] **Step 1: 워크트리 상태 확인**

```bash
cd /Users/hwang-gyeongha/.config/superpowers/worktrees/studio-nori/editorial-renewal
git status --short
git branch --show-current
```

Expected: `design/editorial-renewal` 브랜치, untracked로 `DESIGN.md` + `docs/superpowers/`만 보여야 함.

- [ ] **Step 2: 베이스라인 풀 검증**

```bash
npm run type-check && npm run lint && npm test
```

Expected: 모두 PASS. 실패하면 디자인 작업 시작 전에 fix.

- [ ] **Step 3: 디자인 산출물 커밋**

```bash
git add DESIGN.md docs/superpowers/plans/2026-04-30-design-renewal.md
git commit -m "docs(design): add Editorial Cinematic DESIGN.md + renewal plan"
```

- [ ] **Step 4: 베이스라인 시각 스냅샷 (회귀 비교용)**

```bash
npm run dev &
sleep 8
mkdir -p /tmp/studio-baseline
for path in / /ko /ko/about /ko/contact /ko/stories /ko/portfolio /ko/pricing; do
  curl -s "http://localhost:3000$path" > "/tmp/studio-baseline$(echo $path | tr '/' '_').html"
done
kill %1 2>/dev/null
ls /tmp/studio-baseline | wc -l
```

Expected: 7. 나중에 마이그레이션 후 diff로 회귀 확인용.

---

## Task 1: Tailwind 토큰 추가 (비파괴)

**Files:**
- Modify: `tailwind.config.ts` (extend.colors / extend.boxShadow / extend.borderRadius / extend.fontSize 추가)

- [ ] **Step 1: 새 컬러 토큰 추가**

`tailwind.config.ts`의 `theme.extend.colors` 객체 안에 기존 primary/secondary/accent/gray 옆에 추가:

```ts
// Editorial Cinematic 시스템 (DESIGN.md §2). 옛 primary/secondary/accent는 Phase 9에서 제거.
canvas: {
  DEFAULT: '#faf9f7',
  soft: '#ffffff',
  warm: '#f3f1ec',
  deep: '#0c0a09',
},
ink: {
  DEFAULT: '#1d1b1a',
  'muted-80': '#3a3633',
  'muted-60': '#615d59',
  'muted-40': '#a39e98',
},
'on-dark': {
  DEFAULT: '#ffffff',
  soft: '#a8a29e',
},
'surface-dark-elevated': '#1c1917',
hairline: 'rgba(0,0,0,0.08)',
'hairline-strong': 'rgba(0,0,0,0.14)',
orb: {
  mint: '#a7e5d3',
  peach: '#f4c5a8',
  lavender: '#c8b8e0',
  sky: '#a8c8e8',
  rose: '#e8b8c4',
},
link: {
  DEFAULT: '#0a66c2',
  'on-dark': '#62aef0',
  focus: '#097fe8',
},
badge: {
  bg: '#f2f9ff',
  text: '#097fe8',
},
```

- [ ] **Step 2: borderRadius / boxShadow 토큰 추가**

`theme.extend` 안에 추가:

```ts
borderRadius: {
  pill: '9999px',
  whisper: '4px',
  card: '12px',
  hero: '16px',
  orb: '24px',
},
boxShadow: {
  card: '0 4px 18px rgba(0,0,0,0.04), 0 2px 7.85px rgba(0,0,0,0.027), 0 0.8px 2.93px rgba(0,0,0,0.02), 0 0.175px 1.04px rgba(0,0,0,0.01)',
  deep: '0 1px 3px rgba(0,0,0,0.01), 0 3px 7px rgba(0,0,0,0.02), 0 7px 15px rgba(0,0,0,0.02), 0 14px 28px rgba(0,0,0,0.04), 0 23px 52px rgba(0,0,0,0.05)',
  'card-hover': '0 8px 28px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04), 0 1.5px 5px rgba(0,0,0,0.03)',
},
```

- [ ] **Step 3: Display 타이포 토큰 추가 (옛 display-1/heading-1과 공존)**

`theme.extend.fontSize`에 추가:

```ts
'display-mega': ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '300' }],
'display-xl':   ['clamp(2rem, 4.5vw, 3rem)',  { lineHeight: '1.08', letterSpacing: '-0.015em', fontWeight: '300' }],
'display-lg':   ['clamp(1.75rem, 3.5vw, 2.25rem)', { lineHeight: '1.17', letterSpacing: '-0.01em', fontWeight: '300' }],
'display-md':   ['1.75rem', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
'lead':         ['clamp(1.125rem, 1.6vw, 1.375rem)', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '400' }],
'title-md':     ['1.25rem', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '500' }],
'title-sm':     ['1.125rem', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '500' }],
'caption-upper': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.08em', fontWeight: '600' }],
```

- [ ] **Step 4: tailwind 컴파일 확인**

```bash
npm run build 2>&1 | tail -30
```

Expected: 빌드 PASS. 새 클래스가 사용처가 없어서 CSS에 안 들어가는 것은 정상.

- [ ] **Step 5: type-check + lint + 커밋**

```bash
npm run type-check && npm run lint
git add tailwind.config.ts
git commit -m "feat(design): add Editorial Cinematic tokens to tailwind config"
```

---

## Task 2: globals.css 베이스 재정의 + Noto Sans KR weight 300 추가

**Files:**
- Modify: `styles/globals.css`
- Modify: `pages/_app.tsx`

- [ ] **Step 1: Noto Sans KR weight 배열에 300 추가**

`pages/_app.tsx`에서 `Noto_Sans_KR(...)` 호출의 `weight` 배열을 확인. 현재 `['400','700','900']`이라면 `['300','400','500','700']`로 교체.

```bash
grep -n 'Noto_Sans_KR\|weight:' pages/_app.tsx
```

위 결과를 보고 정확한 라인을 Edit. 예시 변경:

```ts
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});
```

- [ ] **Step 2: globals.css base layer 재작성**

`styles/globals.css`의 `@layer base` 블록을 다음으로 교체:

```css
@layer base {
  :root {
    /* Editorial Cinematic 토큰 (DESIGN.md). 옛 --primary-rgb는 Phase 9에서 제거. */
    --primary-rgb: 109, 40, 217; /* DEPRECATED — keep for backwards compat */
    --orb-mint: #a7e5d3;
    --orb-peach: #f4c5a8;
    --orb-lavender: #c8b8e0;
    --orb-sky: #a8c8e8;
    --orb-rose: #e8b8c4;
    color-scheme: light dark;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    @apply font-sans text-ink bg-canvas dark:text-on-dark dark:bg-canvas-deep;
    word-break: keep-all;
    line-height: 1.6;
  }

  a, button, [role='button'], input, select, textarea {
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(9, 127, 232, 0.18);
  }

  /* Display 시그니처: weight 300 (Montserrat) + 한글에는 letter-spacing 0 (영문 자동 적용) */
  h1, h2, h3, h4, h5, h6 {
    @apply font-display font-light text-ink dark:text-on-dark;
    text-wrap: balance;
  }

  :lang(ko) h1, :lang(ko) h2, :lang(ko) h3,
  :lang(zh) h1, :lang(zh) h2, :lang(zh) h3,
  :lang(th) h1, :lang(th) h2, :lang(th) h3 {
    letter-spacing: 0;
  }

  :lang(en) h1, :lang(en) h2, :lang(es) h1, :lang(es) h2,
  :lang(vi) h1, :lang(vi) h2, :lang(uz) h1, :lang(uz) h2 {
    letter-spacing: -0.015em;
  }

  p {
    text-wrap: balance;
  }

  h1 { @apply text-display-xl; }
  h2 { @apply text-display-lg; }
  h3 { @apply text-display-md; }
}
```

- [ ] **Step 3: build + dev server 시각 확인**

```bash
npm run type-check
npm run dev
```

브라우저로 `http://localhost:3000/ko` 열어 확인:
- 본문 배경이 흰색이 아니라 따뜻한 베이지(#faf9f7)인가
- 헤딩이 두꺼운(700) bold가 아니라 가벼운(300) light로 보이는가
- 한국어 본문 자간이 좁아지지 않았는가
- 다크 모드 토글 시 #0c0a09로 전환되는가

Ctrl+C로 dev 종료.

- [ ] **Step 4: 커밋**

```bash
git add styles/globals.css pages/_app.tsx
git commit -m "feat(design): apply Editorial base tokens to globals.css + load Noto Sans KR 300"
```

---

## Task 3: GradientOrb primitive 신규

**Files:**
- Create: `components/ui/GradientOrb.tsx`
- Create: `components/ui/__tests__/GradientOrb.test.tsx`

- [ ] **Step 1: 실패 테스트 작성**

`components/ui/__tests__/GradientOrb.test.tsx` 신규:

```tsx
import { render } from '@testing-library/react';
import GradientOrb from '../GradientOrb';

describe('GradientOrb', () => {
  it('지정한 color prop의 hex가 inline style background에 들어간다', () => {
    const { container } = render(<GradientOrb color="mint" size={400} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.background).toContain('#a7e5d3');
  });

  it('default opacity는 0.4, blur는 120px이다', () => {
    const { container } = render(<GradientOrb color="peach" size={300} />);
    const div = container.firstChild as HTMLElement;
    expect(div.style.opacity).toBe('0.4');
    expect(div.style.filter).toContain('blur(120px)');
  });

  it('aria-hidden=true', () => {
    const { container } = render(<GradientOrb color="lavender" size={200} />);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- components/ui/__tests__/GradientOrb.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: 최소 구현**

`components/ui/GradientOrb.tsx` 신규:

```tsx
import React from 'react';

const ORB_HEX = {
  mint: '#a7e5d3',
  peach: '#f4c5a8',
  lavender: '#c8b8e0',
  sky: '#a8c8e8',
  rose: '#e8b8c4',
} as const;

export type OrbColor = keyof typeof ORB_HEX;

interface GradientOrbProps {
  color: OrbColor;
  size: number;
  opacity?: number;
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
}

const GradientOrb: React.FC<GradientOrbProps> = ({
  color,
  size,
  opacity = 0.4,
  blur = 120,
  className,
  style,
}) => {
  const hex = ORB_HEX[color];
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${hex} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
};

export default GradientOrb;
```

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
npm test -- components/ui/__tests__/GradientOrb.test.tsx
git add components/ui/GradientOrb.tsx components/ui/__tests__/GradientOrb.test.tsx
git commit -m "feat(ui): add GradientOrb atmospheric primitive"
```

Expected: PASS.

---

## Task 4: Button 재작성 (Pill, ink primary, on-dark variant)

**Files:**
- Modify: `components/ui/Button.tsx`
- Create: `components/ui/__tests__/Button.test.tsx`

- [ ] **Step 1: 테스트 작성**

`components/ui/__tests__/Button.test.tsx` 신규:

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('default variant primary는 ink 배경 + pill', () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn.className).toMatch(/bg-ink/);
    expect(btn.className).toMatch(/rounded-pill/);
  });

  it('outline variant는 transparent + hairline border', () => {
    render(<Button variant="outline">A</Button>);
    const btn = screen.getByRole('button', { name: 'A' });
    expect(btn.className).toMatch(/bg-transparent/);
    expect(btn.className).toMatch(/border-hairline/);
  });

  it('onDark variant는 흰 배경 + ink text', () => {
    render(<Button variant="onDark">D</Button>);
    const btn = screen.getByRole('button', { name: 'D' });
    expect(btn.className).toMatch(/bg-white/);
    expect(btn.className).toMatch(/text-ink/);
  });

  it('text variant는 hover underline', () => {
    render(<Button variant="text">T</Button>);
    const btn = screen.getByRole('button', { name: 'T' });
    expect(btn.className).toMatch(/hover:underline/);
  });

  it('disabled 적용 가능', () => {
    render(<Button disabled>X</Button>);
    expect(screen.getByRole('button', { name: 'X' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- components/ui/__tests__/Button.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Button.tsx 재작성**

`components/ui/Button.tsx` 전체를 다음으로 교체:

```tsx
import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// Editorial Cinematic CTA (DESIGN.md §4). 모든 variant는 pill, height 40-44px (Apple HIG 터치).
const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium rounded-pill transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'bg-ink text-white hover:bg-canvas-deep dark:bg-white dark:text-ink dark:hover:bg-on-dark-soft',
        outline:
          'bg-transparent text-ink border border-hairline-strong hover:bg-ink/[0.04] dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]',
        onDark:
          'bg-white text-ink hover:bg-on-dark-soft',
        text:
          'bg-transparent text-ink hover:underline underline-offset-4 dark:text-on-dark',
      },
      size: {
        sm: 'h-10 px-4 text-[14px]',
        md: 'h-11 px-5 text-[15px]',
        lg: 'h-14 px-7 text-[17px]',
        icon: 'h-11 w-11 p-0',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      {...props}
    />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 4: 테스트 PASS 확인**

```bash
npm test -- components/ui/__tests__/Button.test.tsx
```

- [ ] **Step 5: 옛 variant 사용처 grep — 일괄 치환 대상 파악**

```bash
grep -rn 'variant="solid"\|variant="secondary"\|variant="ghost"' components pages 2>/dev/null
```

이후 Phase 5~7 페이지 마이그레이션 시 한 번에 치환. 지금은 grep 결과를 메모만.

- [ ] **Step 6: 커밋**

```bash
git add components/ui/Button.tsx components/ui/__tests__/Button.test.tsx
git commit -m "feat(ui): rewrite Button as Pill (ink primary / outline / onDark / text)"
```

---

## Task 5: BaseCard / Section / SectionHeading 재작성

**Files:**
- Modify: `components/ui/BaseCard.tsx`
- Modify: `components/ui/Section.tsx`
- Modify: `components/ui/SectionHeading.tsx`

- [ ] **Step 1: BaseCard.tsx 재작성**

먼저 현재 내용 확인:

```bash
cat components/ui/BaseCard.tsx
```

그 다음 다음 내용으로 교체:

```tsx
import React from 'react';
import { cn } from '../../lib/utils';

interface BaseCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'featured' | 'orb';
  hover?: boolean;
  as?: 'div' | 'article' | 'section';
}

// DESIGN.md §4 Cards: whisper border + shadow-card + 12/16/24 radius
const BaseCard = React.forwardRef<HTMLDivElement, BaseCardProps>(
  ({ className, variant = 'default', hover = false, as: Tag = 'div', ...props }, ref) => {
    const radius = variant === 'orb' ? 'rounded-orb' : variant === 'featured' ? 'rounded-hero' : 'rounded-card';
    const padding = variant === 'orb' ? 'p-8' : variant === 'featured' ? 'p-8' : 'p-6';
    return (
      <Tag
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          'bg-canvas-soft border border-hairline shadow-card',
          radius,
          padding,
          'dark:bg-surface-dark-elevated dark:border-white/10',
          hover && 'transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
          className
        )}
        {...props}
      />
    );
  }
);
BaseCard.displayName = 'BaseCard';

export default BaseCard;
```

- [ ] **Step 2: Section.tsx 재작성**

먼저 현재 내용 확인 후 다음으로 교체:

```tsx
import React from 'react';
import { cn } from '../../lib/utils';
import GradientOrb, { type OrbColor } from './GradientOrb';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: 'canvas' | 'warm' | 'deep';
  orbs?: Array<{ color: OrbColor; size: number; top?: string; left?: string; right?: string; bottom?: string; opacity?: number }>;
  containerSize?: 'default' | 'wide' | 'narrow';
}

const TONE_BG = {
  canvas: 'bg-canvas text-ink dark:bg-canvas-deep dark:text-on-dark',
  warm: 'bg-canvas-warm text-ink dark:bg-surface-dark-elevated dark:text-on-dark',
  deep: 'bg-canvas-deep text-on-dark', // 다크 시네마틱 — 라이트모드에서도 다크 유지
};

const CONTAINER = {
  default: 'max-w-[1200px]',
  wide: 'max-w-[1400px]',
  narrow: 'max-w-[820px]',
};

// DESIGN.md §5 Layout: 96~120px vertical rhythm, alternation, atmospheric orb
const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, tone = 'canvas', orbs, containerSize = 'default', children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn('relative overflow-hidden py-14 md:py-20 lg:py-24', TONE_BG[tone], className)}
      {...props}
    >
      {orbs?.map((o, i) => (
        <GradientOrb
          key={i}
          color={o.color}
          size={o.size}
          opacity={o.opacity ?? 0.4}
          style={{ top: o.top, left: o.left, right: o.right, bottom: o.bottom }}
        />
      ))}
      <div className={cn('relative z-10 mx-auto px-4 sm:px-6 lg:px-12', CONTAINER[containerSize])}>
        {children}
      </div>
    </section>
  )
);
Section.displayName = 'Section';

export default Section;
```

- [ ] **Step 3: SectionHeading.tsx 재작성**

```tsx
import React from 'react';
import { cn } from '../../lib/utils';

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  as?: 'h1' | 'h2' | 'h3';
}

// DESIGN.md §3 Display weight 300, eyebrow는 caption-upper (영문 권장)
const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
  as: Tag = 'h2',
}) => (
  <header className={cn(align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-3xl', 'mb-10 md:mb-14', className)}>
    {eyebrow && (
      <p className="text-caption-upper uppercase text-ink-muted-60 dark:text-on-dark-soft mb-3">{eyebrow}</p>
    )}
    <Tag className="font-display font-light text-display-xl text-ink dark:text-on-dark">
      {title}
    </Tag>
    {lead && <p className="mt-5 text-lead text-ink-muted-80 dark:text-on-dark-soft">{lead}</p>}
  </header>
);

export default SectionHeading;
```

- [ ] **Step 4: type-check + 빌드 + 커밋**

```bash
npm run type-check && npm run build 2>&1 | tail -20
git add components/ui/BaseCard.tsx components/ui/Section.tsx components/ui/SectionHeading.tsx
git commit -m "feat(ui): rewrite BaseCard/Section/SectionHeading to Editorial tokens"
```

---

## Task 6: Hero primitive 신규 (DarkCinematic + LightEditorial)

**Files:**
- Create: `components/ui/Hero.tsx`

- [ ] **Step 1: Hero.tsx 작성**

```tsx
import React from 'react';
import Image from 'next/image';
import { cn } from '../../lib/utils';
import GradientOrb, { type OrbColor } from './GradientOrb';

interface HeroOrb {
  color: OrbColor;
  size: number;
  top?: string; left?: string; right?: string; bottom?: string;
  opacity?: number;
}

interface HeroProps {
  variant: 'darkCinematic' | 'lightEditorial';
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  image?: { src: string; alt: string; width: number; height: number };
  orbs?: HeroOrb[];
  className?: string;
}

const Hero: React.FC<HeroProps> = ({
  variant,
  eyebrow, title, lead,
  primaryCta, secondaryCta, image, orbs,
  className,
}) => {
  const isDark = variant === 'darkCinematic';

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        isDark ? 'bg-canvas-deep text-on-dark' : 'bg-canvas text-ink',
        'py-20 md:py-28 lg:py-32',
        className
      )}
    >
      {orbs?.map((o, i) => (
        <GradientOrb key={i} color={o.color} size={o.size} opacity={o.opacity ?? (isDark ? 0.55 : 0.4)}
          style={{ top: o.top, left: o.left, right: o.right, bottom: o.bottom }} />
      ))}
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-12 grid gap-10 lg:gap-16 lg:grid-cols-12 items-center">
        <div className={cn('lg:col-span-7', !image && 'lg:col-span-12 max-w-3xl mx-auto text-center')}>
          {eyebrow && (
            <p className={cn('text-caption-upper uppercase mb-4', isDark ? 'text-on-dark-soft' : 'text-ink-muted-60')}>
              {eyebrow}
            </p>
          )}
          <h1 className={cn(
            'font-display font-light text-display-mega',
            isDark ? 'text-on-dark' : 'text-ink'
          )}>
            {title}
          </h1>
          {lead && (
            <p className={cn('mt-6 text-lead', isDark ? 'text-on-dark-soft' : 'text-ink-muted-80')}>
              {lead}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {primaryCta && (
                <a
                  href={primaryCta.href}
                  className={cn(
                    'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] active:scale-[0.97]',
                    isDark ? 'bg-white text-ink hover:bg-on-dark-soft' : 'bg-ink text-white hover:bg-canvas-deep'
                  )}
                >
                  {primaryCta.label}
                </a>
              )}
              {secondaryCta && (
                <a
                  href={secondaryCta.href}
                  className={cn(
                    'inline-flex items-center justify-center font-medium rounded-pill transition-all h-14 px-7 text-[17px] border',
                    isDark ? 'border-white/20 text-on-dark hover:bg-white/[0.06]' : 'border-hairline-strong text-ink hover:bg-ink/[0.04]'
                  )}
                >
                  {secondaryCta.label}
                </a>
              )}
            </div>
          )}
        </div>
        {image && (
          <div className="lg:col-span-5">
            <div className={cn('overflow-hidden rounded-hero border', isDark ? 'border-white/10' : 'border-hairline')}>
              <Image src={image.src} alt={image.alt} width={image.width} height={image.height} className="w-full h-auto" priority />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Hero;
```

- [ ] **Step 2: type-check + 커밋**

```bash
npm run type-check
git add components/ui/Hero.tsx
git commit -m "feat(ui): add Hero primitive (darkCinematic / lightEditorial)"
```

---

## Task 7: 레이아웃 셸 — Layout / Header / Footer

**Files:**
- Modify: `components/Layout.tsx`
- Modify: `components/layout/Header.tsx`
- Modify: `components/layout/HeaderBrand.tsx`
- Modify: `components/layout/HeaderActions.tsx`
- Modify: `components/layout/DesktopNav.tsx`
- Modify: `components/layout/MobileNav.tsx`
- Modify: `components/layout/DropdownMenu.tsx`
- Modify: `components/layout/Footer.tsx`
- Modify: `components/LanguageSwitcher.tsx`

- [ ] **Step 1: Layout.tsx 색상 토큰 치환**

```bash
grep -n 'bg-white\|bg-gray-\|text-gray-\|border-gray-\|bg-primary\|text-primary' components/Layout.tsx
```

위 결과의 각 라인에 매핑표 적용. Edit으로 한 번에 치환:
- `bg-white` → `bg-canvas`
- `bg-gray-50` → `bg-canvas-warm`
- `bg-gray-900`/`bg-black` → `bg-canvas-deep`
- `text-gray-900`/`text-black` → `text-ink`
- `text-gray-600` → `text-ink-muted-60`
- `border-gray-200`/`border-gray-300` → `border-hairline`

(테마 토글 로직 자체는 건드리지 말 것 — `.dark` class 토글은 그대로 동작)

- [ ] **Step 2: Header.tsx + HeaderBrand + HeaderActions + Nav 일괄 치환**

각 파일에 같은 매핑표 적용. 추가로:
- 헤더 height 64px 고정 (`h-16`)
- 라이트: `bg-canvas/85 backdrop-blur-md border-b border-hairline`
- 다크: `dark:bg-canvas-deep/85 dark:border-white/10`
- 헤더 CTA(있다면) → `Button variant="primary" size="sm"` (Pill)

각 컴포넌트별로 `npm run type-check` 통과 확인.

- [ ] **Step 3: Footer.tsx 치환**

같은 매핑표 적용. footer는 보통 `canvas-warm` 톤이 어울림.

- [ ] **Step 4: LanguageSwitcher.tsx 치환**

dropdown 항목 hover 색을 `hover:bg-ink/[0.04]`로 통일. 활성 항목은 `text-link`.

- [ ] **Step 5: dev server 시각 확인 — 7개 locale 헤더/푸터**

```bash
npm run dev
```

브라우저에서 `/ko`, `/en`, `/zh`, `/es`, `/vi`, `/th`, `/uz` 각각 헤더/푸터 시각 확인.

- [ ] **Step 6: type-check + lint + test + 커밋**

```bash
npm run type-check && npm run lint && npm test
git add components/Layout.tsx components/layout/ components/LanguageSwitcher.tsx
git commit -m "feat(layout): apply Editorial tokens to shell (header/footer/nav)"
```

---

## Task 8: 시그니처 페이지 1 — 홈 (`pages/[locale]/index.tsx`)

**Files:**
- Modify: `pages/[locale]/index.tsx`

- [ ] **Step 1: 현재 구조 파악**

```bash
wc -l pages/\[locale\]/index.tsx
grep -n 'Hero\|Section\|bg-\|text-gray\|className' pages/\[locale\]/index.tsx | head -40
```

- [ ] **Step 2: 첫 화면을 Hero darkCinematic으로 교체**

기존 히어로 영역을 `<Hero variant="darkCinematic" ...>` 컴포넌트로 교체. orbs는 mint(우상단) + lavender(좌하단) 2개. CTA 2개(견적·스토리).

```tsx
<Hero
  variant="darkCinematic"
  eyebrow="STUDIO NOL"
  title={t('home.hero.title')}
  lead={t('home.hero.lead')}
  primaryCta={{ label: t('home.hero.ctaPrimary'), href: `/${locale}/contact` }}
  secondaryCta={{ label: t('home.hero.ctaSecondary'), href: `/${locale}/stories` }}
  orbs={[
    { color: 'mint', size: 720, top: '-160px', right: '-120px', opacity: 0.55 },
    { color: 'lavender', size: 560, bottom: '-180px', left: '-100px', opacity: 0.45 },
  ]}
/>
```

- [ ] **Step 3: 후속 섹션을 Section + SectionHeading + BaseCard로 교체**

각 콘텐츠 블록(소개/스토리 카드/포트폴리오/프로세스/CTA 등)을:
- `<Section tone="canvas">` ↔ `<Section tone="warm">` alternation
- 카드 그리드는 `BaseCard variant="default" hover` 사용
- 헤딩은 `SectionHeading` 사용

기존 페이지의 i18n 키, 데이터 fetch, 동적 import는 그대로 유지. **레이아웃·타이포·색상만 갈아엎기**.

- [ ] **Step 4: 마지막 CTA 섹션은 deep tone**

페이지 마지막 CTA를 `<Section tone="deep">` + orb 1개로 시네마틱 마무리:

```tsx
<Section tone="deep" orbs={[{ color: 'mint', size: 600, top: '-100px', right: '-80px', opacity: 0.5 }]}>
  <SectionHeading title={t('home.cta.title')} lead={t('home.cta.lead')} align="center" />
  <div className="mt-8 flex justify-center">
    <a href={`/${locale}/contact`} className="inline-flex h-14 px-7 items-center rounded-pill bg-white text-ink font-medium hover:bg-on-dark-soft">{t('home.cta.button')}</a>
  </div>
</Section>
```

- [ ] **Step 5: 7개 locale 홈 시각 확인**

`/ko`, `/en`, `/zh`, `/es`, `/vi`, `/th`, `/uz` 홈을 모두 열어 확인:
- 다크 히어로 위 텍스트 가독성
- orb가 텍스트와 겹쳐 가독성 해치지 않는지
- 모바일(devtools 360px)에서 헤딩이 줄어드는지
- CTA Pill이 한 줄에 두 개 들어가는지

- [ ] **Step 6: type-check + 커밋**

```bash
npm run type-check
git add pages/\[locale\]/index.tsx
git commit -m "feat(home): migrate to Editorial Cinematic (dark hero + alternating sections)"
```

---

## Task 9: 시그니처 페이지 2 — About + Studio-Info

**Files:**
- Modify: `pages/[locale]/about.tsx`
- Modify: `pages/[locale]/studio-info.tsx`
- Modify: `components/studio/EquipmentSection.tsx`
- Modify: `components/common/ImageHero.tsx`

- [ ] **Step 1: ImageHero를 Hero variant="lightEditorial"로 흡수 또는 재작성**

`components/common/ImageHero.tsx`가 about/studio-info에서 공용으로 쓰인다면, 내부 구현을 Hero lightEditorial 패턴으로 재작성. 외부 props 시그니처는 호환 유지.

- [ ] **Step 2: about.tsx 마이그레이션**

- 첫 화면 Hero `lightEditorial`. orbs 1~2개(peach + sky).
- 본문 섹션 alternation (canvas → warm).
- 인용·통계·팀 카드 = BaseCard.
- 마지막 CTA = `Section tone="deep"`.

- [ ] **Step 3: studio-info.tsx 마이그레이션 (장비 소개)**

- Hero `lightEditorial`. orb 1개(mint = 스튜디오 시그니처).
- EquipmentSection 내부 카드 → BaseCard variant="default" + 장비 사진은 12px radius + whisper border.
- 장비 카테고리 헤딩 → SectionHeading.

- [ ] **Step 4: 7개 locale 시각 확인 + type-check + 커밋**

```bash
npm run type-check && npm test
git add pages/\[locale\]/about.tsx pages/\[locale\]/studio-info.tsx components/studio/EquipmentSection.tsx components/common/ImageHero.tsx
git commit -m "feat(pages): migrate about + studio-info to Editorial"
```

---

## Task 10: 콘텐츠 페이지 1 — Stories (list + detail + category) + StoryCard + MarkdownRenderer

**Files:**
- Modify: `pages/[locale]/stories/index.tsx`
- Modify: `pages/[locale]/stories/[id].tsx`
- Modify: `pages/[locale]/stories/category/*.tsx` (모든 파일)
- Modify: `components/StoryCard.tsx`
- Modify: `components/StoryCTA.tsx`
- Modify: `components/MarkdownRenderer.tsx`
- Modify: `components/CategoryFilter.tsx`
- Modify: `components/story/SessionChecklist.tsx`
- Modify: `components/story/OnlineFallback.tsx`

- [ ] **Step 1: StoryCard.tsx 재작성**

DESIGN.md §4 Story Card 스펙:
- bg `bg-canvas-soft`, border `border-hairline`, shadow `shadow-card`, radius `rounded-card`
- thumbnail 16:9, `rounded-t-card`, whisper border
- title `text-title-md text-ink` 2줄 클램프 (`line-clamp-2`)
- excerpt `text-[15px] text-ink-muted-60` 3줄 클램프 (`line-clamp-3`)
- meta `text-caption text-ink-muted-40`
- hover: `hover:shadow-card-hover hover:-translate-y-0.5`

- [ ] **Step 2: stories/index.tsx (list page) 마이그레이션**

- Hero `lightEditorial`. orb peach 1개.
- 카테고리 필터 → CategoryFilter (재스타일링)
- 카드 그리드 = StoryCard, `gap-6 md:gap-8`, `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Pagination 컴포넌트 새 톤 적용.

- [ ] **Step 3: stories/[id].tsx (detail page) 마이그레이션**

- Hero 영역: `Section tone="canvas"` + 큰 썸네일 + Display title.
- 본문: `Section containerSize="narrow"` (max-width 820px, 가독성).
- MarkdownRenderer prose 스타일 새 토큰.
- 우측/하단 StoryCTA: `Section tone="warm"` 또는 마지막 `tone="deep"`.

- [ ] **Step 4: MarkdownRenderer.tsx prose 스타일 재정의**

기존 prose className을 새 토큰으로:
- 본문 `text-ink-muted-80` line-height 1.7
- 헤딩 `font-display font-light text-ink`
- inline code `bg-canvas-warm text-ink rounded-whisper px-1.5 font-mono`
- blockquote 좌측 4px ink hairline + ink-muted-60 italic
- a `text-link hover:underline`
- img `rounded-card border border-hairline shadow-card`

- [ ] **Step 5: 스냅샷 갱신**

```bash
npm test -- components/MarkdownRenderer.test.tsx -u
```

- [ ] **Step 6: 7개 locale stories list/detail 시각 확인**

특히 **장문 본문 가독성** 집중 확인 (다국어 본문 길이 다름).

- [ ] **Step 7: type-check + lint + 커밋**

```bash
npm run type-check && npm run lint && npm test
git add pages/\[locale\]/stories components/StoryCard.tsx components/StoryCTA.tsx components/MarkdownRenderer.tsx components/CategoryFilter.tsx components/story
git commit -m "feat(stories): migrate stories list/detail/markdown to Editorial"
```

---

## Task 11: 콘텐츠 페이지 2 — Portfolio (list + detail) + 모달

**Files:**
- Modify: `pages/[locale]/portfolio.tsx`
- Modify: `pages/[locale]/portfolio/[id].tsx`
- Modify: `components/PortfolioDetailModal.tsx`
- Modify: `components/portfolio/PortfolioDetailBody.tsx`
- Modify: `components/portfolio/PortfolioDetailSummary.tsx`
- Modify: `components/ui/ProjectRowCard.tsx`
- Modify: `components/ui/MediaGallery.tsx`

- [ ] **Step 1: portfolio.tsx (list)**

- Hero `lightEditorial`. orb sky 1개.
- ProjectRowCard 또는 카드 그리드 — 작품 사진이 주인공이므로 카드 padding 작게(p-0 + 텍스트만 p-5), 사진 풀 width.
- 필터/정렬 UI = outline pill 버튼 그룹.

- [ ] **Step 2: portfolio/[id].tsx (detail)**

- Hero를 작품 메인 사진 + 라이트 에디토리얼.
- PortfolioDetailSummary = `Section containerSize="narrow"` + BaseCard.
- PortfolioDetailBody = MarkdownRenderer 새 prose.
- MediaGallery 갤러리 이미지 grid `gap-4`, `rounded-card`, whisper border.

- [ ] **Step 3: PortfolioDetailModal.tsx**

- 모달 backdrop: `bg-canvas-deep/80 backdrop-blur-sm`
- 모달 컨테이너: `bg-canvas-soft rounded-hero shadow-deep border border-hairline`
- 닫기 버튼: `Button variant="text" size="icon"`

- [ ] **Step 4: 시각 확인 + type-check + 커밋**

```bash
npm run type-check && npm test
git add pages/\[locale\]/portfolio* components/PortfolioDetailModal.tsx components/portfolio components/ui/ProjectRowCard.tsx components/ui/MediaGallery.tsx
git commit -m "feat(portfolio): migrate portfolio list/detail/modal to Editorial"
```

---

## Task 12: 콘텐츠 페이지 3 — 서비스 4종 (Lesson / Voice-Acting / Wedding-Song / Practice-Room)

**Files:**
- Modify: `pages/[locale]/lesson.tsx`
- Modify: `pages/[locale]/voice-acting.tsx`
- Modify: `pages/[locale]/wedding-song.tsx`
- Modify: `pages/[locale]/practice-room.tsx`
- Modify: `components/ui/FeatureCard.tsx`
- Modify: `components/ui/QuickAnswers.tsx`
- Modify: `components/ui/ReviewSection.tsx`

- [ ] **Step 1: 4개 페이지에 동일 패턴 적용**

각 페이지마다:
- Hero `lightEditorial` (orb 1~2개, 페이지별로 다른 색):
  - lesson: peach + mint
  - voice-acting: lavender + sky
  - wedding-song: rose + peach
  - practice-room: sky + mint
- 본문 섹션 alternation (canvas/warm)
- 가격/플랜 표가 있으면 BaseCard 그리드
- FAQ는 `<FAQSection>` (Task 13에서 재작성됨, 이번 task에서는 그냥 사용)
- Reviews는 `<ReviewSection>` (재작성 후 사용)
- 마지막 CTA = `Section tone="deep"` (선택적, 페이지마다 결정)

- [ ] **Step 2: FeatureCard / QuickAnswers / ReviewSection 새 톤**

각 컴포넌트의 `bg-`/`text-`/`border-`/`shadow-`/`rounded-` 클래스를 매핑표대로 일괄 치환. CVA variant가 있다면 새 tone 변형 추가.

- [ ] **Step 3: 4페이지 × 7 locale 시각 확인**

특히 wedding-song처럼 사진이 많은 페이지에서 사진 처리(rounded-card + whisper border) 확인.

- [ ] **Step 4: type-check + 커밋**

```bash
npm run type-check && npm run lint && npm test
git add pages/\[locale\]/lesson.tsx pages/\[locale\]/voice-acting.tsx pages/\[locale\]/wedding-song.tsx pages/\[locale\]/practice-room.tsx components/ui/FeatureCard.tsx components/ui/QuickAnswers.tsx components/ui/ReviewSection.tsx
git commit -m "feat(services): migrate 4 service pages to Editorial"
```

---

## Task 13: 폼/CTA/요금/약관/오류 페이지 (Contact / Pricing / Privacy / 404 / 500)

**Files:**
- Modify: `pages/[locale]/contact.tsx`
- Modify: `pages/[locale]/pricing.tsx`
- Modify: `pages/[locale]/privacy-policy.tsx`
- Modify: `pages/404.tsx`
- Modify: `pages/500.tsx`
- Modify: `components/common/ContactCTA.tsx`
- Modify: `components/ui/PricingCard.tsx`
- Modify: `components/ui/FAQSection.tsx`

- [ ] **Step 1: contact.tsx 폼 마이그레이션**

- Hero `lightEditorial` 또는 단순 `Section tone="canvas"` + heading만.
- 폼 컨테이너: `BaseCard variant="featured"` 또는 `bg-canvas-soft border border-hairline rounded-hero shadow-card p-8`
- input/textarea/select: `bg-canvas-soft border border-hairline-strong rounded-whisper px-3.5 py-2.5 focus:border-link-focus focus:ring-2 focus:ring-link-focus/20`
- label: `text-[14px] font-medium text-ink`
- submit: `Button variant="primary" size="lg" fullWidth`
- 성공/실패 toast: 성공 `bg-orb-mint/30 border-orb-mint text-ink`, 실패 `bg-red-50 border-red-200 text-red-700`

- [ ] **Step 2: PricingCard.tsx 재작성**

- 추천 플랜 카드: `BaseCard variant="featured"` + 좌상단에 GradientOrb mint 작게(opacity 0.3, blur 60px)
- 가격 숫자: `font-display font-light text-display-xl text-ink`
- 기능 리스트: `text-ink-muted-80` + 체크 아이콘 `text-ink`
- CTA: `Button variant="primary" fullWidth`

- [ ] **Step 3: pricing.tsx**

- Hero `lightEditorial`. 가격 카드 그리드 `grid-cols-1 md:grid-cols-3 gap-6`.
- FAQ 섹션 = FAQSection.

- [ ] **Step 4: privacy-policy.tsx**

- 단순 `Section containerSize="narrow"`. MarkdownRenderer prose 또는 직접 `prose prose-ink` 클래스.

- [ ] **Step 5: 404 / 500**

- `Section tone="deep"` 풀스크린 + orb 1개 + 큰 숫자(`font-display text-display-mega`) + 홈으로 돌아가기 CTA(onDark Pill).

- [ ] **Step 6: ContactCTA.tsx + FAQSection.tsx 새 톤**

매핑표대로 치환. FAQSection 아코디언 토글은 chevron 회전 유지, border `border-hairline`.

- [ ] **Step 7: 7 locale 시각 확인 (특히 contact 폼 입력 / focus ring)**

- [ ] **Step 8: type-check + lint + test + 커밋**

```bash
npm run type-check && npm run lint && npm test
git add pages/\[locale\]/contact.tsx pages/\[locale\]/pricing.tsx pages/\[locale\]/privacy-policy.tsx pages/404.tsx pages/500.tsx components/common/ContactCTA.tsx components/ui/PricingCard.tsx components/ui/FAQSection.tsx
git commit -m "feat(pages): migrate contact/pricing/privacy/404/500 to Editorial"
```

---

## Task 14: 기타 UI primitive 정리 (Breadcrumb / Pagination / LoadingSpinner / ScrollToTop / ScrollProgress)

**Files:**
- Modify: `components/ui/Breadcrumb.tsx`
- Modify: `components/ui/Pagination.tsx`
- Modify: `components/ui/LoadingSpinner.tsx`
- Modify: `components/ui/ScrollToTop.tsx`
- Modify: `components/common/ScrollProgress.tsx`

- [ ] **Step 1: Breadcrumb — `text-ink-muted-60`, separator 슬래시 `text-ink-muted-40`, 현재 페이지 `text-ink font-medium`**

- [ ] **Step 2: Pagination — pill 버튼, active = `bg-ink text-white`, inactive = `border border-hairline text-ink hover:bg-ink/[0.04]`**

- [ ] **Step 3: LoadingSpinner — border 색을 `border-ink-muted-40 border-t-ink`로**

- [ ] **Step 4: ScrollToTop — fab 스타일 `bg-ink text-white shadow-deep rounded-pill`**

- [ ] **Step 5: ScrollProgress — bar 색을 `bg-link` 또는 `bg-ink`**

- [ ] **Step 6: type-check + 커밋**

```bash
npm run type-check && npm test
git add components/ui/Breadcrumb.tsx components/ui/Pagination.tsx components/ui/LoadingSpinner.tsx components/ui/ScrollToTop.tsx components/common/ScrollProgress.tsx
git commit -m "feat(ui): polish ancillary primitives to Editorial"
```

---

## Task 15: SEO theme-color + AudioPlayer + ErrorBoundary

**Files:**
- Modify: `components/SEO.tsx`
- Modify: `components/__snapshots__/SEO.test.tsx.snap`
- Modify: `components/AudioPlayer/*.tsx` (visual primitives만)
- Modify: `components/ErrorBoundary.tsx`

- [ ] **Step 1: SEO.tsx의 `theme-color` meta 갱신**

`<meta name="theme-color" content="...">` 값을:
- light: `#faf9f7`
- dark: `#0c0a09`

미디어 쿼리 분기 사용:

```tsx
<meta name="theme-color" content="#faf9f7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0c0a09" media="(prefers-color-scheme: dark)" />
```

- [ ] **Step 2: 스냅샷 갱신**

```bash
npm test -- components/SEO.test.tsx -u
```

- [ ] **Step 3: AudioPlayer 시각 컴포넌트 색상 치환**

- 컨트롤 버튼: `bg-canvas-soft border-hairline text-ink hover:bg-ink/[0.04]`
- 진행바: `bg-ink-muted-40` 트랙 + `bg-ink` fill
- 시간 텍스트: `text-ink-muted-60 font-mono`

오디오 핵심 로직(`useAudioPlayer.ts`)은 절대 건드리지 말 것.

- [ ] **Step 4: ErrorBoundary fallback UI**

`Section tone="canvas"` + 큰 메시지(`text-display-md`) + 홈으로 가기 Pill 버튼.

- [ ] **Step 5: 커밋**

```bash
npm run type-check && npm test
git add components/SEO.tsx components/__snapshots__/SEO.test.tsx.snap components/AudioPlayer components/ErrorBoundary.tsx
git commit -m "feat(misc): update SEO theme-color + audio player + error boundary"
```

---

## Task 16: 옛 토큰 제거 (Phase 9 클린업)

**Files:**
- Modify: `tailwind.config.ts` (primary/secondary/accent 삭제)
- Modify: `styles/globals.css` (--primary-rgb 제거, .typo-* 클래스 제거 또는 매핑)

- [ ] **Step 1: 옛 색 토큰 사용처 grep**

```bash
grep -rn 'bg-primary\|text-primary\|border-primary\|bg-secondary\|text-secondary\|border-secondary\|bg-accent\|text-accent\|border-accent' components pages 2>/dev/null
```

Expected: **0건** (마이그레이션 완료 시). 1건이라도 나오면 그 페이지/컴포넌트를 패턴대로 수정. 절대 토큰만 지우지 말 것.

- [ ] **Step 2: tailwind.config.ts에서 옛 토큰 제거**

`theme.extend.colors`에서 `primary`, `secondary`, `accent` 객체 삭제. `gray`는 유지(여전히 일부 사용처 있음).

- [ ] **Step 3: globals.css에서 `--primary-rgb` 제거 + `.typo-*` 클래스 검토**

```bash
grep -rn 'typo-' components pages 2>/dev/null
```

각 사용처를 새 utility(`text-display-lg` 등)로 치환. `tailwind.config.ts`의 `addComponents({ '.typo-*': ... })` 블록 삭제 또는 새 토큰 alias로 재정의.

- [ ] **Step 4: build + grep로 회귀 확인**

```bash
npm run build
grep -rn 'bg-primary\|--primary-rgb\|typo-' components pages styles tailwind.config.ts 2>/dev/null
```

Expected: 0건.

- [ ] **Step 5: 커밋**

```bash
npm run type-check && npm run lint && npm test
git add tailwind.config.ts styles/globals.css
git commit -m "chore(design): remove legacy purple/pink/emerald tokens + .typo-* classes"
```

---

## Task 17: 최종 검증 — Lighthouse / Web Vitals 회귀 + 모든 locale 풀 워크스루

**Files:**
- (없음 — 검증 단계)

- [ ] **Step 1: 풀 빌드 + 모든 페이지 prerender 확인**

```bash
npm run build 2>&1 | tee /tmp/build-final.log
grep -E 'error|warn' /tmp/build-final.log | head -30
```

Expected: error 0, warn 베이스라인과 비교해 신규 warn 없음.

- [ ] **Step 2: 단위·통합 테스트 풀**

```bash
npm test 2>&1 | tail -20
```

Expected: 모든 suite PASS.

- [ ] **Step 3: dev server에서 7개 locale × 13개 페이지 풀 워크스루**

```bash
npm run dev
```

체크리스트 (각 locale마다):
- [ ] 헤더 / 푸터 일관 톤
- [ ] 홈 다크 히어로 + orb
- [ ] 스토리 list/detail prose 가독성
- [ ] 포트폴리오 list/detail/모달
- [ ] 4개 서비스 페이지 (lesson/voice-acting/wedding-song/practice-room)
- [ ] 컨택트 폼 입력/포커스/제출
- [ ] 가격 카드 그리드
- [ ] 약관·404·500
- [ ] 다크 모드 토글 시 일관 전환

- [ ] **Step 4: Lighthouse 회귀 확인**

Chrome DevTools Lighthouse로 홈/스토리 detail 2개 페이지에 대해:
- Performance ≥ 베이스라인 -5
- Accessibility ≥ 95
- Best Practices ≥ 95
- LCP, CLS, INP 회귀 없음 (특히 orb의 `filter: blur` 성능 영향)

문제 시 orb를 `will-change: auto` + 큰 사이즈 줄이거나 모바일에서 비활성화.

- [ ] **Step 5: 베이스라인 HTML과 새 prerender HTML diff (회귀 검증)**

```bash
mkdir -p /tmp/studio-after
for path in / /ko /ko/about /ko/contact /ko/stories /ko/portfolio /ko/pricing; do
  curl -s "http://localhost:3000$path" > "/tmp/studio-after$(echo $path | tr '/' '_').html"
done
diff -q /tmp/studio-baseline /tmp/studio-after
```

Expected: 모든 파일 differ (의도한 변경). 페이지 자체가 사라지거나 i18n 키가 누락된 곳이 없는지 확인.

- [ ] **Step 6: PR 생성 + 머지 결정**

```bash
git log --oneline main..design/editorial-renewal | head -25
git push -u origin design/editorial-renewal
gh pr create --title "design: Editorial Cinematic 전면 리뉴얼" --body "..."
```
