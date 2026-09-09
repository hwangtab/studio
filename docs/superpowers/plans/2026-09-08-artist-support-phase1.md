# 아티스트 후원 1차(허브·헤더) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결제 없이 배포 가능한 아티스트 허브(`/ko/artists`)와 아티스트 페이지(`/ko/artists/[slug]`)를 만들고 헤더·푸터·사이트맵에 연결한다. 후원 CTA 자리는 "준비 중 + 카카오톡 문의"로 채운다.

**Architecture:** 아티스트 프로필은 `data/artists/index.ts` 정적 데이터(상품·포트폴리오와 같은 방식). 포트폴리오와는 `portfolioArtist` 문자열로 조인해 작업 사례를 자동으로 붙인다. 페이지는 기존 `SEO`·`ImageHero`·`Section`·`BaseCard`·`PortfolioMiniCard`·`HeroKakaoCta`로 조립하고 ko 로케일만 정적 생성한다. 2차(결제)는 이 페이지의 CTA 컴포넌트 하나만 교체한다.

**Tech Stack:** Next.js 15 Pages Router, react-i18next, markdown-to-jsx(기존), jest(기존). 신규 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-09-08-artist-support-design.md` (§6 1차, §7.1, §11)

## Global Constraints

- **ko 전용**: 두 페이지 모두 `getStaticPaths`가 ko 경로만 반환한다. 헤더·푸터 링크는 `locale === 'ko'`에서만 렌더
- **카카오 배색 규칙**: 옐로는 카카오톡 목적지 전용. 1차 CTA는 카카오 링크이므로 `HeroKakaoCta`를 그대로 쓴다. 2차에서 붙을 "후원 시작" 버튼은 `bg-primary`
- **가격 리터럴 금지**: 1차에는 금액을 어디에도 적지 않는다(등급은 2차 `data/pricing.ts` 상수)
- **i18n 패리티**: `public/locales/*/common.json` 7개 파일 모두에 같은 키 구조. 비-ko 6개는 en 값을 복사(페이지가 빌드되지 않아 노출되지 않는다). `content/localeKeyParity.test.ts`·`content/i18nKeys.test.ts`가 잡는다
- **사이트맵 lastmod**: `pageRouteMap` 등록 후 `npm run generate:page-lastmod` 실행. diff에서 **이번에 실제 바뀐 라우트만** 남기고 나머지는 `git checkout -- lib/sitemap/pageLastmod.json` 후 해당 항목만 손으로 옮긴다(CLAUDE.md lastmod 절)
- **이미지**: 아티스트 사진은 권리 확인된 파일만 `public/images/artists/<slug>.jpg`에 둔다. `node scripts/optimizeImages.js`가 WebP와 `utils/imageMetadata.json`을 만든다
- **사실 검증**: 아티스트 소개 글은 포트폴리오 `productionNotes`·운영자 제공 자료에 있는 사실만. 수상·이력을 지어내지 않는다
- **검증 순서**: `npm run type-check` → `npm run lint` → `npm test` → `npm run build`
- **브랜치**: `git switch -c feat/artist-support-phase1`에서 작업, PR은 `gh pr create --fill && gh pr merge --auto --squash`

## 실행 전 확인 입력

| 항목 | 기본값 | 위치 |
|---|---|---|
| 첫 아티스트 | 운영자가 지정. 후보: 포트폴리오 featured 팀(더 프로젝터스·하루살이 프로젝트·삼각전파사·자이·허정혁·모레도토요일·까르·남자애) | Task 8 |
| 아티스트 사진 | 운영자 제공(권리 확인). 없으면 그 아티스트는 `supportActive: false`로 두고 페이지는 만들지 않는다 | `public/images/artists/` |
| 내비 라벨 | ko "아티스트 후원", en "Support Artists" | Task 3 |

---

### Task 1: 아티스트 데이터 모듈

**Files:**
- Create: `data/artists/index.ts`
- Test: `data/artists/artists.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SupportedArtist {
    slug: string; name: string; portfolioArtist: string; tagline: string; bio: string;
    image: string; links: Partial<Record<ArtistLinkKey, string>>; supportActive: boolean;
    taxType: 'withholding' | 'invoice'; joinedOn: string; updatedOn: string;
  }
  export type ArtistLinkKey = 'instagram' | 'youtube' | 'spotify' | 'melon' | 'bandcamp' | 'site';
  export const SUPPORTED_ARTISTS: readonly SupportedArtist[];
  export const getSupportedArtists = (): SupportedArtist[];            // 등재 순
  export const getSupportedArtist = (slug: string): SupportedArtist | null;
  export const getArtistPortfolioItems = (artist: SupportedArtist, locale: Locale): PortfolioItem[]; // featured 먼저, 발매일 내림차순
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`data/artists/artists.test.ts`:

```ts
/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { SUPPORTED_ARTISTS, getSupportedArtist, getArtistPortfolioItems } from './index';
import { getPortfolioItems } from '../portfolio';

describe('data/artists', () => {
  it('slug는 소문자·숫자·하이픈이며 중복이 없다', () => {
    const slugs = SUPPORTED_ARTISTS.map((a) => a.slug);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('portfolioArtist는 포트폴리오에 실제로 존재하는 아티스트명이다', () => {
    const known = new Set(getPortfolioItems('ko').map((i) => i.artist));
    for (const a of SUPPORTED_ARTISTS) expect(known).toContain(a.portfolioArtist);
  });

  it('이미지 파일이 저장소에 존재한다', () => {
    for (const a of SUPPORTED_ARTISTS) {
      expect(a.image).toMatch(/^\/images\/artists\/[a-z0-9-]+\.(jpg|jpeg|png)$/);
      expect(fs.existsSync(path.join(process.cwd(), 'public', a.image))).toBe(true);
    }
  });

  it('날짜는 ISO(YYYY-MM-DD)이고 updatedOn >= joinedOn', () => {
    for (const a of SUPPORTED_ARTISTS) {
      expect(a.joinedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updatedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.updatedOn >= a.joinedOn).toBe(true);
    }
  });

  it('getSupportedArtist는 없는 slug에 null을 돌려준다', () => {
    expect(getSupportedArtist('no-such-artist')).toBeNull();
  });

  it('getArtistPortfolioItems는 featured를 앞에, 그 다음 발매일 내림차순으로 준다', () => {
    const sample = { slug: 'x', name: 'x', portfolioArtist: '자이', tagline: '', bio: '', image: '/images/artists/x.jpg',
      links: {}, supportActive: false, taxType: 'withholding', joinedOn: '2026-09-08', updatedOn: '2026-09-08' } as const;
    const items = getArtistPortfolioItems(sample, 'ko');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.artist === '자이')).toBe(true);
    const firstNonFeatured = items.findIndex((i) => !i.featured);
    if (firstNonFeatured > 0) expect(items.slice(0, firstNonFeatured).every((i) => i.featured)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest data/artists/artists.test.ts`
Expected: FAIL — `Cannot find module './index'`

- [ ] **Step 3: 구현**

`data/artists/index.ts`:

```ts
import type { Locale } from '../../lib/i18n';
import type { PortfolioItem } from '../../types/data';
import { getPortfolioItems } from '../portfolio';

export type ArtistLinkKey = 'instagram' | 'youtube' | 'spotify' | 'melon' | 'bandcamp' | 'site';

/**
 * 후원 멤버십에 참여하는 아티스트. 운영자가 섭외·동의서를 받은 팀만 여기 싣는다.
 * 관리자 UI 없음 — 상품·포트폴리오와 같이 코드로 관리한다(스펙 §7.1).
 *
 * - portfolioArtist: data/portfolio/items.ts의 artist 문자열과 정확히 일치해야 작업 사례가 붙는다.
 * - image: 권리 확인된 파일만. 포트폴리오 이미지는 대부분 외부 CDN이라 그대로 못 쓴다.
 * - bio: 마크다운. 포트폴리오 productionNotes와 운영자 제공 자료에 있는 사실만 쓴다.
 */
