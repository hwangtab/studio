# CRA to Next.js 마이그레이션 계획

이 문서는 현재 Create React App(CRA)으로 구축된 `studio-nori` 웹사이트를 Next.js 프레임워크로 마이그레이션하기 위한 상세 계획을 기술합니다.

## 1. 마이그레이션 목표

- **성능 향상**: SSR(Server-Side Rendering) 및 SSG(Static Site Generation)를 활용하여 초기 로딩 속도(TTV, TTI) 개선.
- **SEO 최적화**: 페이지별 메타 태그 및 구조화된 데이터를 손쉽게 관리하여 검색 엔진 노출 극대화.
- **개발 경험 향상**: 파일 기반 라우팅, 내장 API 라우트, 이미지 최적화 등 Next.js의 기능을 활용하여 개발 생산성 증대.
- **유지보수성 개선**: 분리된 빌드 스크립트와 로컬 API 서버를 Next.js의 통합된 환경으로 이전하여 코드베이스의 복잡도 감소.

## 2. 사전 분석: 현재 CRA 프로젝트 구조

- **Frontend**: `react`, `react-router-dom`, `tailwindcss` 기반의 SPA(Single Page Application).
- **Build-time Scripts**: `scripts/` 디렉토리 내 Node.js 스크립트들(`generateStories.js`, `generateSitemap.js`, `optimizeImages.js`)이 빌드 전 정적 데이터를 생성.
- **Local API**: `server/` 디렉토리의 Express와 LowDB를 사용한 간단한 로컬 API 서버. (포트폴리오, 스토리 등 데이터 제공)
- **Routing**: `react-router-dom`을 사용한 클라이언트 사이드 라우팅.
- **Data Fetching**:
    - 빌드 시점에 `scripts/` 스크립트가 Markdown 파일을 파싱하여 `public/data/stories.json`을 생성.
    - 클라이언트에서 `fetch` API를 통해 `/data/stories.json`, `/data/portfolio.json` 등의 정적 JSON 파일을 요청.
- **Image Handling**: `<img>` 태그와 `react-lazy-load-image-component`를 사용하며, 별도의 `optimizeImages.js` 스크립트로 이미지 최적화 수행.
- **Dependencies**: `react-scripts`, `react-router-dom`, `gh-pages` 등 CRA 및 SPA 관련 라이브러리 다수 포함.

## 3. 마이그레이션 단계별 계획

### 1단계: Next.js 기본 설정

1.  **Next.js 의존성 추가**:
    ```bash
    npm install next
    ```

2.  **`package.json` 스크립트 수정**:
    - `start`, `build`, `test` 스크립트를 Next.js 명령어로 교체.
    - 기존의 `prebuild` 및 커스텀 스크립트(`generate-stories` 등)는 Next.js의 데이터 페칭 방식으로 대체되므로 제거 예정.

    ```json
    // package.json (예시)
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
      // 기존 start, build, eject 등은 제거
    },
    ```

3.  **Next.js 설정 파일 생성**:
    - `next.config.js` 파일을 프로젝트 루트에 생성합니다. i18n, 이미지 최적화 외부 도메인 설정 등을 추가합니다.

### 2단계: 폴더 구조 변경 및 라우팅

1.  **`pages` 디렉토리 생성**:
    - CRA의 `src/pages` 컴포넌트들을 Next.js의 파일 기반 라우팅 시스템에 맞게 `pages/` 디렉토리로 이동.
    - 예: `src/pages/About.js` -> `pages/about.js`
    - 예: `src/pages/StoryDetail.js` -> `pages/stories/[id].js` (동적 라우트)

2.  **`_app.js` 및 `_document.js` 설정**:
    - **`pages/_app.js`**: CRA의 `src/App.js` 와 `src/index.js` 역할을 합니다. 전역 CSS (`globals.css`), 레이아웃 컴포넌트(`Layout.js`), `react-helmet-async` Provider 등을 설정합니다.
    - **`pages/_document.js`**: `public/index.html`을 대체합니다. 폰트 로드, `lang` 속성 등 정적인 `<head>`와 `<body>` 태그를 구성합니다.

3.  **라우팅 로직 교체**:
    - `react-router-dom`의 `<Link>` 컴포넌트를 `next/link`의 `<Link>`로 교체.
    - `useNavigate` 훅은 `useRouter` 훅(from `next/router`)으로 대체.
    - `react-router-dom` 의존성 제거.

### 3단계: CRA 전용 도구 및 스크립트 대체

