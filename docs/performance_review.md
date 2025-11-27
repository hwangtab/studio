# Performance & Optimization Review (2025-11-27)

## Overview
The site is built with **Next.js 14**, Tailwind CSS, and a set of reusable UI components. Recent refactors added image optimization, removed dead code, and switched the header back to a fixed position with a top‑padding shim.

## Build Metrics (from the latest `next build` output)
| Page | HTML size | First‑load JS |
|------|-----------|---------------|
| `/` | **3.49 kB** | **165 kB** |
| `/about` | 4.97 kB | 164 kB |
| `/contact` | 7.17 kB | 158 kB |
| `/portfolio` | 6.03 kB | 164 kB |
| `/practice-room` | **7.49 kB** | **162 kB** |
| `/pricing` | 8.4 kB | 159 kB |
| `/stories` | 1.99 kB | 152 kB |

**Shared bundle**: ~115 kB (framework, main, page‑router, etc.).

## Rendering Strategy
- **SSG (Static Site Generation)**: Most pages including `/`, `/about`, `/pricing`, `/portfolio`, `/practice-room`, `/contact`
- **ISR (Incremental Static Regeneration)**: `/stories/[id]` with 60s revalidate
- **Impact**: Zero server load, instant page delivery via CDN, excellent TTFB

## Image Optimization ✅
- `next.config.js` now lists **six remote domains** (`image.bugsm.co.kr`, `img.tumblbug.com`, `is1-ssl.mzstatic.com`, `thumb.mt.co.kr`, `cdn.imweb.me`, `i.ytimg.com`)
- All internal images use `next/image` with `fill`/`width‑height` and `loading="lazy"` where appropriate
- External images now served through Next.js's built‑in optimizer (WebP conversion, automatic resizing, lazy loading)
- **Recent fix**: Added `fill` prop to 8 images in `practice-room.js`

## Font Loading ⚠️
**Current Status**: Mixed approach
- **Montserrat** (Latin): Loaded via Google Fonts CDN (`@import` in CSS) - **blocking render**
- **Korean fonts** (GmarketSans, Pretendard, PartialSansKR): Multiple `@font-face` declarations from CDN
- **Issue**: Fonts loaded from external CDNs without `next/font` optimization
- **Impact**: Potential layout shift (CLS), slower initial render

**Recommendation**: Migrate to `next/font/google` and `next/font/local` for optimal loading

## JavaScript Bundle & Code‑splitting ✅
- Heavy components (`AudioPlayer`) are loaded dynamically (`next/dynamic`)
- No unused libraries remain (e.g., `MusicPlayer.js` removed)
- The header is fixed, so no additional runtime code is required for scroll‑based layout changes

## CSS ✅
- Tailwind is configured with `purge` (default in Next.js) so unused utilities are stripped from the final CSS
- No large custom CSS files remain

## Recent Improvements
1. **Refactoring**: Extracted data to `data/` folder, created reusable components (`BaseCard`, `MediaGallery`, `HeroBanner`)
   - **Impact**: Reduced code duplication, improved maintainability
2. **Image optimization**: Added `fill` props to all images, configured remote domains
   - **Impact**: Faster loading, automatic WebP conversion
3. **Dead code removal**: Deleted `MusicPlayer.js`
   - **Impact**: Reduced bundle size
4. **Header optimization**: Fixed positioning for better UX

## Next Steps (Priority Order)

### 🔴 High Priority
1. **Run Lighthouse audit** on production site
   - Measure Core Web Vitals (LCP, FID, CLS)
   - Identify specific bottlenecks
   - Target: > 90 Performance score

2. **Font optimization**
   - Migrate Montserrat to `next/font/google`
   - Convert Korean fonts to `next/font/local`
   - Expected: Eliminate render-blocking fonts, reduce CLS

### 🟡 Medium Priority
3. **Add preconnect tags** for external domains
   ```html
   <link rel="preconnect" href="https://image.bugsm.co.kr" />
   <link rel="preconnect" href="https://img.tumblbug.com" />
   <link rel="preconnect" href="https://is1-ssl.mzstatic.com" />
   ```
   - Expected: ~100-300ms faster image loading

4. **Implement `placeholder="blur"`** for hero images
   - Expected: Better perceived performance, reduced CLS

### 🟢 Low Priority
5. **Audit third-party scripts** (analytics, chat widgets)
   - Load after `idle` or user interaction
   - Expected: Improved Time to Interactive (TTI)

6. **Verify Brotli/Gzip compression** on CDN
   - Check response headers
   - Expected: Already enabled on Vercel

## Summary
- **Page size**: Modest (2-8 kB HTML, ~160 kB first-load JS)
- **Images**: ✅ Fully optimized (internal + external)
- **Fonts**: ⚠️ Needs optimization (migrate to `next/font`)
- **JS/CSS**: ✅ Trimmed and dynamically loaded
- **Rendering**: ✅ SSG/ISR for all pages
- **Expected Lighthouse score**: 85-95 (current), 95+ (after font optimization)

*Prepared by Antigravity – 2025‑11‑27*
