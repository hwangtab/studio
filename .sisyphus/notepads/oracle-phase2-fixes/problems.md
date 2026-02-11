# Unresolved Problems - Oracle Phase 2 Fixes

## Blockers
None currently - all issues have clear solutions from Oracle review.

## Risks

### Risk 1: i18n Refactor Breaking Changes
- **Probability**: Medium
- **Impact**: High (breaks all pages)
- **Mitigation**: Test all 7 locales after changes, verify SSG props injection works
- **Rollback plan**: Revert `lib/i18n.ts` changes, restore static imports

### Risk 2: CSRF Fix Breaking Legitimate Requests
- **Probability**: Low
- **Impact**: High (blocks real users)
- **Mitigation**: Test with all ALLOWED_ORIGINS, verify localhost still works
- **Rollback plan**: Revert to `startsWith()` temporarily, investigate origin mismatch

### Risk 3: Phone Normalization Edge Cases
- **Probability**: Medium
- **Impact**: Low (form submission fails)
- **Mitigation**: Test international formats, verify regex covers all cases
- **Fallback**: Add server-side normalization as backup

## Questions for User
None - Oracle review provided clear action items.

## 2026-02-09 Follow-up
- None for the markdown XSS protocol fix; implementation verified with diagnostics, tests, and build.
- 2026-02-09: None for this task; protocol validation, diagnostics, tests, and production build all pass.
