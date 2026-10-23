# AI 데모 리워크 랜딩 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/ko|en|zh|es|vi|th|uz/ai-demo-rework` 랜딩 페이지를 추가하고, 기존에 스토리로만 팔던 AI 데모 리워크를 가격표·요건·약속·CTA가 있는 상품 표면으로 승격한다.

**Architecture:** `data/aiRework.ts`가 기존 `data/pricing.ts` 상수를 조합해 가격 숫자와 로케일별 라벨을 만든다(새 가격 상수 없음). 페이지는 `getCommonStaticPaths`로 7로케일 프리렌더하고, 카피는 전부 `public/locales/*/common.json`의 `aiDemoRework` 섹션에서 읽는다. 관련 스토리는 이미 `suno-ai-song-rework1`을 포함한 `composition-arrangement` 큐레이션을 재사용한다. 스키마·사이트맵·llms·fact guard는 기존 배선 지점에 추가한다.

**Tech Stack:** Next.js Pages Router, TypeScript, react-i18next, next-sitemap, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-23-ai-demo-to-release-rework-design.md`

## Global Constraints

- **새 가격 상수를 만들지 않는다.** `data/pricing.ts`의 `VOCAL_PACKAGE_PRICE`(250,000) · `MIXING_LEVEL1_PRICE`(200,000) · `MASTERING_SINGLE_PRICE`(100,000) · `ARRANGEMENT_SMALL_PRICE`(500,000) · `ARRANGEMENT_BAND_PRICE`(1,000,000) · `COMPOSITION_PRICE`(500,000) · `SINGLE_BUNDLE_PRICE`(500,000)만 조합한다.
- **가격 숫자를 JSON·JSX에 하드코딩하지 않는다.** `common.json`에는 `{{vocalOnly}}` 같은 플레이스홀더만, 페이지는 `formatPriceLabel(value, locale)` 결과를 interpolation 값으로 넘긴다.
- **7로케일 키 집합·리프 타입이 동일해야 한다.** `content/localeKeyParity.test.ts`가 강제한다.
- **색인 정책:** ko는 색인, en은 `lib/enIndexablePaths.json` 화이트리스트에 넣어 색인, zh·es·vi·th·uz는 기존 정책대로 `noindex, follow`. 페이지 자체는 7로케일 모두 200으로 렌더한다.
- **보장 표현 금지:** 발매·게재·차트·Content ID·신탁 등록을 보장하지 않는다.
- **"AI 곡 아님"은 재작곡·재편곡에만.** 보컬만 리워크(경우 1)는 반드시 "AI-assisted"로 쓴다.
- **음저협 사실:** 2026-08-03 시행 → 2026-08-25 철회 → 10월 현재 보류. "허용/가능"으로 쓰지 않는다.
- 이 페이지는 전화번호를 쓰지 않는다(`%%phone%%` 불필요).
- 커밋은 태스크마다 하나. 메시지는 `feat: ...`.

## Review Focus

1. **무료 플랜 Suno 곡으로 상담하는 방문자** — 페이지가 "접수 불가"를 명확히 말해야 한다. 흐리면 헛걸음 상담이 온다.
2. **"AI 곡 아님"을 읽고 보컬만 리워크를 기대하는 방문자** — 경우 1은 AI 반주가 남는다는 사실이 같은 화면에 있어야 한다.
3. **비-ko 크롤러** — en만 색인되고 나머지는 noindex여야 하며, hreflang은 상호 참조여야 한다.
4. **가격 변경** — `data/pricing.ts` 값이 바뀌면 페이지 카피가 따라와야 한다(하드코딩 금지).
5. **JSON-LD Offer** — 가격이 550,000이고 0원 Offer를 내보내지 않아야 한다.

---

### Task 1: 가격 조합 모듈

**Files:**
- Create: `data/aiRework.ts`
- Test: `data/aiRework.test.ts`

**Interfaces:**
- Consumes: `VOCAL_PACKAGE_PRICE`, `MIXING_LEVEL1_PRICE`, `MASTERING_SINGLE_PRICE`, `ARRANGEMENT_SMALL_PRICE`, `ARRANGEMENT_BAND_PRICE`, `COMPOSITION_PRICE`, `SINGLE_BUNDLE_PRICE`, `formatPriceLabel(value, locale)` (`data/pricing.ts`)
- Produces:
  - `AI_REWORK_VOCAL_ONLY_PRICE: number` (= 550000)
  - `AI_REWORK_ARRANGEMENT_ADD_PRICE: number` (= 500000)
  - `AI_REWORK_BAND_ADD_PRICE: number` (= 1000000)
  - `AI_REWORK_COMPOSITION_ADD_PRICE: number` (= 500000)
  - `AI_REWORK_RELEASE_BUNDLE_PRICE: number` (= 500000)
  - `interface AiReworkPriceLabels { vocalOnly: string; arrangementAdd: string; bandAdd: string; compositionAdd: string; releaseBundle: string }`
  - `getAiReworkPriceLabels(locale: Locale): AiReworkPriceLabels`

- [ ] **Step 1: Write the failing test**

```ts
// data/aiRework.test.ts
import {
  AI_REWORK_VOCAL_ONLY_PRICE,
  AI_REWORK_ARRANGEMENT_ADD_PRICE,
  AI_REWORK_BAND_ADD_PRICE,
  AI_REWORK_COMPOSITION_ADD_PRICE,
  AI_REWORK_RELEASE_BUNDLE_PRICE,
  getAiReworkPriceLabels,
} from './aiRework';

