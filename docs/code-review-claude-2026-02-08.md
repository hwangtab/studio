# 코드 리뷰 보고서 (Code Review Report)

**검토자:** Claude Opus 4.6
**날짜:** 2026년 2월 8일
**검토 범위:** 전체 코드베이스 (인프라, 컴포넌트, 페이지, 보안, 데이터 레이어)

---

## 1. Critical (즉시 수정 필요)

### 1.1 서버리스 환경에서 무의미한 In-Memory Rate Limiting
- **파일:** `pages/api/contact/send-email.ts:11`
- **문제:** Vercel KV 실패 시 `Map<string, number[]>`으로 폴백하지만, 서버리스 함수는 요청마다 새 인스턴스가 뜰 수 있어 Map이 공유되지 않음. 사실상 rate limiting이 우회됨.
- **영향:** 스팸/봇이 rate limit 없이 이메일을 대량 발송 가능
- **제안:** KV가 없으면 폴백 대신 에러를 반환하거나, 최소한 로그로 경고. 운영 환경에서는 반드시 KV를 설정.

### 1.2 Markdown XSS 취약점 가능성
- **파일:** `components/MarkdownRenderer.tsx:322-335`
- **문제:** `markdown-to-jsx`는 기본적으로 HTML을 그대로 렌더링함. 사용자가 작성한(또는 외부 소스의) 마크다운에 `<script>`, `<iframe>`, `on*` 이벤트 핸들러가 포함될 경우 XSS 공격이 가능.
- **영향:** 콘텐츠 관리자만 마크다운을 작성한다면 위험도는 낮지만, CMS 도입 시 critical로 격상됨
- **제안:** `markdown-to-jsx`의 `options.overrides`에서 허용하는 HTML 태그를 화이트리스트로 제한하거나, `sanitize` 옵션 활용

---

## 2. High (중요한 개선 필요)

### 2.1 `about.tsx` 카테고리 필터링 — Fragile한 문자열 비교
- **파일:** `pages/[locale]/about.tsx:69-74`
- **문제:** `r.category.includes('프로덕션')` 등 한국어/영어 문자열을 동시에 비교. 7개 언어를 지원하면서 한국어/영어만 비교하면 다른 5개 언어에서는 리뷰가 필터링되지 않음
- **동일 패턴:** `pages/[locale]/practice-room.tsx:114-116` — `'연습실'` / `'Practice'`
- **제안:** `categoryKey` (정규화된 영어 키)로 필터링. `lib/stories.ts`에 이미 `storyCategoryKeyMap`이라는 좋은 패턴이 존재하니 리뷰 데이터에도 동일하게 적용

### 2.2 `siteUrl` 하드코딩 — 환경 분리 불가
- **파일:** `components/SEO.tsx:58` — `const siteUrl = 'https://studionol.co.kr'`
- **추가 발견:** canonical URL이 10개 이상의 페이지 컴포넌트에서도 직접 하드코딩
  - `pages/[locale]/index.tsx:48`, `about.tsx:63`, `contact.tsx:97`, `pricing.tsx:47`, `lesson.tsx:74`, `practice-room.tsx:110`, `studio-info.tsx:36`, `portfolio.tsx:99`, `portfolio/[id].tsx:35`, `stories/[id].tsx:73`
  - `utils/schemaGenerator.ts:334`, `utils/schemaGenerator.ts:509`
- **문제:** 개발/스테이징 환경에서 canonical URL이 프로덕션을 가리킴. 스테이징 배포 시 SEO 충돌 가능
- **제안:** `NEXT_PUBLIC_SITE_URL` 환경 변수 도입. SEO 컴포넌트가 이미 `siteUrl`을 사용하므로 canonical은 SEO 내부에서 자동 생성하게 변경하면 페이지별 중복도 제거됨

### 2.3 `useAudioPlayer` — 트랙 변경 시 Race Condition
- **파일:** `components/AudioPlayer/useAudioPlayer.ts:48-85`
- **문제:** `currentTrack`이 변경될 때 `audio.pause()` → `audio.src = newSrc` → `audio.load()`를 수행하지만, `isPlaying`이 `true`인 상태에서 트랙을 변경하면 `isPlaying` effect와 `currentTrack` effect가 동시에 실행되어 race condition이 발생할 수 있음. `nextTrack()`에서 `setCurrentTrack`과 `setIsPlaying(true)`를 연속 호출하면 두 effect가 각각 트리거됨
- **제안:** `currentTrack` effect 안에서 `isPlaying` 상태를 확인하고, 필요 시 직접 play를 호출하는 방식으로 통합

### 2.4 Prism CSS의 React 안티패턴
- **파일:** `components/MarkdownRenderer.tsx:282-291`
- **문제:** `document.createElement('link')`로 DOM을 직접 조작. React의 가상 DOM 관리 범위 밖에서 동작하며, 패턴 자체가 부적절
- **제안:** `next/head`의 `<link>` 또는 dynamic import로 교체

---

## 3. Medium (개선 권장)

### 3.1 `404.tsx` — SSR 없이 클라이언트에서 로케일 추출
- **파일:** `pages/404.tsx:12-29`
- **문제:** `useEffect`로 `router.asPath`에서 로케일을 추출하는데, 초기 렌더링 시 기본 로케일(ko)이 표시된 후 깜빡이며 변경됨 (FOUC)
- **영향:** 영어 사용자가 `/en/wrong-page`에 접속하면 잠깐 한국어가 보임

### 3.2 SEO 컴포넌트 과도한 `useMemo`
- **파일:** `components/SEO.tsx` 전체
- **문제:** 거의 모든 변수가 `useMemo`로 감싸져 있음 (15개 이상). SEO 컴포넌트는 페이지 전환 시에만 리렌더링되므로 memoization 효과가 미미

