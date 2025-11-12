# 웹사이트 코드 리뷰 및 개선 제안

## 1. 개요

이 문서는 현재 웹사이트 코드베이스에 대한 분석 및 개선 제안 사항을 담고 있습니다. 전반적으로 Next.js의 기능을 잘 활용하고 있으며, 깔끔한 컴포넌트 구조와 Tailwind CSS를 통한 일관된 스타일링이 돋보입니다. 하지만 몇 가지 영역에서 성능, 유지보수성, 사용자 경험을 향상할 여지가 있습니다.

## 2. 총평

| 영역 | 평가 | 요약 |
| --- | --- | --- |
| **프로젝트 구조** | ✅ 좋음 | Next.js 표준을 잘 따르고 있으며, 폴더 구조가 직관적입니다. |
| **상태 관리** | 🟡 보통 | 대부분 컴포넌트 내부 `useState`로 관리되나, `AudioPlayer`와 같이 복잡한 상태는 Jotai, Zustand 등 경량 상태관리 라이브러리 도입을 고려해볼 만합니다. |
| **컴포넌트 설계** | ✅ 좋음 | 재사용 가능한 컴포넌트 설계가 잘 되어 있습니다. |
| **데이터 Fetching** | 🟡 보통 | 서버사이드(`lib/stories.js`)와 클라이언트사이드(`utils/portfolioDataUtils.js`) 로직이 혼재되어 있어 개선의 여지가 있습니다. SWR 이나 React-Query 도입 시 캐싱, 재검증 등에서 이점을 얻을 수 있습니다. |
| **성능 최적화** | 🟡 보통 | 이미지 최적화(`ResponsiveImage`)와 `dynamic import`는 훌륭하나, 폰트 로딩, CSS 등에서 추가 최적화가 가능합니다. |
| **코드 품질** | ✅ 좋음 | ESLint 기본 규칙을 잘 따르고 있으나, `useEffect` 의존성 배열 관리 등에서 사소한 개선점이 보입니다. |

## 3. 상세 분석 및 개선 제안

### 3.1. 프로젝트 설정 (`package.json`, `next.config.js`)

#### 현황
- `package.json`에 `typescript`가 포함되어 있으나, 프로젝트 전반이 JavaScript(.js)로 작성되어 있습니다.
- `next.config.js`에 `i18n` 설정이 있지만 실제 사용 여부가 불분명하고, `images.remotePatterns`가 비어있어 외부 이미지 사용 시 잠재적 이슈가 있습니다.
- `sharp` 패키지가 `devDependencies`에 포함되어 있습니다. Next.js 11버전 이상에서는 `sharp`가 내장 이미지 최적화에 권장되므로 `dependencies`로 이동하는 것이 좋습니다.

#### 제안
1.  **TypeScript 점진적 도입**: 유지보수성과 타입 안정성을 위해 신규 컴포넌트나 유틸리티 함수부터 `.ts`, `.tsx`로 점진적으로 전환하는 것을 권장합니다.
2.  **`next.config.js` 정리**:
    - `i18n` 기능이 실제로 필요 없다면 관련 설정을 제거하여 빌드 과정을 단순화합니다.
    - 외부 이미지를 사용할 계획이 있다면 `images.remotePatterns`에 해당 도메인을 명시적으로 추가하여 보안을 강화하고 Next.js 이미지 최적화 기능을 활용하세요.
3.  **`sharp` 패키지 이동**: `npm install sharp --save` 명령을 통해 `sharp`를 `dependencies`로 이동시켜 프로덕션 환경에서 이미지 최적화가 원활히 동작하도록 합니다.

### 3.2. 데이터 Fetching 및 관리

