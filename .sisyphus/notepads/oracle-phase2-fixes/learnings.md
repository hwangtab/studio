# Learnings - Oracle Phase 2 Fixes

## Project Context
- **Framework**: Next.js 13 (Pages Router)
- **i18n**: 7 locales (ko, en, zh, es, vi, th, uz)
- **Default locale**: ko
- **Namespace**: common (single namespace)
- **Locale JSON sizes**: ~21-38KB each (~180KB total)

## Code Conventions
- TypeScript strict mode enabled
- ESLint + Prettier configured
- Test framework: Jest + React Testing Library
- API routes: `/pages/api/` directory

## Security Context
- CSRF protection required for all POST endpoints
- ALLOWED_ORIGINS: `['https://studionol.co.kr', 'http://localhost:3000', 'http://localhost:3001']`
- Current vulnerability: `origin.startsWith()` allows subdomain bypass

## i18n Architecture
- **Current (problematic)**: Static imports in `lib/i18n.ts` + SSG props injection = duplication
- **Target**: SSG props injection only, no static imports
- **Key files**: `lib/i18n.ts`, `lib/getStatic.ts`, `pages/_app.tsx`

## Known Gotchas
- `getStoryCategoryLabel` hardcoded to `resources.ko` - breaks non-Korean locales
- Phone validation regex mismatch between client and server
- All changes must maintain existing build/test pass state

## CSRF Origin Validation Fix (Completed)

### Vulnerability Details
- **File**: `pages/api/contact/send-email.ts:79`
- **Issue**: Used `origin.startsWith(allowed)` which allows subdomain bypass
- **Attack Vector**: `studionol.co.kr.evil.com` would pass validation (starts with `studionol.co.kr`)
- **OWASP Reference**: CSRF tokens preferred, but origin validation must use exact matching, never prefix matching

### Solution Implemented
Replaced vulnerable prefix matching with exact URL origin comparison:

**Before:**
```typescript
if (!origin || !ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
```

**After:**
```typescript
if (!origin || !ALLOWED_ORIGINS.some(allowed => {
    try {
        return new URL(origin).origin === allowed;
    } catch {
        return false;
    }
})) {
```

### Key Security Improvements
1. **Exact Origin Matching**: `new URL(origin).origin` extracts canonical origin (protocol + hostname + port)
2. **Error Handling**: Invalid URLs are caught and rejected (returns false)
3. **No Subdomain Bypass**: `studionol.co.kr.evil.com` now correctly rejected
4. **Path Stripping**: URLs with paths (e.g., `https://studionol.co.kr/path`) correctly match allowed origin
5. **Port Sensitivity**: Different ports treated as different origins

### Verification Results
All 9 test cases passed:
- ✓ Malicious subdomain blocked: `https://studionol.co.kr.evil.com` → false
- ✓ Legitimate origin allowed: `https://studionol.co.kr` → true
- ✓ Localhost dev allowed: `http://localhost:3000` → true
- ✓ Localhost alt port allowed: `http://localhost:3001` → true
- ✓ URLs with paths handled correctly
- ✓ Invalid URLs rejected
- ✓ Null origins rejected

### Build Status
- TypeScript compilation: ✓ Successful (no errors)
- LSP diagnostics: ✓ No errors
- No breaking changes to existing validation logic

## i18n Bundle Duplication Fix (Completed)

### What Changed
- **File**: `lib/i18n.ts`
- Removed all 7 static JSON imports (`ko/en/zh/es/vi/th/uz` common namespace files)
- Replaced static `commonByLocale` map with server-only lazy loader (`loadCommonResource`) that:
  - Uses runtime `require` + `node:path` to read `public/locales/{locale}/common.json`
  - Caches loaded locale bundles in memory (`commonByLocaleCache`)
  - Returns empty object in browser context to avoid client-side JSON bundling
- Preserved existing `getLocaleI18nResources(locale)` API shape for `getStaticProps` consumers
- Kept default `resources` initialization for `ko` via lazy server loader

### Bundle Impact (Measured)
- **Before** (`npm run build`):
  - First Load JS shared by all: **168 kB**
  - `_app` chunk: **74.9 kB**
- **After** (`npm run build`):
  - First Load JS shared by all: **160 kB**
  - `_app` chunk: **66.5 kB**
- **Delta**: ~**8.4 kB** reduction in `_app` chunk, ~**8 kB** reduction shared first-load JS