### 3.3 `getStaticProps` revalidate 불일치
- **문제:** 동일한 데이터를 사용하는 페이지들의 revalidate 값이 다름:
  - `index.tsx`: 3600초, `about.tsx`: 86400초, `stories/index.tsx`: 1800초
  - `contact.tsx`, `lesson.tsx`: revalidate 없음 (ISR 미사용, 빌드 시에만 생성)
- **제안:** 페이지 성격에 따라 3가지 티어로 통일. `contact/lesson`에도 `revalidate` 추가

### 3.4 `tsconfig.json` path alias 미사용
- **파일:** `tsconfig.json:22-32`
- **문제:** `@/*`, `@/components/*`, `@/lib/*` alias가 정의되어 있지만 코드 전체에서 상대 경로만 사용. `pages/[locale]/stories/[id].tsx` 같은 깊은 경로에서 `../../../`이 3단계 이상

### 3.5 `Footer.tsx` — 이모지를 아이콘 대신 사용
- **파일:** `components/layout/Footer.tsx:48-63`
- **문제:** `📍`, `📧`, `📞` 이모지가 아이콘으로 사용됨. 나머지 코드베이스에서는 Lucide 아이콘을 일관되게 사용
- **영향:** OS/브라우저마다 렌더링이 다르고, 스크린 리더에서 예기치 않은 텍스트로 읽힘

### 3.6 리뷰 데이터 클라이언트 호출
- **파일:** `about.tsx:44`, `pricing.tsx:45`, `lesson.tsx:51`, `practice-room.tsx:60`, `studio-info.tsx:27-28`
- **문제:** `reviewsData`를 `getStaticProps`에서 가져오지 않고 컴포넌트 내부에서 `useMemo(() => getReviews(locale))`로 호출. 서버 전용 코드가 클라이언트 번들에 포함될 수 있음
- **제안:** 모든 데이터를 `getStaticProps`에서 가져와 props로 전달. `index.tsx`가 올바른 패턴

### 3.7 CSP에 `unsafe-inline` 사용
- **파일:** `next.config.mjs:74`
- **문제:** `script-src 'unsafe-inline'`과 `style-src 'unsafe-inline'`이 포함됨. XSS 방어 효과 감소
- **현실:** Next.js + Tailwind CSS 환경에서 `unsafe-inline` 없이 동작하기 어려움

---

## 4. Low (선택적 개선)

### 4.1 하드코딩된 i18n 문자열 잔존
- `pages/404.tsx:35` — `description="404 Not Found"` (SEO meta)
- `pages/[locale]/contact.tsx:332` — `"Check our notices"` (폴백 텍스트)
- `pages/[locale]/lesson.tsx:250` — `350,000` (가격 하드코딩)
- `utils/schemaGenerator.ts:72` — `'contact@kosmart.org'` (이메일 하드코딩)

### 4.2 `stories.ts` 정규식 이스케이프 누락
- **파일:** `lib/stories.ts:67`
- **문제:** `new RegExp(\`\.${locale}$\`)` 에서 `.`이 이스케이프되지 않아 정규식에서 임의의 문자와 매치

### 4.3 `type-check` 스크립트 미정의
- **파일:** `package.json`
- **문제:** CLAUDE.md에 `npm run type-check` 명령어가 문서화되어 있지만 `package.json`의 scripts에 정의되어 있지 않음
- **제안:** `"type-check": "tsc --noEmit"` 추가

---

## 5. 잘 된 점 (Positive Highlights)

| 영역 | 평가 |
|------|------|
| **접근성** | `useReducedMotion` 훅 활용, skip link 구현, `aria-hidden`, `aria-label` 일관적 사용, 키보드 포커스 트랩 (Header) |
| **에러 처리** | ErrorBoundary 구현, 오디오 재생 실패 핸들링, 이미지 로드 실패 폴백 (ResponsiveImage) |
| **코드 구조** | UI 컴포넌트 분리 (Section, BaseCard, FeatureCard), 커스텀 훅 분리 (useAudioPlayer), 데이터 레이어 분리 (data/) |
| **SEO** | JSON-LD 구조화 데이터 (Organization, LocalBusiness, Article, Course, FAQ, BreadcrumbList, HowTo, MusicRecording), hreflang 완벽 구현, OG/Twitter Card 완비 |
| **보안** | Honeypot, Rate Limiting(KV), input validation & sanitization, 보안 헤더 설정 |
| **성능** | LazyMotion, dynamic import (AudioPlayer, PortfolioDetailModal), 이미지 최적화 파이프라인, optimizePackageImports |
| **다크 모드** | FOUC 방지를 위한 `_document.tsx` blocking script, `sessionStorage` 동기화 |
| **TypeScript** | strict 모드, 인터페이스/타입 일관 사용 |

---

## 6. 우선순위 요약

| 우선순위 | 이슈 | 난이도 |
|---------|------|--------|
| **P0** | 1.1 Rate limiting 폴백 무의미 | 낮음 |
| **P0** | 1.2 Markdown XSS 가능성 검토 | 중간 |
| **P1** | 2.1 카테고리 필터 문자열 하드코딩 | 낮음 |
| **P1** | 2.2 siteUrl 환경 변수화 | 중간 |
| **P1** | 2.3 오디오 플레이어 race condition | 중간 |
| **P1** | 2.4 Prism CSS DOM 직접 조작 | 낮음 |
| **P2** | 3.3 revalidate 통일 | 낮음 |
| **P2** | 3.6 리뷰 데이터 getStaticProps로 이동 | 낮음 |
| **P2** | 3.1 404 로케일 FOUC | 중간 |
| **P3** | 나머지 Low 이슈들 | 낮음 |