#### 가. `scripts/generateStories.js` (Markdown -> JSON)
- **문제점**: 빌드 파이프라인이 분리되어 있고, 모든 스토리를 단일 JSON 파일로 만들어 비효율적입니다.
- **Next.js 대안**: `getStaticProps`와 `getStaticPaths`를 사용합니다. 데이터 생성 로직이 페이지와 결합되어 의존성이 명확해집니다.
    - **`pages/stories/index.js`**: `getStaticProps` 내에서 Node.js의 `fs` 모듈과 `gray-matter`를 사용하여 `content/stories` 디렉토리의 모든 Markdown 파일을 읽어와 프리뷰 목록을 생성합니다 (SSG).
    - **`pages/stories/[id].js`**:
        - `getStaticPaths`: `content/stories` 내의 모든 파일명을 기반으로 정적 페이지 경로들을 미리 생성합니다.
        - `getStaticProps`: `params.id`를 이용해 특정 Markdown 파일을 읽고 파싱하여 페이지에 props로 전달합니다.
- **구체적인 구현 예시 (`pages/stories/[id].js`)**:
    ```javascript
    import fs from 'fs';
    import path from 'path';
    import matter from 'gray-matter';
    // import { remark } from 'remark'; // 서버사이드에서 Markdown을 HTML로 변환 시
    // import html from 'remark-html';

    export async function getStaticPaths() {
      const postsDirectory = path.join(process.cwd(), 'content/stories');
      const filenames = fs.readdirSync(postsDirectory);
      const paths = filenames.map((filename) => ({
        params: { id: filename.replace(/\.md$/, '') },
      }));
      return { paths, fallback: false };
    }

    export async function getStaticProps({ params }) {
      const filePath = path.join(process.cwd(), 'content/stories', `${params.id}.md`);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      // 선택: Markdown 컨텐츠를 서버에서 HTML로 미리 렌더링
      // const processedContent = await remark().use(html).process(content);
      // const contentHtml = processedContent.toString();

      return {
        props: {
          frontmatter: data,
          content, // 또는 contentHtml
        },
      };
    }
    ```
- **결과**: `generateStories.js` 스크립트와 `public/data/stories.json` 파일이 완전히 불필요해집니다.

#### 나. `scripts/generateSitemap.js`
- **문제점**: 수동으로 사이트맵을 생성해야 합니다.
- **Next.js 대안**:
    1.  **`next-sitemap` 라이브러리 활용**: 빌드 시점에 자동으로 `public/sitemap.xml`을 생성해주는 라이브러리. 설정이 간편하고 동적 경로도 자동으로 포함시킬 수 있어 가장 권장됩니다.
    2.  **API Route 활용**: `pages/api/sitemap.xml.js`를 만들어 요청 시 동적으로 XML을 생성하는 방법도 가능합니다.

#### 다. `scripts/optimizeImages.js`
- **문제점**: 수동 스크립트 실행이 필요하며, webp 등 다양한 포맷 지원이 번거롭습니다.
- **Next.js 대안**: `next/image` 컴포넌트를 사용합니다.
    - 프로젝트 내 모든 `<img>` 태그와 `ResponsiveImage.js` 컴포넌트를 `next/image`로 교체합니다.
    - `next.config.js`에 이미지 소스가 위치한 외부 도메인을 등록해야 합니다.
    - **장점**: 요청 시 자동 이미지 최적화(WebP 변환), 지연 로딩, CLS 방지 등 다양한 성능 최적화가 내장되어 있습니다.
    - `optimizeImages.js` 스크립트와 `public/images/optimized` 폴더는 더 이상 필요 없습니다.

#### 라. `server/` (Express/LowDB API)
- **문제점**: 프론트엔드와 별개의 프로세스로 실행해야 하므로 배포 및 관리가 복잡합니다.
- **Next.js 대안**: **API Routes**
    - `server/server.js`의 API 엔드포인트들을 `pages/api/` 디렉토리로 이전합니다.
    - 예: `GET /api/portfolio` -> `pages/api/portfolio.js` 생성.
    - LowDB 로직은 각 API 라우트 파일 내에서 처리합니다. Vercel과 같은 호스팅 환경에서 Serverless Function으로 자동 배포됩니다.

#### 마. Jest 설정 (`setupTests.js`, `App.test.js`)
- **문제점**: CRA의 테스트 설정(`react-scripts test`)에 의존합니다.
- **Next.js 대안**:
    - Next.js 공식 문서에 따라 Jest와 React Testing Library 설정을 진행합니다 (`jest.config.js` 생성 및 구성).
    - `setupTests.js`의 내용은 `jest.setup.js` 파일로 이전하여 Jest 설정에 추가합니다.

### 4단계: 주요 기능 및 라이브러리 마이그레이션

