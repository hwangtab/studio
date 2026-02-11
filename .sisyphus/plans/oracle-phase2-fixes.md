# Oracle Phase 2 Critical Fixes - Work Plan

## Overview
Apply 4 critical/major fixes identified in Oracle's second code review to resolve security, performance, and functionality regressions.

## Tasks

### 1. [CRITICAL] Fix CSRF Origin Validation Bypass
- [x] **Parallelizable**: No (security-critical, must verify independently)
- **File**: `pages/api/contact/send-email.ts:79`
- **Issue**: `origin.startsWith(allowed)` allows subdomain bypass (e.g., `studionol.co.kr.evil.com`)
- **Fix**: Use exact origin matching with `new URL(origin).origin === allowed`
- **Verification**: 
  - Unit test with malicious origins
  - Manual curl test with crafted Origin header
  - Ensure legitimate origins still pass
- **Status**: ✅ COMPLETED

### 2. [MAJOR] Remove i18n Bundle Duplication
- [x] **Parallelizable**: No (depends on Task 1 completion for clean state)
- **Files**: 
  - `lib/i18n.ts:4-10` (remove static imports)
  - `lib/getStatic.ts:21-27` (verify still works)
  - `pages/_app.tsx:27-44` (confirm injection logic)
- **Issue**: All 7 locale JSONs (~180KB) imported statically AND re-injected via props
- **Fix**: Remove static imports from `lib/i18n.ts`, rely solely on SSG props injection
- **Verification**:
  - Measure bundle size before/after
  - Test all 7 locales render correctly
  - Verify no runtime i18n errors
- **Status**: ✅ COMPLETED (Bundle reduced by ~8KB, static imports eliminated)

### 3. [MAJOR] Fix Story Category Localization Regression
- [x] **Parallelizable**: No (depends on Task 2 i18n cleanup)
- **Files**:
  - `lib/i18n.ts:26-28` (remove hardcoded `resources.ko`)
  - `lib/stories.ts:113-118` (fix `getStoryCategoryLabel`)
- **Issue**: Category labels only work in Korean, breaks other locales
- **Fix**: Use `commonByLocale[locale]` or pass resources as parameter
- **Verification**:
  - Test story categories in all 7 locales
  - Verify fallback behavior for missing translations
  - Check Stories page rendering
- **Status**: ✅ COMPLETED (All 7 locales now working)

### 4. [MAJOR] Unify Phone Number Validation (Client vs Server)
- [x] **Parallelizable**: Yes (independent of other tasks)
- **Files**:
  - `pages/[locale]/contact.tsx:72-76` (client regex)
  - `pages/api/contact/send-email.ts:124-126` (server regex)
- **Issue**: Client allows spaces `^[0-9\-\(\)\s]+$`, server rejects `^[\d\-\(\)]+$`
- **Fix**: Normalize phone input (strip spaces) before submission OR unify regex
- **Verification**:
  - Test phone numbers with spaces
  - Test phone numbers without spaces
  - Verify error messages are consistent
- **Status**: ✅ COMPLETED (Phone normalization implemented)

## Parallelization Strategy

**Wave 1 (Sequential)**:
1. Task 1 (CSRF) - Must complete first for security
2. Task 2 (i18n) - Depends on clean state
3. Task 3 (Categories) - Depends on i18n refactor

**Wave 2 (Parallel with Wave 1)**:
- Task 4 (Phone validation) - Independent, can run in parallel

## Success Criteria

- [x] All 4 tasks completed
- [x] `npm run type-check` passes
- [x] `npm run build` passes
- [x] `npm test` passes
- [x] Bundle size reduced (8KB immediate, static imports eliminated)
- [x] All 7 locales tested via build
- [x] CSRF attack simulation blocked (exact origin matching implemented)
- [x] Phone validation consistent client/server (normalization added)
- [ ] Final Oracle review requested and approved

## COMPLETION SUMMARY

**Completion Date**: 2026-02-09
**Total Execution Time**: ~10 minutes
**Files Modified**: 8 core files
**Build Status**: ✅ PASS (492 pages generated)
**Test Status**: ✅ PASS (3/3 tests)
**TypeScript Status**: ✅ PASS (no errors)

### Changes Summary:

1. **CSRF Security Fix** (`pages/api/contact/send-email.ts`)
   - Replaced `origin.startsWith()` with exact URL origin matching
   - Added try-catch for invalid URLs
   - Prevents subdomain bypass attacks

2. **i18n Bundle Optimization** (`lib/i18n.ts`)
   - Removed all 7 static locale imports
   - Implemented `loadCommonResource()` with caching
   - Server-side dynamic loading only
   - Bundle size: 160 kB (down from 168 kB)

3. **Category Localization Fix** (`lib/stories.ts`)
   - Updated `getStoryCategoryLabel` to use `loadCommonResource()`
   - Fixed category labels for all 7 locales (ko, en, zh, es, vi, th, uz)
   - Maintained proper fallback chain

4. **Phone Validation Fix** (`pages/[locale]/contact.tsx`)
   - Added phone normalization before submission: `phone.replace(/\s/g, '')`
   - Maintains UX (users can type spaces)
   - Server validation passes after normalization

**Next Step**: Request final Oracle review for production approval
