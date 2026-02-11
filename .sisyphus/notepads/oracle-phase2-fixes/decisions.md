# Architectural Decisions - Oracle Phase 2 Fixes

## Decision Log

### [Pending] CSRF Origin Validation Strategy
**Options**:
1. Exact string match: `ALLOWED_ORIGINS.includes(origin)`
2. URL parsing: `new URL(origin).origin === allowed`
3. Regex with anchors: `/^https:\/\/studionol\.co\.kr$/`

**Recommendation**: Option 2 (URL parsing) - most robust, handles edge cases

### [Pending] i18n Bundle Strategy
**Options**:
1. Remove all static imports, rely on SSG props only
2. Keep static imports for default locale, props for others
3. Lazy load on client side

**Recommendation**: Option 1 - aligns with Oracle's guidance, cleanest separation

### [Pending] Phone Validation Unification
**Options**:
1. Normalize client-side (strip spaces before submit)
2. Update server regex to allow spaces
3. Update client regex to match server (no spaces)

**Recommendation**: Option 1 - best UX, maintains server strictness

### [Pending] Category Label Localization
**Options**:
1. Pass locale resources as parameter to `getStoryCategoryLabel`
2. Use `commonByLocale[locale]` directly
3. Refactor to use i18n.t() with proper locale context

**Recommendation**: TBD after reviewing current i18n refactor
- 2026-02-09: Recommend restoring deterministic client baseline by statically bundling `public/locales/*/common.json` into `lib/i18n.ts` resources; keep `getI18nStaticProps` injection as additive fallback rather than primary loading path.
- 2026-02-09: Kept nonce-based CSP architecture in middleware and hardened it by adding `script-src-attr 'none'` instead of weakening policy with `'unsafe-inline'`, preserving compatibility with Vercel Analytics and Google-hosted script sources already allowlisted.
- 2026-02-09: For markdown link safety, chose allowlist validation over blocklist (`isAllowedProtocol`) and fallback rendering to `<span>` when blocked, preventing active navigation for unsafe URI schemes.
- 2026-02-09: Disabled raw HTML parsing in `markdown-to-jsx` via `disableParsingRawHTML: true` instead of maintaining an incomplete dangerous-tag override list.
- 2026-02-09: Implemented URI scheme validation with explicit allowlist + text fallback (`<span>`) for rejected links to keep markdown readable while removing clickable attack vectors (`javascript:`, `data:`, `vbscript:`).