#### 가. 국제화 (i18n)
- **현재 상태**: `i18next`와 `react-i18next`를 사용하며, 모든 번역 리소스가 `i18n.js` 파일에 하드코딩되어 있습니다.
- **문제점**: 브라우저 환경에 맞춰져 있어 SSR/SSG의 이점을 살리기 어렵고, 번역 파일 관리가 비효율적입니다.
- **Next.js 대안**: `next-i18next` 라이브러리 도입.
    1.  **설치**: `npm install next-i18next`
    2.  **설정**: 프로젝트 루트에 `next-i18next.config.js` 파일을 생성하고, 기본 로케일 및 사용 로케일 목록을 정의합니다.
    3.  **번역 파일 분리**: `i18n.js`에 있던 `resources`를 `public/locales/ko/common.json`, `public/locales/en/common.json` 과 같은 파일 구조로 분리합니다.
    4.  **`_app.js` 설정**: `appWithTranslation` HOC로 `_app.js`의 메인 컴포넌트를 감싸 전역적으로 i18n을 적용합니다.
    5.  **데이터 페칭**: SSG/SSR을 사용하는 페이지에서는 `getStaticProps` 또는 `getServerSideProps` 내에서 `serverSideTranslations` 함수를 호출하여 해당 페이지에 필요한 번역 파일을 미리 로드합니다.
    ```javascript
    // pages/some-page.js
    import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

    export async function getStaticProps({ locale }) {
      return {
        props: {
          ...(await serverSideTranslations(locale, ['common'])),
        },
      };
    }
    ```

#### 나. 클라이언트 전용 라이브러리 처리
- **문제점**: `window`, `document` 등 브라우저 전용 API를 사용하는 라이브러리는 서버 사이드 렌더링 시 "window is not defined"와 같은 에러를 발생시킵니다.
- **Next.js 대안**: `next/dynamic`을 사용한 동적 임포트 (SSR 비활성화).

- **사례 1: `MusicPlayer.js` (`react-h5-audio-player`)**
    - 이 컴포넌트는 오디오 API를 사용하므로 서버에서 렌더링할 수 없습니다.
    - **해결**: `next/dynamic`을 사용하여 클라이언트 사이드에서만 렌더링하도록 설정합니다.
    ```javascript
    import dynamic from 'next/dynamic';

    const DynamicMusicPlayer = dynamic(() => import('../components/MusicPlayer'), {
      ssr: false,
      loading: () => <p>Player loading...</p> // 로딩 중 표시할 컴포넌트
    });

    // 페이지 컴포넌트 내에서 DynamicMusicPlayer 사용
    <DynamicMusicPlayer tracks={tracks} />
    ```

- **사례 2: `Contact.js` (`@emailjs/browser`) - 보안 강화**
    - **현재 문제**: 서비스 ID, 템플릿 ID 등 민감한 정보가 클라이언트 코드에 노출되어 있습니다.
    - **개선 아키텍처**: 이메일 전송 로직을 Next.js API Route로 이전합니다.
        1.  **API Route 생성**: `pages/api/contact.js` 파일을 생성합니다.
        2.  **환경 변수 설정**: EmailJS 관련 키들을 `.env.local` 파일에 저장합니다 (`EMAILJS_SERVICE_ID=...`). 이 변수들은 서버에서만 접근 가능합니다.
        3.  **백엔드 로직 구현**: `contact.js` API 라우트에서 `POST` 요청을 받아, 환경 변수를 사용해 EmailJS Node.js SDK로 이메일을 전송합니다.
        4.  **프론트엔드 수정**: `Contact.js`의 `handleSubmit` 함수가 `emailjs.send()`를 직접 호출하는 대신, `/api/contact`로 `fetch` 요청을 보내도록 수정합니다.
    - **결과**: 민감 정보가 클라이언트로부터 분리되어 보안이 크게 향상됩니다.

#### 다. 스타일링 및 기타 라이브러리
- **`framer-motion`, `react-slick`**: 대부분 Next.js와 잘 호환되지만, 간혹 SSR 과정에서 hydration 오류를 일으킬 수 있습니다. 마이그레이션 후 해당 컴포넌트들이 포함된 페이지를 철저히 테스트하고, 문제가 발생하면 `next/dynamic`으로 임포트하는 것을 고려합니다.
- **전역 CSS**: CRA의 `src/index.css` 내용은 `styles/globals.css`(새로 생성)로 옮기고 `pages/_app.js`에서 import합니다.
- **Tailwind CSS**: `tailwind.config.js`의 `content` 경로에 `pages/**/*.{js,ts,jsx,tsx}`와 `components/**/*.{js,ts,jsx,tsx}`를 추가하여 Tailwind가 Next.js 프로젝트의 클래스를 스캔하도록 합니다.

### 5단계: 앱 설정 및 환경 변수