export interface SupportedArtist {
  slug: string;
  name: string;
  portfolioArtist: string;
  tagline: string;
  bio: string;
  image: string;
  links: Partial<Record<ArtistLinkKey, string>>;
  /** false면 페이지는 있되 후원 CTA를 렌더하지 않는다(2차부터 의미를 가진다). */
  supportActive: boolean;
  /** 지급 시 세금 처리 — 3.3% 원천징수 | 사업자 세금계산서 (스펙 §10). */
  taxType: 'withholding' | 'invoice';
  joinedOn: string;
  /** 사이트맵 lastmod. 소개·링크를 고치면 올린다. */
  updatedOn: string;
}

export const SUPPORTED_ARTISTS: readonly SupportedArtist[] = [];

export const getSupportedArtists = (): SupportedArtist[] => [...SUPPORTED_ARTISTS];

export const getSupportedArtist = (slug: string): SupportedArtist | null =>
  SUPPORTED_ARTISTS.find((a) => a.slug === slug) ?? null;

export const getArtistPortfolioItems = (artist: SupportedArtist, locale: Locale): PortfolioItem[] =>
  getPortfolioItems(locale)
    .filter((item) => item.artist === artist.portfolioArtist)
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');
    });
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest data/artists/artists.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add data/artists/index.ts data/artists/artists.test.ts
git commit -m "feat(artists): 후원 아티스트 데이터 모듈 — 포트폴리오 조인·검증 테스트"
```

---

### Task 2: i18n 키 7개 로케일

**Files:**
- Modify: `public/locales/ko/common.json`, `public/locales/{en,zh,es,vi,th,uz}/common.json`

**Interfaces:**
- Produces: `nav.artists`, `nav.short.artists`, 최상위 `artists` 섹션(아래 키 트리). 페이지는 `i18nSections: ['artists', 'portfolio']`로 가져간다

- [ ] **Step 1: ko 키 추가**

`public/locales/ko/common.json`의 `nav`에 `"artists": "아티스트 후원"`, `nav.short`에 `"artists": "아티스트 후원"`을 넣고, 최상위에 `artists` 섹션을 추가한다(`releaseProject` 다음):

```json
"artists": {
  "seo": {
    "title": "아티스트 후원 | 스튜디오 놀",
    "description": "스튜디오 놀과 함께 작업한 아티스트를 매월 소액으로 후원합니다. 후원금은 아티스트의 활동비로 쓰이고, 후원자에게는 아티스트의 소식이 전해집니다.",
    "keywords": "아티스트 후원, 인디 뮤지션 후원, 월 후원, 스튜디오 놀"
  },
  "hero": {
    "title": "아티스트를 매월 후원하세요",
    "subtitle": "스튜디오 놀에서 함께 만든 음악의 주인공들입니다. 작은 금액이 다음 곡을 만드는 시간이 됩니다.",
    "imageAlt": "스튜디오 놀 라이브룸에서 녹음 중인 아티스트"
  },
  "how": {
    "title": "이렇게 진행됩니다",
    "items": [
      { "title": "아티스트를 고릅니다", "body": "소개와 작업 사례를 보고 응원하고 싶은 팀을 고릅니다." },
      { "title": "매월 정해진 금액을 후원합니다", "body": "카드가 매월 같은 날 자동 결제되고, 언제든 해지할 수 있습니다." },
      { "title": "아티스트에게 전해집니다", "body": "후원금의 대부분이 아티스트에게 지급되고, 후원자에게는 아티스트의 소식이 옵니다." }
    ]
  },
  "list": {
    "title": "후원할 수 있는 아티스트",
    "empty": "첫 아티스트를 준비하고 있습니다. 곧 이 자리에서 만나실 수 있습니다.",
    "viewProfile": "소개 보기"
  },
  "faq": {
    "title": "자주 묻는 질문",
    "subtitle": "후원 방식과 해지·환급에 대해 자주 받는 질문입니다.",
    "items": [
      { "question": "후원금은 어디로 가나요?", "answer": "스튜디오 놀이 멤버십을 판매하고, 지정하신 아티스트에게 정해진 비율을 매월 지급합니다. 비율은 아티스트 페이지에 공개합니다." },
      { "question": "언제든 그만둘 수 있나요?", "answer": "네. 후원 관리 링크에서 즉시 해지할 수 있고 다음 달부터 결제되지 않습니다." },
      { "question": "후원자에게 무엇이 오나요?", "answer": "아티스트 페이지의 후원자 명단(원할 때만)과 월 1회 아티스트 소식 메일입니다." }
    ]
  },
  "cta": {
    "title": "궁금한 점이 있으신가요?",
    "subtitle": "후원 방식이나 아티스트 참여에 대해 카카오톡으로 편하게 물어보세요.",
    "label": "카카오톡으로 문의하기"
  },
  "detail": {
    "metaDescription": "{{name}} — {{tagline}}. 스튜디오 놀에서 함께 작업한 아티스트를 매월 후원할 수 있습니다.",
    "backToList": "아티스트 목록으로",
    "worksTitle": "스튜디오 놀에서 함께한 작업",
    "linksTitle": "더 듣고 보기",
    "supportTitle": "이 아티스트 후원하기",
    "supportPending": "후원 오픈을 준비하고 있습니다",
    "supportPendingBody": "정기 후원이 열리면 알려드릴게요. 미리 카카오톡으로 관심을 남겨 주세요.",
    "supportPendingLabel": "카카오톡으로 소식 받기",
    "shareTitle": "{{name}} 후원하기 — 스튜디오 놀"
  }
}
```

- [ ] **Step 2: en 키 추가 + 5개 로케일 복사**

`public/locales/en/common.json`에 같은 구조로 영어 값을 넣는다(`nav.artists`·`nav.short.artists`는 "Support Artists"). 그 다음 zh·es·vi·th·uz 4개... 5개 파일에는 en 섹션을 그대로 복사한다. 복사는 스크립트로:

```bash
node -e '
const fs=require("fs");
const en=JSON.parse(fs.readFileSync("public/locales/en/common.json","utf8"));
for (const l of ["zh","es","vi","th","uz"]) {
  const p=`public/locales/${l}/common.json`;
  const j=JSON.parse(fs.readFileSync(p,"utf8"));
  j.nav.artists=en.nav.artists; j.nav.short.artists=en.nav.short.artists; j.artists=en.artists;
  fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n");
}'
```

주의: 기존 파일의 들여쓰기가 2칸인지 `head -3`로 먼저 확인하고, 다르면 `JSON.stringify`의 인자를 맞춘다. diff가 해당 키 추가만 보여야 한다.

- [ ] **Step 3: 패리티·키 테스트 통과 확인**

Run: `npx jest content/localeKeyParity.test.ts content/i18nKeys.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add public/locales/*/common.json
git commit -m "i18n(artists): 아티스트 후원 nav·페이지 카피 7개 로케일"
```

---

### Task 3: 헤더·푸터·JSON-LD 내비

**Files:**
- Modify: `components/layout/Header.tsx:50-108`
- Modify: `components/layout/Footer.tsx:114-127`
- Modify: `lib/navLabels.ts`
- Modify: `pages/_app.tsx:186-210`
- Test: `components/layout/Header.test.tsx` (기존, 회귀 확인)

**Interfaces:**
- Consumes: Task 2의 `nav.artists`·`nav.short.artists`

- [ ] **Step 1: Header 직결 링크 추가**

`components/layout/Header.tsx`의 `directLinks`를 다음으로 바꾼다:

```tsx
  // 아티스트 후원은 ko 전용(결제 퍼널과 같은 정책, 스펙 §11.2) — 비-ko에선 링크를 만들지 않는다.
  const directLinks = useMemo(() => [
    { id: 'practice-room', label: t('nav.short.practiceRoom'), href: `/${locale}/practice-room` },
    { id: 'pricing', label: t('nav.short.pricing'), href: `/${locale}/pricing` },
    ...(locale === 'ko'
      ? [{ id: 'artists', label: t('nav.short.artists'), href: `/${locale}/artists` }]
      : []),
  ], [locale, t]);
```

`desktopNavItems`를 다음으로 바꾼다(가격 오른쪽에 아티스트 후원):

```tsx
  const desktopNavItems = useMemo(() => [
    { kind: 'link' as const, ...directLinks[0] },
    ...navGroups.map((group) => ({ kind: 'group' as const, ...group })),
    ...directLinks.slice(1).map((link) => ({ kind: 'link' as const, ...link })),
  ], [directLinks, navGroups]);
```

`quickLinks`에 ko 전용 항목을 추가한다:

```tsx
  const quickLinks = useMemo(() => [
    { label: t('nav.practiceRoom'), href: `/${locale}/practice-room` },
    { label: t('nav.pricing'), href: `/${locale}/pricing` },
    ...(locale === 'ko' ? [{ label: t('nav.artists'), href: `/${locale}/artists` }] : []),
    { label: t('nav.contact'), href: `/${locale}/contact` },
  ], [locale, t]);
```

- [ ] **Step 2: Footer 콘텐츠 열에 추가**

`components/layout/Footer.tsx`의 콘텐츠 `<ul>`:

```tsx
            <ul className="flex flex-col">
              <FooterLink href={`/${locale}/stories`}>{t('nav.stories')}</FooterLink>
              <FooterLink href={`/${locale}/portfolio`}>{t('nav.portfolio')}</FooterLink>
              {locale === 'ko' && (
                <FooterLink href={`/${locale}/artists`}>{t('nav.artists')}</FooterLink>
              )}
            </ul>
```

- [ ] **Step 3: navLabels + JSON-LD**

`lib/navLabels.ts`의 `NavKey` 유니온에 `| 'artists'`를 추가하고 7개 로케일 객체 각각에 `artists: '아티스트 후원'`(ko) / `artists: 'Support Artists'`(en 및 나머지 5개는 en 값과 동일)을 넣는다.

`pages/_app.tsx`의 `hasPart` 배열에서 `portfolio` 항목 다음에 추가한다. 이 자리에 빠져 있던 믹싱·마스터링도 같이 채운다(스펙 §11.2에서 발견한 누락):

```tsx
        { '@type': 'SiteNavigationElement', name: labels.mixingMastering, url: `${base}/mixing-mastering` },
        { '@type': 'SiteNavigationElement', name: labels.portfolio, url: `${base}/portfolio` },
        ...(locale === 'ko'
          ? [{ '@type': 'SiteNavigationElement', name: labels.artists, url: `${base}/artists` }]
          : []),
```

- [ ] **Step 4: 타입·기존 테스트 확인**

Run: `npm run type-check && npx jest components/layout`
Expected: PASS. `Header.test.tsx`는 이벤트 구독만 검사하므로 항목 수 변화에 영향받지 않는다

- [ ] **Step 5: 커밋**

```bash
git add components/layout/Header.tsx components/layout/Footer.tsx lib/navLabels.ts pages/_app.tsx
git commit -m "feat(nav): 아티스트 후원 진입점 — 헤더 직결 링크·모바일 퀵링크·푸터·JSON-LD(ko 전용)"
```

---

### Task 4: 아티스트 카드 + 후원 준비 중 콜아웃 컴포넌트

**Files:**
- Create: `components/artists/ArtistCard.tsx`
- Create: `components/artists/ArtistSupportCallout.tsx`
- Test: `components/artists/ArtistCard.test.tsx`

**Interfaces:**
- Consumes: `SupportedArtist`(Task 1), `BaseCard`(`components/ui/BaseCard.tsx`), `ResponsiveImage`, `HeroKakaoCta`
- Produces:
  ```tsx
  <ArtistCard artist={SupportedArtist} locale={Locale} viewProfileLabel={string} />
  <ArtistSupportCallout artist={SupportedArtist} locale={Locale} kakaoUrl={string}
     labels={{ title: string; pending: string; pendingBody: string; pendingLabel: string }} />
  ```
  2차는 `ArtistSupportCallout` 내부만 등급 카드로 바꾼다.

- [ ] **Step 1: 실패하는 테스트**

`components/artists/ArtistCard.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ArtistCard from './ArtistCard';

const artist = {
  slug: 'sample-band', name: '샘플 밴드', portfolioArtist: '샘플 밴드', tagline: '연신내의 기타 팝',
  bio: '', image: '/images/artists/sample-band.jpg', links: {}, supportActive: true,
  taxType: 'withholding' as const, joinedOn: '2026-09-08', updatedOn: '2026-09-08',
};

describe('ArtistCard', () => {
  it('이름·태그라인을 보여주고 아티스트 페이지로 링크한다', () => {
    render(<ArtistCard artist={artist} locale="ko" viewProfileLabel="소개 보기" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ko/artists/sample-band');
    expect(screen.getByText('샘플 밴드')).toBeInTheDocument();
    expect(screen.getByText('연신내의 기타 팝')).toBeInTheDocument();
  });
});
```

framer-motion은 mock하지 않는다 — `components/ui/HubLocaleContentSection.test.tsx`가 BaseCard를 그대로 렌더해 통과하고 있다.

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/artists`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`components/artists/ArtistCard.tsx`:

```tsx
import React from 'react';
import BaseCard from '../ui/BaseCard';
import ResponsiveImage from '../ResponsiveImage';
import type { SupportedArtist } from '../../data/artists';
import type { Locale } from '../../lib/i18n';

interface ArtistCardProps {
  artist: SupportedArtist;
  locale: Locale;
  viewProfileLabel: string;
}

const ArtistCard = ({ artist, locale, viewProfileLabel }: ArtistCardProps) => (
  <BaseCard href={`/${locale}/artists/${artist.slug}`} className="h-full">
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
      <ResponsiveImage
        src={artist.image}
        alt={artist.name}
        pictureClassName="w-full h-full"
        className="w-full h-full object-cover"
        width={640}
        height={480}
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
      />
    </div>
    <div className="p-5">
      <h3 className="typo-card-title text-gray-900 dark:text-white">{artist.name}</h3>
      <p className="typo-card-body mt-1 text-gray-600 dark:text-gray-400">{artist.tagline}</p>
      <span className="mt-3 inline-block text-sm font-medium text-primary dark:text-primary-light">
        {viewProfileLabel} →
      </span>
    </div>
  </BaseCard>
);

export default ArtistCard;
```

`components/artists/ArtistSupportCallout.tsx`:

```tsx
import React from 'react';
import HeroKakaoCta from '../common/HeroKakaoCta';
import type { SupportedArtist } from '../../data/artists';
import type { Locale } from '../../lib/i18n';

interface ArtistSupportCalloutProps {
  artist: SupportedArtist;
  locale: Locale;
  kakaoUrl: string;
  labels: { title: string; pending: string; pendingBody: string; pendingLabel: string };
}

/**
 * 아티스트 페이지의 후원 자리. 1차(결제 없음)는 "준비 중 + 카카오톡" 고정.
 * 2차에서 이 컴포넌트 안에 등급 카드·후원 시작 버튼(bg-primary)이 들어온다 — 페이지는 건드리지 않는다.
 * 카카오 링크는 옐로(배색 규칙)이므로 HeroKakaoCta를 그대로 쓴다.
 */