#### 현황
- **블로그 게시물**: `lib/stories.js`에서 `fs` 모듈을 사용하여 Markdown 파일을 직접 읽어옵니다. 이는 빌드 시점에 정적 페이지를 생성하는 `getStaticProps`와 잘 어울리지만, 에러 처리가 미흡하고 코드의 재사용성이 떨어집니다.
- **포트폴리오 데이터**: `utils/portfolioDataUtils.js`에서 `fetch`를 사용해 클라이언트 사이드에서 `portfolio.json` 파일을 가져옵니다. 이로 인해 페이지 로드 후 추가적인 네트워크 요청이 발생하며, 데이터가 변경되지 않는 한 불필요한 로딩이 반복될 수 있습니다.

#### 제안
1.  **포트폴리오 데이터 `getStaticProps`로 이전**: `portfolio.js` 페이지에서 `getStaticProps`를 사용하여 빌드 시점에 `portfolio.json` 데이터를 가져오도록 변경합니다. 이렇게 하면 클라이언트 사이드 `fetch`가 사라져 로딩 성능이 향상되고 SEO에 유리해집니다.
2.  **SWR 또는 React-Query 도입**: 클라이언트 사이드에서 동적인 데이터를 다룰 경우, `swr` (Next.js 개발팀 제작) 라이브러리를 도입하여 캐싱, 포커스 시 자동 재검증, 로딩/에러 상태 관리를 훨씬 효율적으로 처리할 수 있습니다.
    - 예시: `const { data, error } = useSWR('/data/portfolio.json', fetcher)`
3.  **`lib/stories.js` 에러 처리 강화**: `fs.readFileSync`와 같은 파일 시스템 접근 시 `try...catch` 블록을 사용하여 파일이 존재하지 않는 경우 등 예외 상황에 대응해야 합니다.

### 3.3. 컴포넌트 설계 (`AudioPlayer`, `StoryCard`)

#### 현황
- **`AudioPlayer.js`**:
    - `useState`와 `useRef`를 사용하여 오디오 플레이어의 복잡한 상태(재생, 시간, 볼륨, 트랙 변경 등)를 모두 관리하고 있어 로직이 비대하고 추적이 어렵습니다.
    - `useEffect` 훅이 여러 개 사용되어 각기 다른 상태 변화에 반응하고 있으며, 일부 의존성 배열이 과도하게 설정될 가능성이 있습니다. 특히 `whilePlaying` 함수는 `useCallback`으로 감싸져 있지만, `isPlaying` 상태가 변경될 때마다 재정의될 수 있어 `requestAnimationFrame` 로직이 복잡해집니다.
- **`StoryCard.js`**:
    - `useEffect` 내에서 DOM을 직접 조작하여 글자 크기를 조절하고 줄 수를 제한하는 로직(`fitTitleToOneLine`, `enforceSummaryFourLines`)이 포함되어 있습니다. 이는 React의 선언적 UI 패턴과 다소 거리가 있으며, CSS로 처리할 수 있는 부분을 스크립트로 해결하고 있어 성능 저하의 원인이 될 수 있습니다.

#### 제안
1.  **`AudioPlayer.js` 리팩터링**:
    - **상태 관리 라이브러리 도입**: Jotai나 Zustand 같은 경량 상태 관리 라이브러리를 사용해 오디오 플레이어의 상태를 중앙에서 관리하면 `props drilling` 없이 다른 컴포넌트에서도 플레이어 상태에 접근하고 제어할 수 있습니다.
    - **`useReducer` 활용**: 상태 관리 라이브러리 도입이 부담스럽다면, 복잡한 상태 로직을 `useReducer`로 분리하여 컴포넌트 외부에서 관리하는 것을 고려해볼 수 있습니다.
    - **`requestAnimationFrame` 최적화**: `isPlaying` 상태와 관계없이 `requestAnimationFrame` 루프를 유지하고, 루프 내부에서 `isPlaying` 여부에 따라 로직을 분기하는 것이 더 효율적일 수 있습니다.
