# CLAUDE.md

This file provides guidance for development in the **Studio NOL** repository.

## Project Overview

Studio NOL is a multi-language music studio website built with:
- **Framework**: Next.js 15.5.12 (Pages Router)
- **Runtime**: React 19.2.4
- **Styling**: Tailwind CSS with custom design system
- **Animation**: Framer Motion
- **i18n**: react-i18next (7 languages: ko, en, zh, es, vi, th, uz)
- **Content**: Markdown-based story system
- **Deployment**: Vercel

## Key Technologies

- **Frontend**: Next.js 15.5.12, React 19.2.4, Tailwind CSS, Framer Motion, Lucide React
- **i18n**: i18next with language detection and locale-based routing
- **Form**: Serverless contact form via Next.js API Routes and Resend
- **Imaging**: Sharp-based image optimization (WebP/AVIF)
- **Audio**: Custom AudioPlayer with `useAudioPlayer` hook

## Development Commands

```bash
# Development
npm run dev                  # Start Next.js development server

# Build & Verification
npm run type-check           # Run TypeScript compiler check
npm run lint                 # Run ESLint
npm run build                # Production build (includes image optimization)

# Image Optimization
node scripts/optimizeImages.js # Manually run image optimization

# Hero font subset (LCP)
# prebuild에서 자동 실행됨. hero h1 텍스트(data/home.ts heroContent,
# public/locales/*/common.json의 *.hero.title*) 변경 후 빌드하면 woff2가 재생성되며
# 변경된 woff2를 반드시 commit해야 함. 빠뜨리면 새 글자가 subset 밖이라
# fallback chain으로 그려져 글자별 두께 차이 발생 가능.
# 수동 재실행:
node scripts/generate-hero-font.mjs
```

## Architecture & Data Flow

### Image Optimization System
The project uses a custom optimization script `scripts/optimizeImages.js`:
1. **Source**: Original images in `public/images/`
2. **Process**: Converts JPG/PNG to WebP and AVIF (using Sharp)
3. **Artifacts**: Generates `utils/imageMetadata.json` for dimension hints
4. **Usage**: Use optimized formats (.webp/.avif) in content for better performance

### Contact Form Logic
- **Client**: `pages/[locale]/contact.tsx` captures user input
- **Server**: `pages/api/contact/send-email.ts` (API route)
- **Validation**: Honeypot and Rate Limiting implemented on server-side
- **Delivery**: Server-side request to Resend REST API (`lib/email/resend.ts`)

### Routing & i18n
- **Path structure**: `/[locale]/[path]`
- **Locale management**: `lib/i18n.ts` and `utils/localeUtils.ts`
- **Dynamic Routes**: Stories are loaded from `content/stories/` based on slug and locale

## Important Files & Directories

- `pages/[locale]/` - Localized page components
- `pages/api/` - Backend API routes (Serverless functions)
- `components/` - Reusable UI components
- `content/stories/` - Markdown files for studio news and stories
- `lib/i18n.ts` - Internationalization configuration
- `tailwind.config.ts` - Design system (colors, typography)
- `next.config.mjs` - Next.js configuration

## Next.js Experimental Flags

`next.config.mjs` `experimental` 블록 결정 사항 — 이유 없이 건드리지 말 것:

| 플래그 | 상태 | 이유 |
|--------|------|------|
| `optimizePackageImports` | **활성** (7개 라이브러리) | `lucide-react`, `framer-motion` 등 barrel import tree-shaking |
| `optimizeCss` (critters) | **비활성** | PSI 모바일 점수 85→38 급락, TBT 260→7,130ms. Next.js 15 + React 19 + Pages Router 조합에서 불안정 |
| `nextScriptWorkers` (Partytown) | **비활성** | TBT 260→1,990ms 회귀 확인 |

## Deployment Notes

- **Hosting**: Vercel (Standard Next.js deployment)
- **Environment Variables**: Configure `RESEND_API_KEY` (and optional `RESEND_FROM`) in Vercel dashboard
- **Build**: Prebuild hook runs image optimization automatically