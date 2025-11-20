# 2025-11-20 코드 리뷰

## 코드베이스 개요
- Next.js 14 + Tailwind CSS 기반의 SSR/SSG 하이브리드 구조이며, `pages/` 디렉터리 라우팅과 `components/`에 재사용 컴포넌트가 모여 있습니다.
- 콘텐츠는 `content/stories`의 마크다운과 `public/data/portfolio.json` 정적 데이터가 중심이며, API는 `pages/api/contact.js` 단일 엔드포인트를 사용합니다.
- 디자인/문서 산출물은 `docs/`에 축적되어 있고, 테스트는 Jest 기반으로 설정되었으나 실제 테스트 파일은 거의 없습니다.

## 주요 개선 제안

### 1. 포트폴리오 데이터가 클라이언트에서만 로딩되어 초기 화면이 비어 있음
- 관련 코드: `pages/portfolio.js:61`, `pages/portfolio.js:98`
- 현재 포트폴리오 페이지는 첫 렌더에서 빈 상태로 나타났다가 `fetch('/data/portfolio.json')` 결과를 기다린 뒤 내용이 채워집니다. SEO 관점에서 SSR/SSG의 이점을 살리지 못하고 CLS(콘텐츠 점프)가 발생합니다.
- `getStaticProps`(혹은 `app` 전환 시 `generateStaticParams`)를 사용해 정적 JSON을 빌드 타임에 로드하고, 클라이언트에서는 필터링/상호작용만 처리하도록 구조를 바꾸면 UX와 검색 노출이 크게 개선됩니다.

### 2. 필터 한 번 클릭할 때마다 JSON을 반복 다운로드
- 관련 코드: `utils/portfolioDataUtils.js:9`, `utils/portfolioDataUtils.js:34`, `utils/portfolioDataUtils.js:49`, `utils/portfolioDataUtils.js:91`, `utils/portfolioDataUtils.js:109`
- 각 유틸 함수가 `getPortfolioData()`를 다시 호출하면서 동일한 `/data/portfolio.json`을 매번 다운로드합니다. 페이지 초기 로딩에서도 3개의 Promise가 병렬로 동일 파일을 읽습니다.
- 빌드 타임에 한 번만 읽어 props로 전달하거나, 최소한 브라우저 측에서는 `fetch` 결과를 `React Query`, `SWR`, 혹은 모듈 스코프 캐시로 공유해 네트워크/CPU 낭비를 줄여야 합니다. 필터링도 이미 가져온 배열을 메모리에서 처리하면 즉시 반응합니다.

### 3. 다크 모드 초기 깜빡임 및 hydration mismatch 위험
- 관련 코드: `components/Layout.js:52`, `components/Layout.js:78`
- 서버 렌더 시 항상 라이트 모드로 출력한 뒤, `useEffect`로 로컬스토리지를 읽어 테마를 토글합니다. 저장된 다크 모드가 있을 경우 화면이 한 번 깜빡이고, 첫 렌더의 `className`이 서버와 달라 경고가 뜰 수 있습니다.
- `_document.js`에서 즉시 실행 스크립트로 테마 클래스를 선반영하거나, `next-themes`와 같이 SSR 대응된 토글러를 도입해 초기 페인트가 사용자 설정과 일치하도록 해야 합니다.

### 4. StoryCard가 DOM 측정 + 전역 resize 리스너를 카드 수만큼 붙임
- 관련 코드: `components/StoryCard.js:8`, `components/StoryCard.js:13`, `components/StoryCard.js:52`
- 각 카드마다 `window.resize` 리스너를 등록해 폰트 크기/라인 높이를 직접 조정하고 있습니다. 카드가 많으면 리스너도 같은 수만큼 생성되고, `getClientRects` 반복 호출이 레이아웃 스래싱을 유발합니다.
- Tailwind `line-clamp` 유틸(이미 `tailwind.config.js`에 정의됨)을 활용하고, 제목은 CSS `text-ellipsis`만 적용하거나 `ResizeObserver`를 컴포넌트 바깥에서 공유해 계산량을 줄이는 편이 좋습니다.

### 5. Prism 전체 번들이 모든 페이지에 포함됨
- 관련 코드: `components/MarkdownRenderer.js:2`
- MarkdownRenderer는 최상단에서 `prismjs` 및 여러 언어 하이라이터를 `import`하고 있어, 스토리 상세 페이지를 보지 않아도 모든 방문자에게 수백 KB의 JS가 내려갑니다.
- `next/dynamic`으로 MarkdownRenderer 자체를 지연 로딩하거나, `Prism` import를 `useEffect` 내부에서 필요할 때만(`if (typeof window !== 'undefined')`) 수행하면 초기 번들 크기를 줄일 수 있습니다.

### 6. 핵심 경로 테스트 부재
- 관련 코드: `utils/localDataUtils.test.js:1`
- Jest 설정은 존재하지만 실제 테스트는 `localDataUtils` 단일 파일에만 집중되어 있습니다. 포트폴리오 필터링, 스토리 빌더, `pages/api/contact` API 같은 고위험 경로가 전혀 검증되지 않습니다.
- 최소한 스토리 데이터 파서(`lib/stories`)와 컨택트 API에 대한 단위 테스트/통합 테스트를 추가해 마크다운 파싱 오류나 EmailJS 연동 실패를 조기에 감지하도록 하세요.

### 7. 연락처 API에 스팸/남용 방지 장치가 없음
- 관련 코드: `pages/api/contact.js:1`
- 엔드포인트가 누구에게나 공개되어 있으며, rate limiting, CSRF 보호, reCAPTCHA/토큰 검증이 없습니다. EmailJS 키가 노출되면 대량 스팸 요청으로 이메일 크레딧이 소진될 수 있습니다.
- `@upstash/ratelimit`, `next-rate-limit` 등을 활용해 IP 기반 제한을 두고, 프런트엔드 폼에는 reCAPTCHA v3 또는 간단한 honeypot을 추가해 서버에 도달하는 악의적 요청을 줄이십시오.

## 추가 메모
- Tailwind 설정과 전역 스타일은 풍부하지만, 폰트 관련 `@font-face` 정의가 CDN 의존적이므로 폰트 서빙 실패 시 폴백이 필요한지 검토하세요.
- Stories, Portfolio 등 주요 페이지에 대한 E2E 시나리오를 Playwright/Cypress로 구성하면 배포 전에 제일 중요한 경로(네비게이션, 폼 제출, 오디오 플레이어 등)를 자동으로 확인할 수 있습니다.
