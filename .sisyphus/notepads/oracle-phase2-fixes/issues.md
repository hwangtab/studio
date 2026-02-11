# Issues & Gotchas - Oracle Phase 2 Fixes

## Known Issues

### 1. CSRF Bypass Vulnerability
- **Severity**: Critical
- **Location**: `pages/api/contact/send-email.ts:79`
- **Attack vector**: `studionol.co.kr.evil.com` passes `startsWith()` check
- **Impact**: Allows unauthorized cross-origin requests

### 2. Bundle Duplication
- **Severity**: Major (Performance)
- **Size impact**: ~180KB duplicated across client bundles
- **Root cause**: Static imports in `lib/i18n.ts` + SSG props injection
- **User impact**: Slower initial page load

### 3. Localization Regression
- **Severity**: Major (Functionality)
- **Affected locales**: 6 out of 7 (all except Korean)
- **Symptom**: Story category labels show keys instead of translated text
- **Root cause**: `resources.ko` hardcoded in `getStoryCategoryLabel`

### 4. Form Validation Inconsistency
- **Severity**: Major (UX)
- **User impact**: Phone numbers with spaces pass client validation but fail server
- **Error message**: Generic "Invalid phone number" after successful client validation
- **Confusion factor**: High - users don't understand why submission fails

## Testing Considerations
- Must test all 7 locales after i18n changes
- CSRF tests require curl/Postman with custom Origin headers
- Phone validation needs both positive and negative test cases
- Bundle size measurement: use `npm run build` and check `.next/static/chunks/`
- 2026-02-09: Pages without `getStaticProps` (e.g. `pages/404.tsx`) do not provide `pageProps.i18nResources`, so relying on `_app.tsx` runtime injection can surface raw translation keys in production.
- 2026-02-09: Build still reports existing Next.js ESLint warning `@next/next/no-css-tags` in `components/MarkdownRenderer.tsx` for manual stylesheet link in `Head` (not part of this security fix scope).
- 2026-02-09: `npm run build` still reports existing ESLint warning `@next/next/no-img-element` in `components/MarkdownRenderer.test.tsx` due a test mock returning `<img>`; runtime code remains unaffected.