const ArtistSupportCallout = ({ artist, locale, kakaoUrl, labels }: ArtistSupportCalloutProps) => (
  <div className="glass-card rounded-2xl p-6 md:p-8" aria-labelledby={`support-${artist.slug}`}>
    <h2 id={`support-${artist.slug}`} className="typo-card-title text-gray-900 dark:text-white">
      {labels.title}
    </h2>
    <p className="mt-2 font-semibold text-gray-800 dark:text-gray-100">{labels.pending}</p>
    <p className="mt-1 text-gray-600 dark:text-gray-300">{labels.pendingBody}</p>
    <div className="mt-5">
      <HeroKakaoCta
        locale={locale}
        kakaoUrl={kakaoUrl}
        component="ArtistSupportCallout"
        ctaId={`artist-support-${artist.slug}`}
        label={labels.pendingLabel}
        surface="onSurface"
      />
    </div>
  </div>
);

export default ArtistSupportCallout;
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest components/artists && npm run type-check`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add components/artists
git commit -m "feat(artists): ArtistCard·ArtistSupportCallout(1차: 준비 중 + 카카오)"
```

---

### Task 5: 허브 페이지 `/ko/artists`

**Files:**
- Create: `pages/[locale]/artists/index.tsx`
- Test: `artists-static-props.test.ts` (저장소 루트, 기존 `release-project-static-props.test.ts` 패턴)