#### 가. `_app.js` 및 `_document.js` 설정
- **`pages/_app.js`**: CRA의 `src/App.js` 역할을 합니다. 전역 CSS, `Layout` 컴포넌트, `HelmetProvider`, i18n HOC(`appWithTranslation`) 등을 여기에 설정합니다. `React.lazy`를 사용한 페이지별 코드 스플리팅은 Next.js가 자동으로 처리하므로 제거합니다.
- **`pages/_document.js`**: `public/index.html`을 대체합니다. 웹 폰트 로드, `lang` 속성 등 정적인 `<html>`, `<head>`, `<body>` 태그 구조를 정의합니다.
- **CRA 잔여 로직 제거**:
    - `App.js`의 `basename` prop: GitHub Pages 배포용 설정이므로 제거합니다.
    - 404 리다이렉트 로직: `sessionStorage`를 사용한 코드를 제거하고, Next.js의 규약에 따라 `pages/404.js` 파일을 생성하여 커스텀 404 페이지를 만듭니다.

#### 나. 환경 변수
- **문제점**: CRA는 클라이언트 사이드 환경 변수에 `REACT_APP_` 접두사를 사용합니다.
- **Next.js 규칙**:
    - 클라이언트에 노출되어야 하는 변수는 `NEXT_PUBLIC_` 접두사를 사용합니다.
    - 서버 사이드(API Routes, `getStaticProps` 등)에서만 사용되는 변수는 접두사 없이 사용합니다.
- **실행 계획**: 프로젝트 전체에서 `process.env.REACT_APP_`을 검색하여 `process.env.NEXT_PUBLIC_`으로 교체합니다.

#### 다. SEO 및 메타데이터
- **`react-helmet-async` 대체**: Next.js의 내장 컴포넌트 `next/head`를 사용합니다.
- 각 페이지(`pages/**/*.js`) 및 `_app.js`에서 `<Head>` 컴포넌트를 사용하여 페이지별 `title`, `meta description` 등을 동적으로 삽입합니다.
- `SEO.js` 컴포넌트는 `next/head`를 사용하도록 리팩토링하여 재사용합니다.

### 6단계: 최종 정리 및 배포

1.  **불필요한 의존성 제거**:
    ```bash
    npm uninstall react-scripts react-router-dom react-helmet-async gh-pages i18next react-i18next
    ```
2.  **불필요한 파일 삭제**:
    - `public/index.html`, `public/manifest.json`
    - `src/i18n.js` (기능 이전 후)
    - `scripts/` 디렉토리 전체
    - `server/` 디렉토리 전체 (API Routes로 이전 후)
3.  **배포 설정**:
    - `vercel.json`을 사용하거나 Vercel 플랫폼에 직접 연결하여 자동 배포를 설정합니다.
    - 기존 GitHub Actions(`deploy.yml`)는 Vercel 배포 방식으로 변경하거나 제거합니다.

## 4. 예상되는 주요 과제 및 리스크 (보강)

- **데이터 페칭 로직 변경**: 클라이언트 사이드 `fetch`에서 `getStaticProps`/`getServerSideProps`로 전환하는 과정에서 데이터 흐름의 재설계가 필요. 특히 컴포넌트 트리 깊은 곳에서 데이터가 필요한 경우 props drilling이나 상태 관리 라이브러리(Context API 등) 사용을 고려해야 합니다.
- **`next/image` 전환**: 프로젝트 전반의 `<img>` 태그를 `next/image`로 교체하는 작업은 반복적일 수 있으며, 부모 요소의 스타일에 따라 레이아웃이 깨지는 경우가 있어 CSS 수정이 필요할 수 있습니다.
- **외부 라이브러리 호환성**: `window`나 `document` 객체를 직접 사용하는 일부 라이브러리는 SSR 환경에서 에러를 발생시킬 수 있습니다. `next/dynamic`을 사용하여 `ssr: false` 옵션으로 클라이언트 사이드에서만 렌더링되도록 처리해야 합니다. (예: 오디오 플레이어, 일부 차트/애니메이션 라이브러리)
- **테스트 환경 재구축**: Jest 설정을 Next.js 환경에 맞게 재구성하는 데 시간이 소요될 수 있습니다.

## 5. 결론

CRA에서 Next.js로의 마이그레이션은 초기 설정 및 구조 변경에 품이 들지만, 장기적으로는 성능, SEO, 개발 생산성, 보안 측면에서 큰 이점을 제공합니다. 위에 제시된 상세 계획은 기존의 커스텀 빌드 프로세스와 로컬 API를 Next.js의 통합된 기능으로 흡수하여 프로젝트를 더욱 견고하고 확장 가능하게 만들 것입니다.
