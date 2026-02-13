# SEO and AI Crawling Policy (Week 1-2 baseline)

Last updated: 2026-02-13

## 1) Indexing rules

- Default pages: `index, follow`
- 404/invalid pages: `noindex, nofollow`
- Fallback translation pages without localized quality: `noindex, follow`
- Private or temporary campaign pages: `noindex, nofollow` until publish

Implementation:

- Global SEO meta: `/Users/hwang-gyeongha/studio/components/SEO.tsx`
- 404 noindex: `/Users/hwang-gyeongha/studio/pages/404.tsx`
- Story fallback noindex: `/Users/hwang-gyeongha/studio/pages/[locale]/stories/[id].tsx`

## 2) Snippet control rules (AEO/GEO)

- Default recommendation for public marketing pages:
  - `max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- When summary should not be exposed in AI/search previews:
  - `nosnippet`
- When only specific phrases must be hidden:
  - Wrap text with `data-nosnippet` on HTML elements.

Implementation guideline:

- Use SEO `robots` meta value in each page component.
- Example:
  - `robots="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"`
  - `robots="index, follow, nosnippet"`

## 3) Crawler access policy

- Allow all major crawlers by default.
- Explicitly allow `OAI-SearchBot`, `GPTBot`, `ChatGPT-User`.
- Control is managed in:
  - `/Users/hwang-gyeongha/studio/next-sitemap.config.js`
  - `/Users/hwang-gyeongha/studio/public/robots.txt`

## 4) Sitemap and lastmod policy

- Sitemap generation source:
  - `next-sitemap` config in `/Users/hwang-gyeongha/studio/next-sitemap.config.js`
- lastmod rules:
  - Story detail pages: use markdown file mtime in `content/stories/`.
  - Portfolio detail pages: use mtime of `data/portfolio.ts`.
  - Locale static pages: use each route component file mtime.
  - Others: build timestamp fallback.
- Alternate hreflang links are emitted in HTML head via SEO component, not in sitemap.

## 5) Measurement policy

- Contact funnel attribution:
  - Keep `utm_source`, `utm_medium`, `utm_campaign`, `referrer` capture in contact page/API.