2.  **`StoryCard.js` CSS로 개선**:
    - 제목을 한 줄로 제한하고 말 줄임표(...)를 표시하는 것은 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;` CSS 속성으로 간단히 해결할 수 있습니다.
    - 요약 글을 4줄로 제한하는 것은 Tailwind CSS의 `line-clamp-4` 유틸리티 클래스(`-webkit-line-clamp: 4;`)를 사용하여 JavaScript 없이 구현할 수 있습니다. 이미 `line-clamp-4` 클래스가 적용되어 있으므로 `useEffect` 내의 관련 로직은 제거해도 됩니다.

### 3.4. 성능 최적화

#### 현황
- **폰트 로딩**: `styles/globals.css`에서 Google Fonts를 `@import` 규칙으로 가져오고, 나머지 웹 폰트는 `@font-face`를 사용해 CDN에서 직접 로드하고 있습니다. 이는 렌더링 차단 리소스가 되어 초기 로딩 속도에 영향을 줍니다.
- **이미지 최적화**: `ResponsiveImage` 컴포넌트를 만들어 이미지 최적화를 시도한 점은 훌륭합니다. 하지만 `next/image`를 사용하지 않고 직접 구현하여 `priority`, `quality` 등 Next.js의 강력한 최적화 기능을 완전히 활용하지 못하고 있습니다.
- **`dynamic import`**: `react-slick` 라이브러리를 `dynamic`으로 가져오는 것은 좋은 시도지만, `ssr: false` 옵션으로 인해 서버 사이드 렌더링의 이점을 포기하게 됩니다.

#### 제안
1.  **`next/font` 도입**: Next.js 13 이상에서 도입된 `@next/font`를 사용하여 폰트를 최적화하세요. 빌드 시점에 폰트 파일이 함께 번들링되고, 렌더링 차단 없이 효율적으로 로딩되어 레이아웃 이동(Layout Shift)을 방지합니다.
    - 예시: `import { Montserrat } from 'next/font/google';`
2.  **`next/image` 활용**: `ResponsiveImage` 컴포넌트를 `next/image` 기반으로 재작성하거나 직접 `next/image`를 사용하세요. 이를 통해 이미지 포맷(WebP) 자동 변환, 사이즈 최적화, `priority` 속성을 통한 중요 이미지 선행 로딩 등 다양한 성능 향상 효과를 얻을 수 있습니다.
    ```jsx
    import Image from 'next/image';

    <Image
      src="/images/studio1.jpg"
      alt="스튜디오 놀"
      width={500}
      height={300}
      sizes="(min-width: 1024px) 50vw, 100vw"
      priority // 첫 화면에 보이는 중요한 이미지일 경우
    />
    ```
3.  **코드 스플리팅**: `dynamic import` 사용 시 꼭 필요한 경우가 아니면 `ssr: false` 옵션을 피해야 합니다. 서버에서도 렌더링되게 하여 초기 로딩 경험을 개선하고, 클라이언트에서는 필요한 시점에 라이브러리가 로드되도록 하는 것이 이상적입니다.

## 4. 결론 및 우선순위 제안

현재 코드베이스는 안정적이고 확장 가능한 기반을 갖추고 있습니다. 아래 우선순위에 따라 개선 작업을 진행하는 것을 추천합니다.

1.  **높은 우선순위 (즉각적인 성능 향상)**
    - `next/font`를 사용하여 폰트 로딩 최적화.
    - `portfolio.js`에서 `getStaticProps`를 사용하도록 데이터 fetching 로직 변경.
    - `StoryCard.js`의 `useEffect` DOM 조작 로직을 CSS(`line-clamp`)로 대체.

2.  **중간 우선순위 (유지보수성 및 코드 품질 향상)**
    - `AudioPlayer.js`를 `useReducer` 또는 경량 상태 관리 라이브러리로 리팩터링.
    - `lib/stories.js`에 `try...catch`를 사용한 에러 처리 추가.
    - `sharp` 패키지를 `dependencies`로 이동.

3.  **낮은 우선순위 (장기적인 개선)**
    - 점진적으로 TypeScript 도입 시작.
    - `swr` 라이브러리를 도입하여 클라이언트 사이드 데이터 관리 개선.
    - `ResponsiveImage` 컴포넌트를 `next/image` 기반으로 고도화.
