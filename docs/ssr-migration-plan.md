# Studio NOL: Static Export → Vercel SSR Migration Plan

> **Status**: Implemented
> **Created**: 2026-02-08
> **Scope**: Remove `output: 'export'`, enable SSR/ISR, activate API routes, add middleware, optimize images

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Phase 1 — Core Switch](#2-phase-1--core-switch)
3. [Phase 2 — Middleware + Redirect Cleanup](#3-phase-2--middleware--redirect-cleanup)
4. [Phase 3 — Image Optimization](#4-phase-3--image-optimization)
5. [Phase 4 — ISR + Final Cleanup](#5-phase-4--isr--final-cleanup)
6. [Gotchas & Considerations](#6-gotchas--considerations)
7. [Complete File Change List](#7-complete-file-change-list)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Current Architecture Summary

### Build & Deployment

| Setting | Current Value | Problem |
|---------|--------------|---------|
| `next.config.mjs` → `output` | `'export'` | Generates static HTML in `out/`; disables SSR, API routes, middleware, and `next/image` optimization |
| `next.config.mjs` → `images.unoptimized` | `true` | Skips Next.js image optimization pipeline entirely |
| `next.config.mjs` → `headers()` | Commented out | Incompatible with `output: 'export'`; security headers moved to `vercel.json` |
| `vercel.json` | Security + cache headers | Works, but should live in `next.config.mjs` for SSR mode |
| `middleware.ts` | Does not exist | No server-side locale detection; relies on client-side redirects |

### Page Structure

**Root-level pages** (11 files) — all are client-side redirects:

```
pages/index.tsx              → useEffect + router.replace(`/${locale}`)
pages/about.tsx              → useEffect + router.replace(`/${locale}/about`)
pages/contact.tsx            → useEffect + router.replace(`/${locale}/contact`)
pages/portfolio.tsx          → useEffect + router.replace(`/${locale}/portfolio`)
pages/portfolio/[id].tsx     → useEffect + router.replace(`/${locale}/portfolio/${id}`)
pages/pricing.tsx            → useEffect + router.replace(`/${locale}/pricing`)
pages/lesson.tsx             → useEffect + router.replace(`/${locale}/lesson`)
pages/practice-room.tsx      → useEffect + router.replace(`/${locale}/practice-room`)
pages/studio-info.tsx        → useEffect + router.replace(`/${locale}/studio-info`)
pages/stories/index.tsx      → useEffect + router.replace(`/${locale}/stories`)
pages/stories/[id].tsx       → useEffect + router.replace(`/${locale}/stories/${id}`)
```

All use `getClientLocale()` from `utils/localeUtils.ts` for browser language detection.

**Locale pages** (`pages/[locale]/*`) — all actual content pages use `getStaticPaths` + `getStaticProps` with `fallback: false`.

### API Routes

- `pages/api/contact/send-email.ts` — EmailJS integration with Vercel KV rate limiting + honeypot validation
- **Currently non-functional** because `output: 'export'` disables all API routes

### i18n

- 7 locales: `ko`, `en`, `zh`, `es`, `vi`, `th`, `uz` (default: `ko`)
- `i18next-http-backend` loads translations from `/locales/{lng}/common.json`
- Korean translations bundled inline; other locales loaded via HTTP

### Image Pipeline

- `scripts/optimizeImages.js` (prebuild): Sharp-based JPG/PNG → WebP/AVIF conversion
- Generates `utils/imageMetadata.json` for dimension hints
- `ResponsiveImage.tsx` wraps `next/image` with manual `<picture>` + `<source>` WebP fallback
- With `unoptimized: true`, `next/image` does **no** server-side optimization

---

## 2. Phase 1 — Core Switch

> **Risk**: High (fundamental deployment change)
> **Prerequisite**: None
> **Rollback**: Revert the 3 file changes below

### Step 1-1. Add `/out` to `.gitignore`

**File**: `.gitignore`

The `out/` directory (static export output) has leaked into git tracking. SSR mode does not produce `out/`.

```diff
 # production
 /build
+/out
```

Then remove `out/` from git tracking:

```bash
git rm -r --cached out/
```

### Step 1-2. Remove `output: 'export'` from `next.config.mjs`

**File**: `next.config.mjs`

```diff
 const nextConfig = {
   reactStrictMode: true,
   swcMinify: true,
   compress: true,
-  output: 'export',

   images: {
-    unoptimized: true,
+    unoptimized: true,  // Keep for now — removed in Phase 3
     remotePatterns: [
```

Remove only the `output: 'export'` line. Keep `unoptimized: true` for now (Phase 3 handles it).

### Step 1-3. Migrate security headers to `next.config.mjs`

**File**: `next.config.mjs` — add `async headers()` function

```js
const nextConfig = {
  // ... existing settings ...

  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net https://fastly.jsdelivr.net; connect-src 'self' https://api.emailjs.com;",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};
```

**File**: `vercel.json` — clear to avoid duplicate headers

```json
{}
```

### Step 1-4. Verify API route restoration

**File**: `pages/api/contact/send-email.ts` — **no code changes needed**

Removing `output: 'export'` automatically enables API routes. Verify these environment variables exist in Vercel dashboard:

- `EMAILJS_SERVICE_ID`
- `EMAILJS_TEMPLATE_ID`
- `EMAILJS_PUBLIC_KEY`
- `EMAILJS_PRIVATE_KEY`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

---

## 3. Phase 2 — Middleware + Redirect Cleanup

> **Risk**: Medium (depends on middleware correctness)
> **Prerequisite**: Phase 1 complete
> **Can run in parallel with**: Phase 3
> **Rollback**: Delete `middleware.ts`, restore deleted files from git

### Step 2-1. Create `middleware.ts`

**File**: `middleware.ts` (project root, new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'ko';

function getPreferredLocale(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get('accept-language');
  if (!acceptLanguage) return defaultLocale;

  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [code, quality] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(),
        quality: quality ? parseFloat(quality) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { code } of languages) {
    if (locales.includes(code as Locale)) {
      return code as Locale;
    }
  }
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if path already has a locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (pathnameHasLocale) return NextResponse.next();

  // Redirect to locale-prefixed path
  const locale = getPreferredLocale(request);
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(newUrl, 307);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap.*\\.xml|locales|images|logo.*|audio|styles).*)',
  ],
};
```

**Design decisions**:
- `307 Temporary Redirect` — locale preference changes with browser settings
- `Accept-Language` header replaces client-side `getClientLocale()`
- `matcher` excludes static resources: `/images`, `/locales`, `/audio`, `/styles`, `/logo*`

### Step 2-2. Delete root-level redirect pages

**Delete these 11 files** (all are `useEffect` + `router.replace()` redirects):

```
pages/index.tsx
pages/about.tsx
pages/contact.tsx
pages/portfolio.tsx
pages/portfolio/[id].tsx
pages/pricing.tsx
pages/lesson.tsx
pages/practice-room.tsx
pages/studio-info.tsx
pages/stories/index.tsx
pages/stories/[id].tsx
```

**Also delete**:
- `utils/localeUtils.ts` — `getClientLocale()` is only used by the deleted redirect pages

**Also remove empty directories**:
- `pages/portfolio/` (root level, NOT `pages/[locale]/portfolio/`)
- `pages/stories/` (root level, NOT `pages/[locale]/stories/`)

**Do NOT delete**:
- `pages/404.tsx` — custom 404 page (keep)
- `pages/_app.tsx` — app layout (keep)
- `pages/_document.tsx` — document config (keep)
- `pages/api/` — API routes (keep)
- `pages/[locale]/` — actual content pages (keep)

> **Safety tip**: Delete `pages/index.tsx` last, after verifying middleware works. If middleware fails, `/` would return 404 without this file.

### Step 2-3. Update `next-sitemap.config.js`

**File**: `next-sitemap.config.js`

Root pages no longer exist, so simplify the exclude list:

```js
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://studionol.co.kr',
  generateRobotsTxt: true,
  alternateRefs: [
    { href: 'https://studionol.co.kr/ko', hreflang: 'ko' },
    { href: 'https://studionol.co.kr/en', hreflang: 'en' },
    { href: 'https://studionol.co.kr/zh', hreflang: 'zh' },
    { href: 'https://studionol.co.kr/es', hreflang: 'es' },
    { href: 'https://studionol.co.kr/vi', hreflang: 'vi' },
    { href: 'https://studionol.co.kr/th', hreflang: 'th' },
    { href: 'https://studionol.co.kr/uz', hreflang: 'uz' },
  ],
  exclude: ['/api/*', '/404'],
};
```

---

## 4. Phase 3 — Image Optimization

> **Risk**: Medium (affects all pages with images)
> **Prerequisite**: Phase 1 complete
> **Can run in parallel with**: Phase 2
> **Rollback**: Restore `unoptimized: true` and revert `ResponsiveImage.tsx`

### Step 3-1. Remove `unoptimized: true`

**File**: `next.config.mjs`

```diff
 images: {
-  unoptimized: true,
   remotePatterns: [
     // ... keep all 7 existing patterns ...
   ],
   minimumCacheTTL: 31536000,
   formats: ['image/avif', 'image/webp'],
 },
```

**Effect**: `next/image` now serves images through `/_next/image` with automatic format conversion, resizing, and lazy loading.

### Step 3-2. Simplify `ResponsiveImage.tsx`

**File**: `components/ResponsiveImage.tsx`

With server-side image optimization active, the manual `<picture>` + `<source srcSet={webpSrc}>` wrapper is redundant. `next/image` automatically serves the optimal format.

**Remove**:
- `showWebpSource`, `webpSrc`, `isModernFormat` computed values
- `<picture>` + `<source>` wrapper logic

**Keep**:
- `normalizeSrc()` utility
- Error state + fallback image logic
- `fill` vs `width/height` mode branching
- `containerClassName`, `pictureClassName` props for backward compatibility

After the change, the component renders `<Image>` directly without a `<picture>` wrapper.

### Step 3-3. Other image components — no changes needed

These components already use `next/image` directly and will automatically benefit:

| Component | Usage |
|-----------|-------|
| `components/MarkdownRenderer.tsx` | Renders markdown images with `imageMetadata.json` dimensions |
| `components/layout/Header.tsx` | Logo image with `priority` |
| `components/AudioPlayer/Playlist.tsx` | Album artwork thumbnails |

### Step 3-4. Keep the `prebuild` image optimization script

**File**: `scripts/optimizeImages.js`

Even with server-side optimization active, this script is still needed:
1. `utils/imageMetadata.json` — used by `MarkdownRenderer` for width/height hints
2. Pre-converted `.webp` files — referenced directly in code (e.g., `backgroundImage: "/images/hardware5.webp"`)

The `prebuild` hook in `package.json` continues to run before `build`.

---

## 5. Phase 4 — ISR + Final Cleanup

> **Risk**: Low (additive change, no breaking behavior)
> **Prerequisite**: Phases 1-3 complete
> **Rollback**: Remove `revalidate` and revert `fallback` changes

### Step 4-1. Add `revalidate` to pages

Since all data currently lives in local TypeScript/markdown files, ISR benefits are limited now but prepare for future CMS/API integration.

| Page | `revalidate` | `fallback` change | Rationale |
|------|-------------|-------------------|-----------|
| `[locale]/index.tsx` | `3600` (1h) | Keep `false` | Home page — moderate update frequency |
| `[locale]/about.tsx` | `86400` (24h) | Keep `false` | Rarely changes |
| `[locale]/portfolio.tsx` | `3600` (1h) | Keep `false` | New items added periodically |
| `[locale]/portfolio/[id].tsx` | `3600` (1h) | → `'blocking'` | New items served without rebuild |
| `[locale]/stories/index.tsx` | `1800` (30m) | Keep `false` | Stories added more frequently |
| `[locale]/stories/[id].tsx` | `3600` (1h) | → `'blocking'` | New stories served without rebuild |
| `[locale]/pricing.tsx` | `86400` (24h) | Keep `false` | Prices rarely change |
| `[locale]/studio-info.tsx` | `86400` (24h) | Keep `false` | Equipment info rarely changes |
| `[locale]/contact.tsx` | — | — | No data fetching |
| `[locale]/lesson.tsx` | — | — | No data fetching |
| `[locale]/practice-room.tsx` | — | — | No data fetching |

**Example change** — `pages/[locale]/stories/[id].tsx`:

```diff
 export const getStaticPaths: GetStaticPaths = async () => {
   return {
     paths: getStoryPaths(),
-    fallback: false,
+    fallback: 'blocking',
   };
 };

 export const getStaticProps: GetStaticProps = async ({ params }) => {
   // ... existing code ...
   return {
     props: { locale, story, relatedStories },
+    revalidate: 3600,
   };
 };
```

**Example change** — `pages/[locale]/index.tsx`:

```diff
 export const getStaticProps: GetStaticProps = async ({ params }) => {
   // ... existing code ...
   return {
     props: { locale, homeData, faqData, reviewsData },
+    revalidate: 3600,
   };
 };
```

### Step 4-2. Verify `fallback: 'blocking'` compatibility

Both dynamic route pages already handle missing items correctly:

- `portfolio/[id].tsx` line 172: `if (!item) { return { notFound: true }; }`
- `stories/[id].tsx` line 203: `catch (error) { return { notFound: true }; }`

Both pages also check `router.isFallback`, but with `fallback: 'blocking'`, `isFallback` is always `false` (it's only `true` with `fallback: true`). **No changes needed**.

### Step 4-3. Final cleanup

1. Confirm `utils/localeUtils.ts` is deleted (from Phase 2)
2. Confirm `pages/portfolio/` and `pages/stories/` empty directories are removed
3. Verify `postbuild: "next-sitemap"` works in SSR mode
4. Confirm Vercel project settings: Framework Preset = "Next.js", Build Command = `npm run build`

---

## 6. Gotchas & Considerations

### i18n translation file loading
`lib/i18n.ts` uses `loadPath: '/locales/{{lng}}/{{ns}}.json'` which loads from `public/locales/`. This works identically in SSR mode since `public/` files are served statically. The middleware `matcher` must exclude `/locales` (already handled in Step 2-1).

### `_document.tsx` getInitialProps
`_document.tsx` extracts locale from `ctx.query.locale`. This works the same way in SSR mode with Pages Router. **No changes needed**.

### `prebuild` image script + SSR
`scripts/optimizeImages.js` writes to `public/images/`. Vercel's build pipeline runs `prebuild` before `build`, so generated WebP/AVIF files are available at build time. **No compatibility issues**.

### CSP `connect-src`
The `/_next/image` optimization endpoint runs server-side, so no CSP changes needed. Client requests to `/_next/image?url=...` are covered by `'self'`.

### Vercel KV connection
The API route uses `@vercel/kv` for rate limiting. Ensure KV Storage is linked to the Vercel project. If `KV_REST_API_URL` and `KV_REST_API_TOKEN` are missing, the code falls back to in-memory rate limiting (not shared across serverless instances).

### URL compatibility
Static export may have served URLs with `.html` extensions (e.g., `/ko/about.html`). SSR mode uses clean URLs (`/ko/about`). Vercel automatically handles `.html` extension requests, so **no redirects needed**.

### `out/` directory
SSR builds output to `.next/` instead of `out/`. After adding `/out` to `.gitignore` and running `git rm -r --cached out/`, the tracked `out/` files will be cleaned up.

---

## 7. Complete File Change List

### Modified (6 files)

| File | Changes |
|------|---------|
| `next.config.mjs` | Remove `output: 'export'`; add `async headers()` function; remove `unoptimized: true` (Phase 3) |
| `vercel.json` | Replace contents with `{}` (headers moved to next.config) |
| `.gitignore` | Add `/out` |
| `components/ResponsiveImage.tsx` | Remove `<picture>` + `<source>` WebP wrapper |
| `next-sitemap.config.js` | Simplify `exclude` list to `['/api/*', '/404']` |
| 8 pages under `pages/[locale]/` | Add `revalidate` to `getStaticProps`; change `fallback` to `'blocking'` for 2 dynamic routes |

### Created (1 file)

| File | Purpose |
|------|---------|
| `middleware.ts` | Server-side locale detection via `Accept-Language` + redirect |

### Deleted (12 files)

| File | Reason |
|------|--------|
| `pages/index.tsx` | Replaced by middleware redirect |
| `pages/about.tsx` | Replaced by middleware redirect |
| `pages/contact.tsx` | Replaced by middleware redirect |
| `pages/portfolio.tsx` | Replaced by middleware redirect |
| `pages/portfolio/[id].tsx` | Replaced by middleware redirect |
| `pages/pricing.tsx` | Replaced by middleware redirect |
| `pages/lesson.tsx` | Replaced by middleware redirect |
| `pages/practice-room.tsx` | Replaced by middleware redirect |
| `pages/studio-info.tsx` | Replaced by middleware redirect |
| `pages/stories/index.tsx` | Replaced by middleware redirect |
| `pages/stories/[id].tsx` | Replaced by middleware redirect |
| `utils/localeUtils.ts` | `getClientLocale()` no longer used |

---

## 8. Testing Strategy

### Phase 1 Tests

```bash
# Build succeeds without out/ directory
npm run build
ls .next/   # Should exist
ls out/     # Should NOT exist

# Local server works
npm run start

# All locale pages load
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ko        # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/about   # 200

# Security headers present
curl -I http://localhost:3000/ko 2>/dev/null | grep -i "x-frame-options"
curl -I http://localhost:3000/ko 2>/dev/null | grep -i "content-security-policy"

# API route works
curl -X POST http://localhost:3000/api/contact/send-email \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@test.com","message":"test"}'
# Should return 200 or EmailJS config error (not 404)
```

### Phase 2 Tests

```bash
# Middleware redirects correctly
curl -v http://localhost:3000/ 2>&1 | grep "Location"
# → Location: /ko (307)

curl -v -H "Accept-Language: en-US" http://localhost:3000/ 2>&1 | grep "Location"
# → Location: /en (307)

curl -v http://localhost:3000/pricing 2>&1 | grep "Location"
# → Location: /ko/pricing (307)

curl -v http://localhost:3000/portfolio/some-id 2>&1 | grep "Location"
# → Location: /ko/portfolio/some-id (307)

# Static resources NOT redirected
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/locales/ko/common.json  # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/images/hardware1.jpg    # 200

# Existing locale paths still work (no double redirect)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ko/about  # 200
```

### Phase 3 Tests

```bash
# Images served through optimization pipeline
# Open browser DevTools → Network → filter images
# URL should be: /_next/image?url=...&w=...&q=75
# Response Content-Type should be: image/webp or image/avif

# External images optimized
# Check portfolio album art from image.bugsm.co.kr etc.

# Error fallback still works
# Manually break an image src → should show /logo512.png
```

### Phase 4 Tests

```bash
# ISR revalidation works
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ko                    # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en/stories/mixing1    # 200

# New content served without rebuild (after revalidate window)
# Add a new story markdown file → wait for revalidate → access the URL

# Non-existent dynamic routes return 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ko/portfolio/nonexistent  # 404
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ko/stories/nonexistent    # 404
```

### Final Validation

- [ ] All 7 locales × 11 page types load correctly
- [ ] Contact form sends email successfully
- [ ] Language switcher works across all pages
- [ ] Dark mode toggle works (no hydration mismatch)
- [ ] 404 page displays correctly for invalid URLs
- [ ] Sitemap generated correctly at `/sitemap.xml`
- [ ] Lighthouse Performance score ≥ previous baseline
- [ ] No console errors in browser DevTools

---

## Execution Order

```
Phase 1 (required first)
    │
    ├── Phase 2 (middleware + cleanup)
    │
    └── Phase 3 (image optimization)     ← parallel with Phase 2
    │
Phase 4 (ISR + final cleanup)            ← after Phase 2 & 3
```

**Estimated file changes**: 6 modified + 1 created + 12 deleted = 19 files total