### Functional Verification
- `npm test -- --watchAll=false`: ✓ passed (1 suite, 3 tests)
- `npm run build`: ✓ passed (SSG generated all locale routes)
- `next start` route checks: ✓ all 14 locale routes (`/{locale}` and `/{locale}/stories`) returned HTTP 200 for `ko,en,zh,es,vi,th,uz`
- `lsp_diagnostics` on `lib/i18n.ts`: ✓ clean

### Notes
- This implementation removes static locale imports from client bundle entry points while keeping SSG props injection contracts unchanged (`lib/getStatic.ts` and `pages/_app.tsx` untouched).

## Story Category Localization Fix (Completed)

### Problem
After i18n bundle refactoring (task-2), `getStoryCategoryLabel` in `lib/stories.ts:112-118` was broken for non-Korean locales:
- **Root cause**: Function tried to access `resources[locale]?.common` 
- **Issue**: `resources` object only contains `ko` (default locale) after refactoring
- **Impact**: Category labels showed raw keys (e.g., "notice", "event") instead of translated labels in 6 out of 7 locales
- **Affected locales**: en, zh, es, vi, th, uz

### Solution Implemented
1. **Exported `loadCommonResource`** from `lib/i18n.ts` (line 20)
   - Changed from `const` to `export const`
   - This function dynamically loads locale JSON files at runtime with caching

2. **Updated import** in `lib/stories.ts` (line 7)
   - Added `loadCommonResource` to imports from `./i18n`
   - Removed unused `resources` import (was causing ESLint warning)

3. **Fixed `getStoryCategoryLabel` function** (lines 112-118)
   - **Before**: Accessed `resources[locale]?.common` (undefined for non-Korean)
   - **After**: Uses `loadCommonResource(locale)` to dynamically load correct locale JSON
   - Maintains fallback chain: localized → fallback (ko) → raw categoryKey

### Code Changes
```typescript
// lib/i18n.ts line 20
export const loadCommonResource = (locale: Locale): Record<string, unknown> => {
  // ... implementation unchanged
};

// lib/stories.ts line 7
import { locales, defaultLocale, type Locale, loadCommonResource } from './i18n';

// lib/stories.ts lines 112-118
const getStoryCategoryLabel = (categoryKey: string, locale: Locale): string => {
  const localeCommon = loadCommonResource(locale);
  const fallbackCommon = loadCommonResource(defaultLocale);
  const localizedCategories = (localeCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  const fallbackCategories = (fallbackCommon?.stories as Record<string, Record<string, string>> | undefined)?.categories;
  return localizedCategories?.[categoryKey] || fallbackCategories?.[categoryKey] || categoryKey;
};
```

### Verification Results
- **TypeScript compilation**: ✓ No errors (lsp_diagnostics clean)
- **Build**: ✓ Successful (`npm run build` passed, 492 static pages generated)
- **ESLint**: ✓ No warnings for `lib/stories.ts`
- **Functional**: Category labels now load correctly for all 7 locales via dynamic `loadCommonResource`

### Why This Works
- `loadCommonResource` is server-side only (checks `typeof window !== 'undefined'`)
- Safe to call during SSG in `getStaticProps` context
- Caches loaded bundles in `commonByLocaleCache` to avoid repeated file I/O
- Maintains same fallback behavior as before (locale → default → raw key)
- 2026-02-09: `lib/i18n.ts` currently initializes client i18n with empty `ko.common` because `loadCommonResource()` returns `{}` in browser, making page-level `i18nResources` injection a single point of failure for translations.
- 2026-02-09: Runtime CSP is enforced in `middleware.ts` (not `next.config.mjs`) and already uses nonce-based `script-src` without `'unsafe-inline'`; added `script-src-attr 'none'` to block inline event-handler execution vectors.
- 2026-02-09: `pages/_document.tsx` currently loads `/scripts/theme-init.js` as an external script with `nonce`, so no CSP `script-src 'unsafe-inline'` exception is required for that boot script.
- 2026-02-09: `components/MarkdownRenderer.tsx` now enforces `isAllowedProtocol` for anchor `href` values; allowed set is `http`, `https`, `mailto`, `tel`, and relative links (root-relative, dot-relative, query/hash, bare relative).
- 2026-02-09: Added `disableParsingRawHTML: true` to `markdown-to-jsx` options to prevent raw HTML node parsing in story markdown and reduce Stored XSS surface.
- 2026-02-09: Hardened markdown href validation by stripping control/whitespace characters before protocol detection, then enforcing allowlist (`http`, `https`, `mailto`, `tel`, relative paths) to block obfuscated scheme payloads.