it('composes the published AI rework prices', () => {
  expect(AI_REWORK_VOCAL_ONLY_PRICE).toBe(550000);
  expect(AI_REWORK_ARRANGEMENT_ADD_PRICE).toBe(500000);
  expect(AI_REWORK_BAND_ADD_PRICE).toBe(1000000);
  expect(AI_REWORK_COMPOSITION_ADD_PRICE).toBe(500000);
  expect(AI_REWORK_RELEASE_BUNDLE_PRICE).toBe(500000);
});

it('localizes labels', () => {
  expect(getAiReworkPriceLabels('ko').vocalOnly).toBe('55만원');
  expect(getAiReworkPriceLabels('en').vocalOnly).toBe('₩550,000');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest data/aiRework.test.ts --watchAll=false`
Expected: FAIL — cannot find module `./aiRework`.

- [ ] **Step 3: Implement `data/aiRework.ts`**

`AI_REWORK_VOCAL_ONLY_PRICE = VOCAL_PACKAGE_PRICE + MIXING_LEVEL1_PRICE + MASTERING_SINGLE_PRICE`. The other four are direct aliases of the pricing constants. `getAiReworkPriceLabels` returns `formatPriceLabel(value, locale)` for each field. Do not write numeric literals other than the constant references.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest data/aiRework.test.ts --watchAll=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add data/aiRework.ts data/aiRework.test.ts
git commit -m "feat: add AI rework price composition"
```

---

### Task 2: 7로케일 카피

**Files:**
- Modify: `public/locales/ko/common.json` (add top-level `aiDemoRework` + `nav.aiDemoRework`)
- Modify: `public/locales/{en,zh,es,vi,th,uz}/common.json` (same keys)
- Test: `content/localeKeyParity.test.ts`, `content/i18nKeys.test.ts`

**Interfaces:**
- Produces: `aiDemoRework.{seo,hero,intro,tiers,pricing,requirements,promises,release,rights,faq,cta}` and `nav.aiDemoRework`.

- [ ] **Step 1: Add the ko `aiDemoRework` section verbatim**

```json
"aiDemoRework": {
  "seo": {
    "title": "AI 데모 리워크 — Suno·AI 곡을 발매 음원으로 | 스튜디오 놀",
    "description": "Suno·Udio로 만든 곡, 보컬만 {{vocalOnly}}부터. 사람이 다시 작곡·편곡·녹음해 멜론·스포티파이 발매 음원으로 완성해요. 유료 플랜에서 만든 곡만 접수해요.",
    "keywords": "AI 데모 리워크, Suno 곡 발매, AI 곡 편곡, AI 보컬 녹음, AI티 빼기, AI 곡 재작곡, 수노 발매, AI 음악 발매"
  },
  "hero": {
    "title": "AI 데모 리워크 — AI로 시작한 곡을, 사람이 다시 써서 발매해요",
    "subtitleLine1": "Suno·Udio로 만든 곡은 데모로만 써요",
    "subtitleLine2": "보컬·편곡·작곡을 사람이 다시 하고, 멜론·스포티파이까지 이어요",
    "alt": "스튜디오 놀에서 AI 데모를 발매 음원으로 다시 만드는 작업"
  },
  "intro": {
    "title": "AI티는 세 군데서 나요",
    "body": "음질은 믹싱으로 일부 줄일 수 있지만, 보컬과 구조는 사람이 다시 부르고 다시 짜야 바뀌어요. 어디가 걸리는지에 따라 세 갈래로 나눠 진행해요."
  },
  "tiers": {
    "title": "세 갈래 중 하나로 시작해요",
    "subtitle": "필요한 만큼만. 녹음 전에 반주를 들어 보고 1→2로 올릴지 함께 정해요.",
    "items": [
      { "title": "보컬만 다시 녹음", "description": "AI 반주는 그대로 두고, 실제 목소리로 다시 불러요. 발음·숨·강약을 디렉팅해요.", "priceNote": "{{vocalOnly}}부터" },
      { "title": "반주를 다시 편곡", "description": "AI 버전은 참고만 하고, 코드·구조·소리를 사람이 다시 세워요. 가상악기와 실연 세션을 써요.", "priceNote": "+{{arrangementAdd}}~{{bandAdd}}" },
      { "title": "멜로디·가사부터 재작곡", "description": "탑라인과 가사, 곡 구조를 다시 써요. 공동 작곡 크레딧과 지분은 시작 전에 서면으로 정해요.", "priceNote": "+{{compositionAdd}}" }
    ]
  },
  "pricing": {
    "title": "가격",
    "subtitle": "부가세 포함 정가예요. 필요한 항목만 더해요.",
    "note": "믹싱은 3~7영업일 납품, 수정 2회 포함. 세션 연주비는 연주자에게 드리는 실비만 받고 섭외 수수료는 없어요.",
    "releaseNote": "발매까지 맡기면 싱글 번들 {{releaseBundle}}에 유통 등록과 발매 홍보가 포함돼요. 편곡은 번들에 포함되지 않아 따로 더해져요.",
    "updated": "가격·정책 마지막 확인: 2026년 10월 23일",
    "cta": "카톡으로 상담"
  },
  "requirements": {
    "title": "접수 전에 확인해요",
    "subtitle": "아래 두 가지는 꼭 필요해요.",
    "hardTitle": "필수",
    "hard": [
      "Suno Pro·Premier처럼 유료 플랜에서 만든 곡 (무료 플랜 곡은 나중에 결제해도 소급되지 않아요)",
      "실존 아티스트를 사칭하거나 커버한 곡이 아닐 것"
    ],
    "softTitle": "있으면 좋아요",
    "soft": [
      "보컬을 뺀 반주 파일(WAV) — 없으면 편곡부터 시작해요",
      "원본 AI 버전(멜로디·가사 가이드용)",
      "가사 최종본",
      "생성 계정과 날짜 기록(유통 권리 증빙)"
    ]
  },
  "promises": {
    "title": "약속하는 것과 아닌 것",
    "includedTitle": "하는 일",
    "included": [
      "보컬 재녹음과 디렉팅, 재편곡·재작곡",
      "믹싱·마스터링, 발매할 때 유통 등록과 홍보",
      "작업 기록(데모·가사 수정본·프로젝트 파일) 남기기"
    ],
    "excludedTitle": "약속하지 않는 것",
    "excluded": [
      "스토어 게재와 승인, 차트·스트리밍 수치",
      "Content ID·추천 노출",
      "저작권·신탁 등록 보장"
    ]
  },
  "release": {
    "title": "국내와 해외, 한 번에",
    "body": "멜론·지니·플로와 스포티파이·애플뮤직을 함께 노려요. 유통은 스튜디오 놀이 직접 맡고 중간 수수료는 없어요.",
    "domestic": "국내: 멜론·지니·플로 등",
    "global": "해외: 스포티파이·애플뮤직 등"
  },
  "rights": {
    "title": "권리는 정직하게",
    "body": "재작곡·재편곡한 곡은 사람이 창작한 부분을 중심으로 유통에 올려요. AI 반주를 그대로 쓰는 보컬 리워크는 AI-assisted로 표기해요. AI 사용을 숨기지 않아요.",
    "komca": "음저협의 AI 활용 음악 신탁 기준은 2026년 8월 시행 뒤 같은 달 철회돼, 10월 현재 보류 상태예요."
  },
  "faq": {
    "title": "자주 묻는 질문",
    "items": [
      { "q": "Suno로 만든 곡을 멜론·스포티파이에 발매할 수 있나요?", "a": "유료 플랜에서 만들고 허용된 다운로드를 거친 곡이면 가능해요. 무료 플랜 곡은 소유권이 Suno에 있어 발매할 수 없고, 나중에 결제해도 소급되지 않아요." },
      { "q": "AI티를 없애려면 무엇을 바꿔야 하나요?", "a": "음질은 믹싱으로 일부 줄지만, 보컬과 구조는 사람이 다시 불러야 바뀌어요. 보컬만 다시 녹음할지, 반주를 재편곡할지, 멜로디부터 재작곡할지 상담에서 정해요." },
      { "q": "비용은 얼마인가요?", "a": "보컬만 다시 녹음하면 {{vocalOnly}}부터예요. 재편곡은 {{arrangementAdd}}~{{bandAdd}}, 재작곡은 +{{compositionAdd}}, 발매까지는 싱글 번들 {{releaseBundle}}이 더해져요. 모두 부가세 포함이에요." },
      { "q": "얼마나 걸리나요?", "a": "믹싱은 3~7영업일 안에 납품하고 수정은 2회까지 포함해요. 재편곡·재작곡과 유통 심사 기간은 곡과 스토어에 따라 달라 상담에서 일정을 잡아요." },
      { "q": "유통 책임은 누구에게 있나요?", "a": "유통은 스튜디오 놀이 직접 맡고 중간 수수료는 없어요. 음원과 행정은 스튜디오가 책임지고, 자료를 내지 않거나 빠뜨려 생긴 반려는 아티스트 책임이에요." }
    ]
  },
  "cta": {
    "title": "AI 원본과 원하는 방향을 보내 주세요",
    "body": "어느 플랜에서 만들었는지, 마음에 드는 부분과 걸리는 부분을 함께 알려 주시면 등급과 일정을 바로 잡아 드려요. 상담은 무료예요.",
    "button": "카톡으로 상담"
  }
}
```

Also add `"aiDemoRework": "AI 데모 리워크"` under `nav`.

- [ ] **Step 2: Add the same key tree to the other 6 locales**

Translate values. Keep every `{{placeholder}}` token and every number identical. Do not add claims absent from ko. `nav.aiDemoRework` in en: `"AI Demo Rework"`.

- [ ] **Step 3: Run parity tests**

Run: `npx jest content/localeKeyParity.test.ts content/i18nKeys.test.ts --watchAll=false`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add public/locales
git commit -m "feat: add AI demo rework copy in 7 locales"
```

---

### Task 3: 페이지 + 스키마

**Files:**
- Create: `pages/[locale]/ai-demo-rework.tsx`
- Create: `ai-demo-rework-static-props.test.ts`

**Interfaces:**
- Consumes: `getCommonStaticPaths`, `resolveLocaleParam`, `buildPageStaticProps` (`lib/getStatic.ts`); `getSiteConfig(locale)`; `getAiReworkPriceLabels`, `AI_REWORK_VOCAL_ONLY_PRICE` (`data/aiRework.ts`); `getServiceRelatedStories('composition-arrangement', locale)`; `buildStudioServiceSchema`, `buildSchemaGraph` (`lib/studioServiceSchema.ts`); `generateHowToSchema` (`utils/schema`); `SEO`, `ImageHero` + `HERO_SCRIM_STRONG`, `Section`, `SectionHeading`, `PricingCard`, `BaseCard`, `FAQSection`, `QuickAnswers`, `RelatedStoriesSection`, `ContactCTA`, `createTranslatedHowToSteps`, `createTranslatedQaItems`, `TrackLeadEvent`.
- Produces: default page component with `hasHero = true` and `designEdition = 'v2'`; `getStaticPaths`; `getStaticProps` returning `{ locale, priceLabels, relatedStories }`.

- [ ] **Step 1: Write the failing static-props test**

```ts
// ai-demo-rework-static-props.test.ts
import { getStaticProps } from './pages/[locale]/ai-demo-rework';

it('returns localized price labels and related stories', async () => {
  const result: any = await (getStaticProps as any)({ params: { locale: 'ko' } });
  expect(result.props.locale).toBe('ko');
  expect(result.props.priceLabels.vocalOnly).toBe('55만원');
  expect(result.props.relatedStories.some((s: any) => s.slug === 'suno-ai-song-rework1')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest ai-demo-rework-static-props.test.ts --watchAll=false`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the page**

Mirror `pages/[locale]/composition-arrangement.tsx`:

```ts
const AiDemoRework: NextPageWithLayout<AiDemoReworkProps> = ({ locale, priceLabels, relatedStories }) => {
  const { t: tRaw } = useTranslation('common', { lng: locale });
  const t = React.useCallback((key: string) => tRaw(key, priceLabels), [tRaw, priceLabels]);
  // ...
};

AiDemoRework.hasHero = true;
AiDemoRework.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  return buildPageStaticProps(
    locale,
    {
      priceLabels: getAiReworkPriceLabels(locale),
      relatedStories: getServiceRelatedStories('composition-arrangement', locale),
    },
    { revalidate: 86400, i18nSections: ['aiDemoRework', 'stories'] }
  );
};
export default AiDemoRework;
```

- `SEO` props exactly as composition page: `locale`, `title/description/keywords` from `aiDemoRework.seo`, `ogImage="/images/og-hardware1.webp"`, `ogImageAlt={t('aiDemoRework.hero.alt')}`, `ogImageWidth={1200}`, `ogImageHeight={630}`, `includeSchema`, `canonical={`/${locale}/ai-demo-rework`}`, `faqItems`, `schema={pageSchema}`, `breadcrumbs={[{ name: t('nav.home'), path: `/${locale}` }, { name: t('nav.aiDemoRework'), path: `/${locale}/ai-demo-rework` }]}`, `webPageType="ItemPage"`.
- `pageSchema = buildSchemaGraph(serviceSchema, howToSchema)`:
  - `buildStudioServiceSchema({ locale, siteName, siteUrl, pageUrl, name: t('aiDemoRework.seo.title'), description: t('aiDemoRework.seo.description'), serviceType: locale === 'ko' ? 'AI 데모 리워크·음악 제작' : 'AI Demo Rework & Music Production', offerName: t('aiDemoRework.tiers.items.0.title'), offerPrice: AI_REWORK_VOCAL_ONLY_PRICE, pricingHash: 'arrangement', remote: true })`
  - `generateHowToSchema(t('aiDemoRework.seo.title'), t('aiDemoRework.seo.description'), createTranslatedHowToSteps(t, 'aiDemoRework.tiers.items', 3), undefined, locale)`
- `PricingCard`는 composition 페이지와 동일한 prop 집합을 쓴다. 등급 3장은 다음처럼 매핑한다:
  - `id={`ai-rework-tier-${i}`}`
  - `title={t(`aiDemoRework.tiers.items.${i}.title`)}`
  - `price={t(`aiDemoRework.tiers.items.${i}.priceNote`)}` (unit 생략)
  - `description={t(`aiDemoRework.tiers.items.${i}.description`)}`
  - `ctaLabel={t('aiDemoRework.pricing.cta')}`, `ctaHref={siteConfig.contact.kakaoUrl}`,
    `onCtaClick={() => trackLeadEvent('lead_click_kakao', { locale, component: 'AiDemoReworkPage', cta_id: `ai_demo_rework_tier_${i}_kakao` })}`
- 섹션 순서: hero(`backgroundImage="/images/hardware1.webp"`, `imageAlt={t('aiDemoRework.hero.alt')}`) → intro + 3 `PricingCard` → pricing note/releaseNote/`updated`(작은 회색 텍스트로 마지막 확인일 노출) → requirements(hard/soft) → promises(included/excluded) → release(domestic/global) + rights(+komca) → `QuickAnswers` + `FAQSection` → `RelatedStoriesSection` → `ContactCTA`.
- JSX에 숫자 가격 리터럴을 쓰지 않는다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest ai-demo-rework-static-props.test.ts --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

```bash
npm run type-check
git add "pages/[locale]/ai-demo-rework.tsx" ai-demo-rework-static-props.test.ts
git commit -m "feat: add AI demo rework landing page"
```

---

### Task 4: 헤더·푸터 노출

**Files:**
- Modify: `components/layout/Header.tsx` (production group items)
- Modify: `components/layout/Footer.tsx:131-141`

**Interfaces:**
- Consumes: `nav.aiDemoRework` (Task 2).

- [ ] **Step 1: Add the header item**

In the `production` group, immediately after the `compositionArrangement` item:

```ts
{ label: t('nav.aiDemoRework'), href: `/${locale}/ai-demo-rework` },
```

- [ ] **Step 2: Add the footer link**

In the services `<ul>` (two-column grid), after the `composition-arrangement` `FooterLink`:

```tsx
<FooterLink href={`/${locale}/ai-demo-rework`}>{t('nav.aiDemoRework')}</FooterLink>
```

- [ ] **Step 3: Verify**

Run: `npm run type-check && npx jest content/localeKeyParity.test.ts --watchAll=false`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/layout/Header.tsx components/layout/Footer.tsx
git commit -m "feat: link AI demo rework in navigation"
```

---

### Task 5: 사이트맵·lastmod·en 색인

**Files:**
- Modify: `lib/sitemap/routes.js` (`pageRouteMap`)
- Regenerate: `lib/sitemap/pageLastmod.json`
- Modify: `next-sitemap.config.js` (`pageImageMap` ~line 93, priority regex line 408)
- Modify: `lib/enIndexablePaths.json`

- [ ] **Step 1: Register lastmod source**

Add to `pageRouteMap` next to `/composition-arrangement`:

```js
'/ai-demo-rework': 'ai-demo-rework.tsx',
```

- [ ] **Step 2: Regenerate lastmod**

Run: `npm run generate:page-lastmod`
Expected: `lib/sitemap/pageLastmod.json` gains `/ai-demo-rework`.

- [ ] **Step 3: Add OG image + priority**

Add next to the `/composition-arrangement` entry in `pageImageMap`:

```js
'/ai-demo-rework': { url: '/images/og-hardware1.webp', title: 'Studio NOL AI Demo Rework - from ₩550K', caption: 'Turn a Suno/Udio demo into a release-ready song: human vocal re-record, rearrangement or recomposition, domestic and global distribution.' },
```

Add `ai-demo-rework` to the 0.9-priority regex on line 408.

- [ ] **Step 4: Make en indexable**

Add `"/ai-demo-rework"` to the array in `lib/enIndexablePaths.json`. Do not add other locales — they stay `noindex, follow`.

- [ ] **Step 5: Run guards**

Run: `npx jest lib/sitemap/routes.test.js components/seo/metadataUrls.test.ts --watchAll=false`
Expected: PASS (lastmod coverage, en whitelist reciprocity).

- [ ] **Step 6: Commit**

```bash
git add lib/sitemap/routes.js lib/sitemap/pageLastmod.json next-sitemap.config.js lib/enIndexablePaths.json
git commit -m "feat: register AI demo rework in sitemap and en index"
```

---

### Task 6: llms.txt 상품 사실

**Files:**
- Modify: `lib/llms/priceFacts.ts` (`PRICE_FACTS`)
- Modify: `pages/api/llms.ts` (`Primary Services`)
- Test: `lib/llms/priceFacts.test.ts` (create — file does not exist yet)

**Interfaces:**
- Consumes: `AI_REWORK_VOCAL_ONLY_PRICE`, `AI_REWORK_ARRANGEMENT_ADD_PRICE`, `AI_REWORK_BAND_ADD_PRICE`, `AI_REWORK_COMPOSITION_ADD_PRICE`, `AI_REWORK_RELEASE_BUNDLE_PRICE` (`data/aiRework.ts`); the file's local `krw = formatPriceAmount`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/llms/priceFacts.test.ts
import { PRICE_FACTS } from './priceFacts';
import { AI_REWORK_VOCAL_ONLY_PRICE } from '../../data/aiRework';
import { formatPriceAmount } from '../../data/pricing';

it('lists the AI demo rework with the composed vocal-only price', () => {
  const fact = PRICE_FACTS.find((f) => f.includes('AI Demo Rework'));
  expect(fact).toBeDefined();
  expect(fact).toContain(formatPriceAmount(AI_REWORK_VOCAL_ONLY_PRICE));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/llms/priceFacts.test.ts --watchAll=false`
Expected: FAIL — `fact` undefined.

- [ ] **Step 3: Add the fact and the Primary Services bullet**

Append to `PRICE_FACTS` (use `krw(...)`, never literals):

```ts
`**AI Demo Rework (AI demo → release-ready)**: vocal-only from ${krw(AI_REWORK_VOCAL_ONLY_PRICE)} KRW, VAT included (AI backing kept, real vocal re-recorded); full-band rearrangement +${krw(AI_REWORK_ARRANGEMENT_ADD_PRICE)}–${krw(AI_REWORK_BAND_ADD_PRICE)}; recomposition from topline/lyrics +${krw(AI_REWORK_COMPOSITION_ADD_PRICE)}; release bundle (distribution + PR) +${krw(AI_REWORK_RELEASE_BUNDLE_PRICE)}. Paid Suno/Udio plan tracks only; free-plan tracks are not eligible and upgrades are not retroactive. Human rework of melody/lyrics/arrangement is submitted as human-authored; vocal-only reworks keep AI backing and are disclosed as AI-assisted.`,
```

Add a `Primary Services` bullet in the `BASE_SECTIONS` template in `pages/api/llms.ts`, after the composition/arrangement bullet:

```ts
`- **AI Demo Rework**: AI demo → release-ready song; vocal re-record from ${krw(AI_REWORK_VOCAL_ONLY_PRICE)} KRW, rearrangement, recomposition, domestic + global distribution. Paid-plan AI tracks only. Dedicated page: /ai-demo-rework`
```

Import the composed constants at the top of `pages/api/llms.ts`.

- [ ] **Step 4: Run test**

Run: `npx jest lib/llms/priceFacts.test.ts --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/llms/priceFacts.ts pages/api/llms.ts lib/llms/priceFacts.test.ts
git commit -m "feat: expose AI demo rework in llms facts"
```

---

### Task 7: Fact guard

**Files:**
- Modify: `lib/factGuards.ts` (`FACT_GUARD_RULES`)
- Modify: `content/factGuards.test.ts` (add a focused `describe` block)

**Interfaces:**
- Consumes: `findFactViolations(raw, file, { surface })` (`lib/factGuards.ts`).

- [ ] **Step 1: Write the failing regression test**

Append to `content/factGuards.test.ts`:

```ts
describe('AI 데모 리워크 카피 가드', () => {
  const check = (text: string) => findFactViolations(text, 'fixture', { surface: 'code' });

  it('flags "AI 곡 아님" without a recomposition/rearrangement context', () => {
    expect(check('보컬만 리워크는 AI 곡이 아닙니다').map((v) => v.ruleId))
      .toContain('ai-rework-ai-song-not-ai-claim');
  });

  it('allows "AI 곡 아님" in recomposition/rearrangement copy', () => {
    expect(check('재작곡·재편곡한 곡은 AI 곡이 아닙니다')).toEqual([]);
  });

  it('flags release guarantees', () => {
    expect(check('AI 곡 발매를 보장합니다').map((v) => v.ruleId))
      .toContain('ai-release-guarantee-claim');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest content/factGuards.test.ts --watchAll=false`
Expected: FAIL — two cases produce no violations.

- [ ] **Step 3: Add two rules**

```ts
{
  id: 'ai-rework-ai-song-not-ai-claim',
  description: 'AI 반주를 남기는 보컬 리워크에 "AI 곡 아님" 단정 금지 — 재작곡·재편곡 문맥에서만 허용',
  pattern: /AI\s*곡(?:이|은|도)?\s*(?:아니|아님|아닙니다|아니다)/,
  allow: /재작곡|재편곡/,
},
{
  id: 'ai-release-guarantee-claim',
  description: 'AI 데모 리워크의 발매·게재·차트 보장 표현 금지',
  pattern: /(?:AI[^\n]{0,20}|리워크[^\n]{0,20})(?:발매|게재|차트)[^\n]{0,12}(?:보장해|보장합니다|보장드|100%|반드시)/,
  allow: /보장하지|않/,
},
```

Note: `allow` searches the candidate line + next 2 lines, so the recomposition sentence must keep the qualifier on the same line (the fixture does).

- [ ] **Step 4: Run the full fact-guard suite**

Run: `npx jest content/factGuards.test.ts --watchAll=false`
Expected: PASS — new fixtures pass and existing surfaces (`content/stories`, `public/locales`, `data`, `pages`, `components`) stay clean. If an existing line trips a new rule, fix the copy, not the rule.

- [ ] **Step 5: Commit**

```bash
git add lib/factGuards.ts content/factGuards.test.ts
git commit -m "feat: guard AI rework copy claims"
```

---

### Task 8: 전체 검증

- [ ] **Step 1: Targeted tests**

```bash
npx jest data/aiRework.test.ts ai-demo-rework-static-props.test.ts \
  content/localeKeyParity.test.ts content/i18nKeys.test.ts \
  content/factGuards.test.ts lib/sitemap/routes.test.js \
  components/seo/metadataUrls.test.ts lib/llms/priceFacts.test.ts \
  data/pricing.test.ts lib/serviceRelatedStories.test.ts --watchAll=false
```

Expected: PASS.

- [ ] **Step 2: Type + lint + full suite**

```bash
npm run type-check
npm run lint
npm test -- --watchAll=false
```

Expected: PASS.

- [ ] **Step 3: Build (regenerates sitemap)**

```bash
npm run build
```

Expected: build succeeds; `public/sitemap.xml` contains `/ko/ai-demo-rework` and `/en/ai-demo-rework`, not `/zh|es|vi|th|uz/ai-demo-rework`.

- [ ] **Step 4: Commit generated artifacts if changed**

```bash
git add public/sitemap*.xml public/robots.txt lib/sitemap/pageLastmod.json
git commit -m "chore: regenerate sitemap for AI demo rework"
```

---

## Out of scope (separate plan)

- **마일스톤 분할 결제(50/30/20)**: `db/schema.ts` 새 표, 결제 링크 생성 API, `pages/[locale]/pay/[slug].tsx`, `pay/success.tsx`, 관리자 화면, 잔금 전 유통 등록 차단. 독립 서브시스템이므로 별도 계획으로 작성한다. 그 전까지 랜딩 페이지는 "상담 후 분할 안내"로 운영한다.