**Interfaces:**
- Consumes: Task 1 `getSupportedArtists`, Task 2 `artists.*`, Task 4 `ArtistCard`
- Produces: `getStaticPaths`(ko만), `getStaticProps` → props `{ locale, artists: SupportedArtist[], i18nResources }`

- [ ] **Step 1: 실패하는 테스트**

`artists-static-props.test.ts`:

```ts
/** @jest-environment node */

import { getStaticPaths as getHubPaths, getStaticProps as getHubStaticProps } from './pages/[locale]/artists/index';

describe('artists hub static props', () => {
  it('ko 경로만 생성한다', async () => {
    const result = await getHubPaths({});
    expect(result.paths).toEqual([{ params: { locale: 'ko' } }]);
    expect(result.fallback).toBe(false);
  });

  it('artists 섹션 번역과 아티스트 목록을 포함한다', async () => {
    const result = await getHubStaticProps({ params: { locale: 'ko' } });
    expect('props' in result).toBe(true);
    if (!('props' in result)) return;
    const props = result.props as { artists: unknown[]; i18nResources: Record<string, { common?: Record<string, unknown> }> };
    expect(Array.isArray(props.artists)).toBe(true);
    expect(props.i18nResources.ko?.common?.artists).toBeDefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest artists-static-props.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 페이지 구현**

`pages/[locale]/artists/index.tsx`:

```tsx
import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Heart, Users, Send } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import ArtistCard from '../../../components/artists/ArtistCard';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { getSupportedArtists, type SupportedArtist } from '../../../data/artists';
import type { NextPageWithLayout } from '../../../types';

