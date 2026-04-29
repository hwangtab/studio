# Studio NOL — Code Review Report

**Date:** 2026-04-27  
**Reviewer:** AI Code Review  
**Scope:** Full-stack review (config, middleware, pages, components, data, API, scripts, tests)  
**Files Reviewed:** 80+ across `pages/`, `components/`, `lib/`, `data/`, `scripts/`, `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `middleware.ts`, `next-sitemap.config.js`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total issues found | **28** |
| Critical (🔴) | **4** |
| High (🟡) | **6** |
| Medium (🟢) | **8** |
| Low (🔵) | **10** |
| Test coverage | **7 test files** for **53+ components** (~13%) |

---

## 🔴 Critical Issues

### 1. CSP `script-src` Allows `'unsafe-inline'` — Negates CSP Value

**File:** `middleware.ts:42`  
**Severity:** HIGH — Security

```ts
"script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net ..."
```

The Content-Security-Policy allows `'unsafe-inline'` for scripts, which makes the entire CSP trivially bypassable. This was likely added to support inline scripts (`theme-init` in `_document.tsx`, GA4 inline config in `_app.tsx`), but it nullifies the security benefit of CSP entirely for script injection attacks.

**Impact:** An XSS vulnerability could inject arbitrary scripts despite CSP protection.

**Recommended Fix:**
- Move `theme-init` to an external script file served from `/scripts/theme-init.js`
- Move GA4 initialization to an external script
- If inline scripts are unavoidable, use nonces or hash-based allowlisting:
  ```ts
  // Hash-based approach
  const scriptHash = createHash('sha256').update(scriptContent).digest('base64');
  `script-src 'self' 'sha256-${scriptHash}' ...`
  ```

---

### 2. `next-sitemap.config.js` Parses TypeScript via Regex — Fragile

**File:** `next-sitemap.config.js:48-68` (`getPortfolioImageMap`)  
**Severity:** HIGH — Reliability

```ts
const idRegex = /"id":\s*"([^"]+)"/g;
const imageRegex = /"image":\s*"([^"]+)"/g;
```

The sitemap build process parses `data/portfolio.ts` as raw text using regex to extract `"id"` and `"image"` pairs. This breaks if:
- Property order changes (e.g., `image` before `id`)
- TypeScript features are added (optional chaining, computed properties)
- Trailing commas or formatting changes affect regex matching
- New properties are inserted between `id` and `image`

**Impact:** Sitemap image metadata silently becomes incorrect on file format changes.

**Recommended Fix:** Use `ts-node` or `eval` with proper TypeScript parsing, or generate a JSON sidecar file during build:
```ts
// scripts/generatePortfolioMeta.js
import { getPortfolioItems } from '../data/portfolio';
const items = getPortfolioItems('ko');
fs.writeFileSync('public/portfolio-meta.json', JSON.stringify(
  items.map(i => ({ id: i.id, image: i.image }))
));
```

---

### 3. `next-sitemap.config.js` `getStoryThumbnail`/`getStoryTitle` Regex Is Fragile

**File:** `next-sitemap.config.js:72-88`  
**Severity:** HIGH — Reliability

```ts
const match = content.match(/^thumbnail:\s*['"]?([^\s'"]+)['"]?/m);
const match = content.match(/^title:\s*"?([^"\n]+)"?/m);
```

YAML frontmatter parsing via regex doesn't handle:
- Multiline values
- Escaped quotes
- Empty values
- Unicode characters in titles
- Leading/trailing whitespace variations

**Impact:** Sitemap entries may have incorrect thumbnails or titles for edge-case frontmatter.

**Recommended Fix:** Use a proper YAML parser (`gray-matter` is already a dependency):
```ts
import matter from 'gray-matter';
const { data } = matter(fs.readFileSync(filePath, 'utf8'));
return data.thumbnail || data.title;
```

---

### 4. `next.config.mjs` `trailingSlash: false` Conflicts with Sitemap Locale Path Expectations

**File:** `next.config.mjs:10`  
**Severity:** MEDIUM — SEO

The sitemap config generates paths like `/ko/about` without trailing slashes, matching `trailingSlash: false`. However, if any middleware rewrite or redirect adds a trailing slash, crawlers may see duplicate content (`/ko/about` vs `/ko/about/`).

**Impact:** Potential duplicate content signals to search engines.

**Recommended Fix:** Ensure consistency across all routing, rewrites, and redirects. Add a canonical redirect in middleware to normalize trailing slashes.

---

## 🟡 High-Priority Issues

### 5. `i18n.server.ts` — Redundant `enableCache` Check

**File:** `lib/i18n.server.ts:17-18`  
**Severity:** LOW — Code Quality

```ts
const cached = enableCache ? commonByLocaleCache[locale] : undefined;
if (cached && enableCache) { // enableCache checked twice
```

The second `enableCache` check is always true when `cached` is truthy (since `cached` is only assigned when `enableCache` is true).

**Fix:** Remove the redundant check:
```ts
if (cached) return cached;
```

---

### 6. `lib/stories.ts` — Multiple Redundant Cache Checks (10+ occurrences)

**File:** `lib/stories.ts`  
**Severity:** LOW — Code Quality

Pattern repeated throughout:
```ts
const cached = enableCache ? cache.get(key) : undefined;
if (cached && enableCache) return cached;
```

The second `enableCache` check is always redundant. This appears in at least 10 functions: `getStoryAvailableLocales`, `resolveStoryFile`, `getAllStorySlugs`, `getAllStories`, `getStoryDetail`, `getStoryPaths`, `getStoryCategoryLabel`, etc.

**Fix:** Standardize to:
```ts
if (enableCache) {
  const cached = cache.get(key);
  if (cached) return cached;
}
```

---

### 7. `_app.tsx` — Two `meta[name="theme-color"]` Tags — Second Overwrites First

**File:** `pages/_app.tsx:148-150`  
**Severity:** MEDIUM — Functionality

```html
<meta name="theme-color" content="#6d28d9" />
<meta name="theme-color" content="#5b21b6" media="(prefers-color-scheme: dark)" />
```

Browsers use the **first** `meta[name="theme-color"]` tag they encounter. The dark-mode media query override never takes effect because the static tag is parsed first. The `theme-init` script in `_document.tsx` attempts to update the theme color via DOM manipulation, but this is a client-side workaround for a server-rendered issue.

**Impact:** Dark mode theme color never applies in mobile browsers (Chrome address bar, Safari tab bar).

**Recommended Fix:** Render only one `meta[name="theme-color"]` tag and let the `theme-init` script (or a React effect) update its `content` attribute based on dark mode state.

---

### 8. `MarkdownRenderer.tsx` — `autoLinkKeywords` Uses Naive String Matching

**File:** `components/MarkdownRenderer.tsx:230-265`  
**Severity:** MEDIUM — Correctness

```ts
const idx = result.indexOf(keyword);
```

Only finds the **first** occurrence of each keyword. If a keyword appears multiple times in the content, only the first is linked. The "inside link" detection heuristic (`before50.includes('[')`) is fragile and can false-positive on legitimate content containing brackets.

**Impact:** Some keywords that should be auto-linked remain unlinked, reducing internal link density.

**Recommended Fix:** Use a proper regex with global matching and a callback-based replacement:
```ts
const sortedKeywords = Object.entries(topicLinks)
  .sort((a, b) => b[0].length - a[0].length);

for (const [keyword, { slug, anchorText }] of sortedKeywords) {
  if (count >= MAX_AUTO_LINKS) break;
  if (slug === currentSlug || linkedSlugs.has(slug)) continue;
  
  const regex = new RegExp(escapeRegex(keyword), 'g');
  result = result.replace(regex, (match, offset) => {
    // Check if inside existing link using offset-based context
    const before = result.slice(Math.max(0, offset - 50), offset);
    const after = result.slice(offset + keyword.length, offset + keyword.length + 50);
    const isInsideLink = (before.match(/\[/g)?.length ?? 0) % 2 === 1 ||
                         (after.match(/\]/g)?.length ?? 0) % 2 === 1;
    if (isInsideLink) return match;
    
    linkedSlugs.add(slug);
    count++;
    return `[${anchorText}](/stories/${slug})`;
  });
}
```

---

### 9. `SEO.tsx` — `currentLocale` Derived from `router.asPath` — Race Condition Risk

**File:** `components/SEO.tsx:78-84`  
**Severity:** MEDIUM — Correctness

```ts
const segments = currentPath.split('/');
let pathWithoutLocale = currentPath;
let currentLocale: Locale = 'ko';

if (locales.includes(segments[1] as Locale)) {
  currentLocale = segments[1] as Locale;
  pathWithoutLocale = '/' + segments.slice(2).join('/');
}
```

`router.asPath` is client-side only. During SSR, `asPath` may be empty or incorrect, causing `currentLocale` to default to `'ko'` even when the page is rendered for another locale. The `pageProps.locale` is available through the component hierarchy but not passed to `SEO`.

**Impact:** Hreflang tags and OG locale may be incorrect during SSR for non-Korean locales.

**Recommended Fix:** Accept `locale` as a prop in `SEO` instead of deriving from `router.asPath`:
```ts
interface SEOProps {
  // ...existing props...
  locale?: Locale;
}

const SEO = ({ locale = 'ko', ...rest }: SEOProps) => {
  const currentLocale = locale;
  // ...
};
```

---

### 10. `contact.tsx` — Google Maps `hl` Param Maps All `zh` to `zh-CN`

**File:** `pages/[locale]/contact.tsx:155`  
**Severity:** LOW — UX

```ts
`&hl=${locale === 'zh' ? 'zh-CN' : locale}`
```

Traditional Chinese users (`zh-TW`, `zh-HK`) get Simplified Chinese maps. While the locale code is `zh` (Simplified Chinese), users from Taiwan or Hong Kong may expect Traditional Chinese.

**Impact:** Minor UX issue for Traditional Chinese users.

**Recommended Fix:** Add a locale-to-map-language mapping:
```ts
const mapLang = { ko: 'ko', en: 'en', zh: 'zh-CN', es: 'es', vi: 'vi', th: 'th', uz: 'en' }[locale] || 'en';
```

---

## 🟢 Medium-Priority Issues

### 11. `next-sitemap.config.js` — `getPortfolioImageMap` Regex Order Dependency

**File:** `next-sitemap.config.js:54-62`  
**Severity:** MEDIUM — Reliability

Relies on `"id"` appearing before `"image"` in the TypeScript source. If a portfolio item has `"image"` before `"id"` (e.g., due to reordering), the mapping silently breaks.

**Fix:** Parse each portfolio item object as a unit rather than matching IDs and images independently.

---

### 12. `lib/stories.ts` — English Fallback Path Inconsistent with `next-sitemap.config.js`

**File:** `lib/stories.ts:73-80` vs `next-sitemap.config.js:72-88`  
**Severity:** MEDIUM — Consistency

- **`lib/stories.ts`** falls back to `${slug}.en.md` for non-default locales
- **`next-sitemap.config.js`** falls back to `${slug}.md` (Korean)

This means the sitemap may point to a different source file than the rendered page.

**Impact:** Thumbnail/title in sitemap may differ from what the user sees.

**Fix:** Use the same fallback logic in both places, or centralize it in a shared utility.

---

### 13. `pages/[locale]/stories/[id].tsx` — `getCTAType` Hash Is Non-Deterministic Across Locales

**File:** `pages/[locale]/stories/[id].tsx:62-82`  
**Severity:** LOW — UX

The hash function uses `charCodeAt` which is locale-independent, so the same slug always gets the same CTA type. However, the CTA labels it references are locale-dependent, which may produce mismatched labels if the locale's CTA copy is incomplete.

**Fix:** Ensure all locales have complete CTA copy, or add a fallback to Korean.

---

### 14. `data/portfolio.ts` — `t()` Helper Returns `en` Before `ko`

**File:** `data/portfolio.ts:6`  
**Severity:** LOW — Consistency

```ts
return dict[locale] || dict['en'] || dict['ko'];
```

For missing locales, English is preferred over Korean. This may not match the site's `ko`-as-default expectation.

**Fix:** Change fallback order to `dict[locale] || dict['ko'] || dict['en']` if Korean should be the ultimate fallback.

---

### 15. `lib/getStatic.ts` — Unsafe Type Assertion

**File:** `lib/getStatic.ts:36`  
**Severity:** MEDIUM — Type Safety

```ts
extraProps: TProps = {} as TProps,
```

The `as TProps` assertion bypasses TypeScript's type checking. If `extraProps` is omitted, `{}` is passed as `TProps`, which may cause runtime type mismatches.

**Fix:** Use a default value that matches `TProps`:
```ts
extraProps: TProps = {} as unknown as TProps,
```
Or better, restructure to avoid the assertion:
```ts
export const buildPageStaticProps = <TProps extends Record<string, unknown>>(
  localeParam: unknown,
  options: BuildPageStaticPropsOptions & { extraProps?: TProps } = {}
) => {
  const baseProps = getI18nStaticProps(localeParam, options.i18nSections);
  return {
    props: { ...baseProps, ...options.extraProps },
    ...(typeof options.revalidate === 'number' ? { revalidate: options.revalidate } : {}),
  };
};
```

---

### 16. `Layout.tsx` — Hardcoded Default Header Height

**File:** `components/Layout.tsx:20`  
**Severity:** LOW — Correctness

```ts
const [headerHeight, setHeaderHeight] = useState(80);
```

The default `80`px header height is hardcoded. If the header CSS changes, the `paddingTop` offset will be wrong until the `ResizeObserver` fires.

**Fix:** Use `0` as default and rely on `ResizeObserver`, or use CSS `calc()` for the offset:
```css
.page-main {
  padding-top: calc(var(--header-height, 80px));
}
```

---

### 17. `pages/[locale]/index.tsx` — Duplicate FAQ Content

**File:** `pages/[locale]/index.tsx:178-180`  
**Severity:** LOW — SEO

Both `FAQSection` and `QuickAnswers` receive the same `faqData`, causing duplicate FAQ content on the home page. This is likely intentional for UX (different visual treatments), but it creates duplicate content signals for search engines.

**Fix:** Use `FAQPage` schema on only one section, or use `display: none` for the duplicate section (not recommended), or accept the duplication as a UX-vs-SEO tradeoff.

---

### 18. `middleware.ts` — Overly Restrictive `Permissions-Policy`

**File:** `middleware.ts:54`  
**Severity:** LOW — Future-proofing

```ts
'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
```

The policy blocks device sensors (usb, magnetometer, gyroscope, accelerometer) that may be needed for future features (e.g., AR studio tours, device orientation features).

**Fix:** Remove sensor permissions from the default policy, or document which sensors are intentionally blocked and why.

---

## 🔵 Low-Priority / Code Quality Issues

### 19. Test Coverage Is Sparse

**Files:** 7 test files for 53+ components  
**Severity:** LOW — Maintainability

| Test File | Coverage |
|-----------|----------|
| `SEO.test.tsx` | SEO component (partial) |
| `MarkdownRenderer.test.tsx` | MarkdownRenderer (partial) |
| `ResponsiveImage.test.tsx` | ResponsiveImage |
| `useAudioPlayer.test.tsx` | AudioPlayer hook |
| `middleware.test.ts` | Middleware redirects |
| `send-email.test.ts` | Contact API (partial) |
| `localDataUtils.test.ts` | Utility functions |

**Missing tests for:**
- `Layout`, `Header`, `Footer` (critical UI components)
- `Contact`, `Portfolio`, `StoriesPage`, `StoryDetailPage` (core pages)
- API routes: `llms.ts`, `llms-full.ts`, `manifest.ts`, `rss.ts`, `og/story.tsx`
- `lib/stories.ts` (complex parsing logic)
- `lib/i18n.server.ts` (resource loading)

**Recommended:** Add tests for the most critical paths first:
1. `lib/stories.ts` — thin content detection, file resolution
2. `components/SEO.tsx` — hreflang, canonical, schema generation
3. `pages/[locale]/contact.tsx` — form validation, submission flow

---

### 20. `next-sitemap.config.js` Is a 400+ Line Monolith

**File:** `next-sitemap.config.js`  
**Severity:** LOW — Maintainability

Combines sitemap generation, thin-content detection, portfolio parsing, story parsing, and hreflang logic in one file. Should be split:
- `lib/sitemap-generator.ts` — sitemap entry generation
- `lib/thin-content.ts` — thin content detection logic (already partially in `lib/stories.ts`)
- `lib/story-metadata.ts` — thumbnail/title extraction

---

### 21. `scripts/` Directory Has 40 Files with Significant Duplication

**Directory:** `scripts/`  
**Severity:** LOW — Maintainability

Multiple "boost" and "fix" scripts share similar file-scanning and text-replacement patterns. Consider a shared utility library:
```ts
// scripts/lib/file-processor.ts
export function processMarkdownFiles(
  directory: string,
  pattern: RegExp,
  transformer: (content: string, filePath: string) => string
): void { ... }
```

---

### 22. `data/portfolio.ts` Is 1,193 Lines

**File:** `data/portfolio.ts`  
**Severity:** LOW — Maintainability

Contains all portfolio items, audio tracks, categories, and production notes across 7 locales. Should be split:
- `data/portfolio/items.ts` — portfolio items
- `data/portfolio/tracks.ts` — audio tracks
- `data/portfolio/categories.ts` — categories

---

### 23. `lib/stories.ts` — `storyCategoryKeyMap` Has 40+ Entries

**File:** `lib/stories.ts:156-200`  
**Severity:** LOW — Maintainability

The category normalization map is large and unmaintained. Consider migrating to a proper i18n-based category registry in `data/faq.ts` or a new `data/categories.ts`.

---

### 24. `MarkdownRenderer.tsx` — `STATIC_OVERRIDES` Recreated on Every Render

**File:** `components/MarkdownRenderer.tsx:120-250`  
**Severity:** LOW — Performance

Although `React.useMemo` is used, the `overrides` memo depends on `[currentLocale]`, causing full re-creation on locale change. The static overrides (h1-h4, p, ul, ol, etc.) never change and should be truly static.

**Fix:** Split into truly static overrides and locale-dependent overrides:
```ts
const STATIC_OVERRIDES = { /* ... */ };

const MarkdownRenderer = ({ content, locale = 'ko', currentSlug }) => {
  const currentLocale = locale;
  const localeOverrides = React.useMemo(() => ({
    a: { /* locale-dependent link handling */ },
  }), [currentLocale]);

  const overrides = React.useMemo(() => ({
    ...STATIC_OVERRIDES,
    ...localeOverrides,
  }), [localeOverrides]);
  // ...
};
```

---

### 25. `pages/[locale]/stories/[id].tsx` — Korean Word Count Underestimates

**File:** `pages/[locale]/stories/[id].tsx:93-97`  
**Severity:** LOW — Accuracy

```ts
const wordCount = plainText.split(/\s+/).filter(Boolean).length;
```

For Korean text, `split(/\s+/)` counts each word (Korean has no spaces between words in the same way English does). The word count for Korean articles will be artificially low when measured in "words."

**Fix:** For Korean, count characters instead:
```ts
const wordCount = locale === 'ko'
  ? plainText.replace(/\s+/g, '').length  // character count
  : plainText.split(/\s+/).filter(Boolean).length;  // word count
```

---

### 26. `next.config.mjs` — `compress: true` Is Redundant

**File:** `next.config.mjs:8`  
**Severity:** TRIVIAL — Clarity

`compress: true` is the Next.js default. Remove for clarity.

---

### 27. `tailwind.config.ts` — Custom Typography Utilities Use Nested `.dark &` Selectors

**File:** `tailwind.config.ts:56-150`  
**Severity:** LOW — Compatibility

The `.dark &` nesting inside `addComponents` may not work as expected in all Tailwind versions. Should use `dark:` variant syntax:
```ts
addComponents({
  '.typo-section-title': {
    fontSize: '1.5rem',
    '@media (prefers-color-scheme: dark)': {
      color: theme('colors.gray.200'),
    },
  },
})
```

---

### 28. `middleware.test.ts` — Dynamic Imports Are Slow and Fragile

**File:** `middleware.test.ts`  
**Severity:** LOW — Test Quality

Each test case dynamically imports the middleware module via `await import('./middleware')`, which re-runs all top-level code (including `parseCanonicalSiteUrl`, `BOT_PATTERN` compilation, etc.). This is slow and can cause subtle state leakage between test cases.

**Fix:** Mock the middleware dependencies and test the middleware function directly, or use a shared setup that imports once:
```ts
// middleware.test.ts
import { middleware } from './middleware';

// Mock dependencies once
jest.mock('./lib/i18n-config', () => ({
  defaultLocale: 'ko',
  locales: ['ko', 'en', 'zh'],
}));

describe('middleware', () => {
  // Tests use middleware directly without dynamic import
});
```

---

## ✅ What's Done Well

1. **i18n architecture** is well-designed with locale-specific resource loading, section-based partial loading (common.json 77KB → 3-10KB per page), and proper fallback chains (`locale → en → ko`).

2. **SEO implementation** is comprehensive: hreflang tags, JSON-LD structured data (Schema.org), Open Graph, Twitter Cards, sitemap with images, robots.txt, llms.txt/llms-full.txt for AI crawlers.

3. **Security headers** are well-configured: CSP (despite `'unsafe-inline'`), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

4. **Contact form API** has robust security: honeypot field, CSRF origin validation, dual-tier rate limiting (Vercel KV + in-memory fallback), input sanitization via `validator` library, 12-second timeout on EmailJS.

5. **Performance optimizations** are thoughtful: dynamic imports for below-fold components (`ReviewSection`, `QuickAnswers`, `FAQSection`, `ContactCTA`), deferred Pretendard font loading (3s after `window.load`), lazy GA4 loading, response caching with ISR revalidation.

6. **Thin-content detection** is sophisticated: AUTO-EXPAND boilerplate stripping via regex, shortcode character estimation (`%%online-fallback%%` = 120 chars, `%%session-checklist%%` = 420 chars), region hub exemptions, 1500-character threshold.

7. **Bot detection** is centralized (`lib/bot-detection.ts`) with 30+ bot patterns, clear review cadence note ("quarterly, or when a new major AI/search bot emerges"), and last-updated timestamp.

8. **Region redirect system** is well-architected: 400+ city/district slugs mapped to 18 provincial hubs via `regionRedirectMap.json`, 308 redirects in middleware, thin-content exclusion for non-hub region pages.

---

## Recommended Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | #1 CSP `'unsafe-inline'` | Medium | HIGH (security) |
| P0 | #3 Story thumbnail regex | Low | HIGH (reliability) |
| P1 | #7 theme-color duplicate | Low | MEDIUM (UX) |
| P1 | #9 SEO locale race condition | Low | MEDIUM (SEO) |
| P1 | #15 Unsafe type assertion | Low | MEDIUM (type safety) |
| P2 | #12 Fallback path inconsistency | Low | MEDIUM (consistency) |
| P2 | #8 autoLinkKeywords naive matching | Medium | MEDIUM (SEO) |
| P3 | #19 Add critical tests | High | LOW (maintainability) |
| P3 | #20 Split sitemap monolith | Medium | LOW (maintainability) |

---

## Files Requiring Attention

| File | Issues | Priority |
|------|--------|----------|
| `middleware.ts` | #1, #18 | P0 |
| `next-sitemap.config.js` | #2, #3, #4, #11, #12 | P0-P1 |
| `pages/_app.tsx` | #7 | P1 |
| `components/SEO.tsx` | #9 | P1 |
| `components/MarkdownRenderer.tsx` | #8, #24 | P1-P3 |
| `lib/stories.ts` | #6, #12, #23 | P2-P3 |
| `lib/i18n.server.ts` | #5 | P3 |
| `lib/getStatic.ts` | #15 | P2 |
| `pages/[locale]/contact.tsx` | #10 | P3 |
| `pages/[locale]/stories/[id].tsx` | #13, #25 | P3 |
| `data/portfolio.ts` | #14, #22 | P3 |
| `components/Layout.tsx` | #16 | P3 |
| `pages/[locale]/index.tsx` | #17 | P3 |
| `tailwind.config.ts` | #27 | P3 |
| `middleware.test.ts` | #28 | P3 |