const FAQSection = dynamic(() => import('../../../components/ui/FAQSection'));
const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));

interface ArtistsHubProps {
  locale: Locale;
  artists: SupportedArtist[];
}

const HOW_ICONS = [Users, Heart, Send];

const ArtistsHub: NextPageWithLayout<ArtistsHubProps> = ({ locale, artists }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const howItems = t('artists.how.items', { returnObjects: true }) as { title: string; body: string }[];
  const faqItems = t('artists.faq.items', { returnObjects: true }) as { question: string; answer: string }[];

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('artists.seo.title')}
        description={t('artists.seo.description')}
        keywords={t('artists.seo.keywords')}
        canonical={`/${locale}/artists`}
        ogImage="/images/og-recording15.webp"
        ogImageAlt={t('artists.hero.imageAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        availableLocales={['ko']}
        webPageType="CollectionPage"
        faqItems={Array.isArray(faqItems) ? faqItems : null}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.artists'), path: `/${locale}/artists` },
        ]}
      />

      <ImageHero
        locale={locale}
        priority
        title={t('artists.hero.title')}
        subtitle={t('artists.hero.subtitle')}
        backgroundImage="/images/recording15.webp"
        imageAlt={t('artists.hero.imageAlt')}
      />

      <Section>
        <SectionHeading title={t('artists.list.title')} />
        {artists.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-300">{t('artists.list.empty')}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <ArtistCard key={artist.slug} artist={artist} locale={locale} viewProfileLabel={t('artists.list.viewProfile')} />
            ))}
          </div>
        )}
      </Section>

      <Section variant="alternate">
        <SectionHeading title={t('artists.how.title')} />
        <ol className="grid gap-6 md:grid-cols-3">
          {(Array.isArray(howItems) ? howItems : []).map((item, i) => {
            const Icon = HOW_ICONS[i] ?? Heart;
            return (
              <li key={item.title} className="glass-card rounded-xl p-6">
                <Icon className="h-6 w-6 text-primary dark:text-primary-light" aria-hidden="true" />
                <h3 className="typo-card-subtitle mt-3 text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{item.body}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      <FAQSection
        items={Array.isArray(faqItems) ? faqItems : []}
        title={t('artists.faq.title')}
        subtitle={t('artists.faq.subtitle')}
        variant="default"
      />

      <ContactCTA
        locale={locale}
        title={t('artists.cta.title')}
        subtitle={t('artists.cta.subtitle')}
        imageSrc="/images/studio2.webp"
        imageAlt={siteConfig.name}
        primaryButtonLabel={t('artists.cta.label')}
      />
    </div>
  );
};

ArtistsHub.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [{ params: { locale: 'ko' } }],
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(
    locale,
    { artists: getSupportedArtists() },
    { revalidate: 86400, i18nSections: ['artists'] },
  );
};

export default ArtistsHub;
```

props는 실제 시그니처와 대조해 두었다: `FAQSection`은 `items·title·subtitle(필수)·variant`, `ImageHero`는 `.webp` 배경, `NextPageWithLayout.hasHero`는 `types/index.ts:13`에 있다.

- [ ] **Step 4: 통과 확인**

Run: `npx jest artists-static-props.test.ts && npm run type-check`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "pages/[locale]/artists/index.tsx" artists-static-props.test.ts
git commit -m "feat(artists): /ko/artists 허브 페이지 — 목록·방식·FAQ·카카오 CTA"
```

---

### Task 6: 아티스트 페이지 `/ko/artists/[slug]`

**Files:**
- Create: `pages/[locale]/artists/[slug].tsx`
- Modify: `artists-static-props.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: Task 1 `getSupportedArtist`·`getArtistPortfolioItems`, Task 4 `ArtistSupportCallout`, `PortfolioMiniCard`
- Produces: `getStaticPaths` → ko × `SUPPORTED_ARTISTS` slug, `getStaticProps` → `{ locale, artist, works: PortfolioItem[] }`

- [ ] **Step 1: 테스트 케이스 추가**

`artists-static-props.test.ts`에 추가:

```ts
import { getStaticPaths as getDetailPaths, getStaticProps as getDetailStaticProps } from './pages/[locale]/artists/[slug]';
import { SUPPORTED_ARTISTS } from './data/artists';

describe('artist detail static props', () => {
  it('등재된 아티스트마다 ko 경로 하나를 만든다', async () => {
    const result = await getDetailPaths({});
    expect(result.paths).toEqual(SUPPORTED_ARTISTS.map((a) => ({ params: { locale: 'ko', slug: a.slug } })));
    expect(result.fallback).toBe(false);
  });

  it('없는 slug는 notFound', async () => {
    const result = await getDetailStaticProps({ params: { locale: 'ko', slug: 'no-such-artist' } });
    expect(result).toEqual({ notFound: true });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest artists-static-props.test.ts`
Expected: FAIL — `[slug]` 모듈 없음

- [ ] **Step 3: 페이지 구현**

`pages/[locale]/artists/[slug].tsx`:

```tsx
import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from '@/lib/lucide-icons';
import SEO from '../../../components/SEO';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import ResponsiveImage from '../../../components/ResponsiveImage';
import PortfolioMiniCard from '../../../components/ui/PortfolioMiniCard';
import ArtistSupportCallout from '../../../components/artists/ArtistSupportCallout';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { SUPPORTED_ARTISTS, getSupportedArtist, getArtistPortfolioItems, type SupportedArtist, type ArtistLinkKey } from '../../../data/artists';
import type { PortfolioItem } from '../../../types/data';
import type { NextPageWithLayout } from '../../../types';

interface ArtistPageProps {
  locale: Locale;
  artist: SupportedArtist;
  works: PortfolioItem[];
}

const LINK_LABELS: Record<ArtistLinkKey, string> = {
  instagram: 'Instagram', youtube: 'YouTube', spotify: 'Spotify', melon: '멜론', bandcamp: 'Bandcamp', site: '공식 사이트',
};

const ArtistPage: NextPageWithLayout<ArtistPageProps> = ({ locale, artist, works }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);
  const links = Object.entries(artist.links) as [ArtistLinkKey, string][];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: artist.name,
    url: `${siteConfig.url}/${locale}/artists/${artist.slug}`,
    image: `${siteConfig.url}${artist.image}`,
    description: artist.tagline,
    sameAs: links.map(([, url]) => url),
  };

  return (
    <div className="overflow-visible">
      <SEO
        locale={locale}
        title={t('artists.detail.shareTitle', { name: artist.name })}
        description={t('artists.detail.metaDescription', { name: artist.name, tagline: artist.tagline })}
        canonical={`/${locale}/artists/${artist.slug}`}
        ogImage={artist.image}
        ogImageAlt={artist.name}
        includeSchema
        schema={schema}
        availableLocales={['ko']}
        webPageType="ProfilePage"
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.artists'), path: `/${locale}/artists` },
          { name: artist.name, path: `/${locale}/artists/${artist.slug}` },
        ]}
      />

      <Section variant="alternate" className="pt-8 pb-12">
        <Link href={`/${locale}/artists`} className="inline-flex items-center gap-1 text-sm text-primary dark:text-primary-light">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('artists.detail.backToList')}
        </Link>
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
          <div className="overflow-hidden rounded-2xl">
            <ResponsiveImage src={artist.image} alt={artist.name} width={800} height={600} priority
              pictureClassName="w-full" className="w-full h-auto object-cover" sizes="(max-width: 1024px) 100vw, 40vw" />
          </div>
          <div>
            <h1 className="typo-section-title text-gray-900 dark:text-white">{artist.name}</h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">{artist.tagline}</p>
            <div className="mt-6 space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline">
              <Markdown options={{ forceBlock: true, overrides: { a: { props: { target: '_blank', rel: 'noopener noreferrer' } } } }}>
                {artist.bio}
              </Markdown>
            </div>
            {links.length > 0 && (
              <div className="mt-6">
                <h2 className="typo-card-subtitle text-gray-900 dark:text-white">{t('artists.detail.linksTitle')}</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {links.map(([key, url]) => (
                    <li key={key}>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                        {LINK_LABELS[key]} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section variant="alternate">
        <div className="max-w-3xl mx-auto">
          <ArtistSupportCallout
            artist={artist}
            locale={locale}
            kakaoUrl={siteConfig.contact.kakaoUrl}
            labels={{
              title: t('artists.detail.supportTitle'),
              pending: t('artists.detail.supportPending'),
              pendingBody: t('artists.detail.supportPendingBody'),
              pendingLabel: t('artists.detail.supportPendingLabel'),
            }}
          />
        </div>
      </Section>

      {works.length > 0 && (
        <Section>
          <SectionHeading title={t('artists.detail.worksTitle')} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {works.slice(0, 8).map((item) => (
              <PortfolioMiniCard key={item.id} item={item} locale={locale} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: SUPPORTED_ARTISTS.map((a) => ({ params: { locale: 'ko', slug: a.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const artist = getSupportedArtist(slug);
  if (!artist) return { notFound: true };
  return buildPageStaticProps(
    locale,
    { artist, works: getArtistPortfolioItems(artist, locale) },
    { revalidate: 86400, i18nSections: ['artists', 'portfolio'] },
  );
};

export default ArtistPage;
```

구현 중 확인할 것:
- 첫 `Section`의 `variant="alternate" className="pt-8 pb-12"`는 히어로 없는 `pages/[locale]/portfolio/[id].tsx:161`과 같은 값이다. 상단이 헤더에 가리면 그 파일의 Breadcrumb 배치를 그대로 따른다.
- `PortfolioItem.productionNotes`는 7개 로케일 전량이 props에 실리면 `__NEXT_DATA__`가 커진다 — `portfolio.tsx:343-351`처럼 `works`를 `{...item, productionNotes: undefined}`로 줄여 넘긴다(`PortfolioMiniCard`는 notes를 쓰지 않는다).

- [ ] **Step 4: 통과 확인**

Run: `npx jest artists-static-props.test.ts && npm run type-check && npm run lint`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "pages/[locale]/artists/[slug].tsx" artists-static-props.test.ts
git commit -m "feat(artists): /ko/artists/[slug] 아티스트 페이지 — 프로필·후원 콜아웃·작업 사례"
```

---

### Task 7: 사이트맵·lastmod·llms.txt 등록

**Files:**
- Modify: `lib/sitemap/routes.js:16-42, 160-193`
- Modify: `next-sitemap.config.js` (`pageImageMap`, `transform` priority)
- Modify: `lib/sitemap/pageLastmod.json` (생성기)
- Modify: `pages/api/llms.ts:190-210`
- Test: `lib/sitemap/routes.test.js` (기존)

- [ ] **Step 1: pageRouteMap + 동적 라우트 lastmod**

`lib/sitemap/routes.js`의 `pageRouteMap`에 추가:

```js
  '/artists': path.join('artists', 'index.tsx'),
```

`getRouteLastmod`의 `/guides/` 분기 다음에 추가(아티스트 페이지는 데이터 파일의 커밋 시각을 lastmod로 쓴다 — portfolio와 같은 방식):

```js
  if (pathWithoutLocale.startsWith('/artists/')) {
    return getSourceLastmod('data/artists/index.ts') || buildTimestamp;
  }
```

- [ ] **Step 2: next-sitemap 이미지·우선순위**

`next-sitemap.config.js`의 `pageImageMap`에 추가:

```js
  '/artists': { url: '/images/og-recording15.webp', title: 'Support Artists - Studio NOL', caption: 'Monthly support for independent artists who recorded at Studio NOL, Seoul.' },
```

`transform`의 priority 0.9 정규식에 `artists`를 넣는다:

```js
    if (routePath.match(/\/(pricing|contact|studio-info|practice-room|wedding-song|voice-acting|cover-video|lesson|release-project|guides|artists)(\/|$)/)) {
```

- [ ] **Step 3: pageLastmod 재생성 + diff 검토**

```bash
npm run generate:page-lastmod
git diff --stat lib/sitemap/pageLastmod.json
git diff lib/sitemap/pageLastmod.json
```

`pages/[locale]/artists/index.tsx` 항목 **하나만** 추가돼야 한다. 다른 라우트의 날짜가 바뀌었다면 `git checkout -- lib/sitemap/pageLastmod.json` 후 artists 항목만 손으로 넣는다. 그 뒤:

```bash
node scripts/generate-page-lastmod.mjs --check
npx jest lib/sitemap/routes.test.js
```

Expected: check 통과, 테스트 PASS

- [ ] **Step 4: llms.txt**

`pages/api/llms.ts`의 `localeKeyPages`에서 `- Portfolio:` 줄 다음에 추가한다. 이 파일은 로케일 공용 템플릿이므로 ko일 때만 넣는다:

```ts
${locale === 'ko' ? `- Support Artists (monthly patronage for artists who recorded here): ${siteUrl}/ko/artists\n` : ''}
```

(템플릿 리터럴 안에서 줄이 비지 않도록 기존 줄 끝의 개행 처리와 맞춘다.)

- [ ] **Step 5: 커밋**

```bash
git add lib/sitemap/routes.js lib/sitemap/pageLastmod.json next-sitemap.config.js pages/api/llms.ts
git commit -m "seo(artists): 사이트맵 라우트·lastmod·이미지·llms.txt 등록"
```

---

### Task 8: 첫 아티스트 등재 (운영자 자료 필요)

**Files:**
- Modify: `data/artists/index.ts` (`SUPPORTED_ARTISTS`)
- Create: `public/images/artists/<slug>.jpg` + 생성물 `public/images/artists/<slug>.webp`, `utils/imageMetadata.json` 갱신

이 태스크는 운영자 입력 없이는 진행할 수 없다. 자료가 없으면 빈 배열인 채로 Task 9로 간다(허브는 `artists.list.empty`를 보여준다).

- [ ] **Step 1: 자료 확보**

운영자에게 받을 것: 아티스트명(포트폴리오 `artist` 문자열과 동일하게), 한 줄 태그라인, 소개 3~5문단(또는 사실 목록), 권리 확인된 사진 1장(가로형, 1200px 이상), SNS·스트리밍 링크, 세금 처리 방식(원천징수/세금계산서), 참여 동의서 서명 여부. 소개 초안은 해당 아티스트의 포트폴리오 `productionNotes.ko`에서 사실만 뽑아 쓰고 운영자 확인을 받는다.

- [ ] **Step 2: 이미지 배치 + 최적화**

```bash
mkdir -p public/images/artists
cp <받은파일> public/images/artists/<slug>.jpg
node scripts/optimizeImages.js
git status --short public/images/artists utils/imageMetadata.json
```

- [ ] **Step 3: 데이터 추가**

`SUPPORTED_ARTISTS`에 항목을 넣는다(값은 전부 Step 1 자료에서):

```ts
export const SUPPORTED_ARTISTS: readonly SupportedArtist[] = [
  {
    slug: '<slug>',
    name: '<아티스트명>',
    portfolioArtist: '<items.ts의 artist 문자열>',
    tagline: '<한 줄>',
    bio: `<문단1>

<문단2>`,
    image: '/images/artists/<slug>.jpg',
    links: { instagram: '<url>' },
    supportActive: false, // 2차 결제 오픈 시 true
    taxType: 'withholding',
    joinedOn: '2026-09-XX',
    updatedOn: '2026-09-XX',
  },
];
```

- [ ] **Step 4: 검증**

```bash
npx jest data/artists artists-static-props.test.ts
npm run dev   # http://localhost:3000/ko/artists 와 /ko/artists/<slug> 를 눈으로 확인 후 종료
```

- [ ] **Step 5: 커밋**

```bash
git add data/artists/index.ts public/images/artists utils/imageMetadata.json
git commit -m "content(artists): <아티스트명> 등재"
```

---

### Task 9: 전체 검증·PR

- [ ] **Step 1: 전체 검증**

```bash
npm run type-check && npm run lint && npm test && npm run build
```

Expected: 전부 통과. 빌드 로그에서 `/ko/artists`가 생성되고 `/en/artists`는 생성되지 않는지 확인.

- [ ] **Step 2: 사이트맵 산출 확인**

```bash
grep -o '<loc>[^<]*artists[^<]*</loc>' public/sitemap*.xml
```

Expected: `/ko/artists`(와 등재 아티스트 페이지)만. 비-ko 경로 없음.

- [ ] **Step 3: PR**

```bash
git push -u origin feat/artist-support-phase1
gh pr create --fill && gh pr merge --auto --squash
```

PR 본문에 스펙 경로와 "결제 없음, 2차는 별도 PR"을 적는다.

---

## 2차·3차 계획

2차(정기결제)와 3차(정산)는 스펙 §5의 준비물(토스 자동결제 계약·통신판매업 신고·세무 확인·아티스트 동의서)이 끝난 뒤 별도 계획 문서로 쓴다. 이 1차 계획은 그 전제 없이 배포할 수 있게 잘라 둔 것이다.
