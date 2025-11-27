# 성능 및 속도 코드 리뷰 (2025년 11월 27일)

## 종합 평가

현재 코드베이스는 Next.js의 성능 최적화 모범 사례를 매우 잘 따르고 있어 전반적으로 우수합니다. 정적 사이트 생성(SSG)과 증분 정적 재생성(ISR)을 핵심 전략으로 사용하여 페이지 로딩 속도를 극대화하고 있으며, `next/image`를 통한 이미지 최적화, `next/font`를 이용한 폰트 로딩, `next/dynamic`을 활용한 코드 분할 등 주요 성능 최적화 기법들이 효과적으로 적용되어 있습니다.

특히 `AudioPlayer`와 `MediaGallery` 컴포넌트에서 `next/dynamic`을 올바르게 활용하고 있으며, 이미지의 `sizes` 속성도 대체로 구체적으로 설정되어 있어 반응형 이미지 최적화가 잘 구현되었습니다.

다만, 몇 가지 사소한 개선을 통해 프로젝트를 더욱 완벽하게 다듬을 수 있습니다. 특히 불필요한 의존성 제거와 CSS 로딩 전략 최적화가 우선순위입니다.

## 개선 제안

### 1. 레거시 코드 및 의존성 제거

- **문제점:** `package.json`에 포함된 `sharp` 라이브러리와 `public/images/optimized` 디렉터리는 현재 사용되지 않는 과거 이미지 최적화 시스템의 유산으로 보입니다. 이러한 불필요한 코드는 유지보수 부담을 가중시키고 프로젝트의 복잡성을 높일 수 있습니다.
- **해결 방안:**
    - `npm uninstall sharp` 또는 `yarn remove sharp` 명령어를 실행하여 `sharp` 의존성을 제거합니다.
    - `public/images/optimized` 디렉터리를 삭제하여 프로젝트 구조를 단순화합니다.

### 2. CSS 로딩 최적화

- **현재 상태:** `pages/_app.js` 파일에서 `slick-carousel`의 CSS를 전역으로 불러오고 있습니다. 캐러셀이 없는 페이지에서도 불필요하게 로드되고 있습니다.
- **추가 정보:** `MediaGallery.js`에서는 이미 `react-slick`을 `next/dynamic`으로 동적 임포트(`ssr: false`)하고 있으나, CSS는 전역에서 로드되고 있어 동적 로딩의 이점이 부분적으로만 활용되고 있습니다.
- **해결 방안 (권장):**
    - **옵션 A (권장)**: `_app.js`에서 CSS 임포트를 제거하고, `MediaGallery.js` 또는 이를 사용하는 페이지(예: `practice-room.js`)에서 CSS를 동적으로 임포트합니다.
      ```javascript
      // MediaGallery.js 최상단에 추가
      import 'slick-carousel/slick/slick.css';
      import 'slick-carousel/slick/slick-theme.css';
      ```
    - **옵션 B (대안)**: CSS-in-JS 라이브러리(styled-components 등) 활용으로 스타일 로딩을 동적화합니다.
    - **주의사항**: 동적 임포트 시 초기 렌더링 직후 스타일이 적용되는 FOUC(Flash of Unstyled Content)가 발생할 수 있으므로, 초기 로드 상태를 고려해야 합니다.

### 3. 코드 분할(Code Splitting) 최적화

- **현재 상태:**
    - ✅ `react-slick`은 이미 `MediaGallery.js`에서 `next/dynamic`으로 동적 임포트(`ssr: false`)되어 있습니다. 초기 번들에 포함되지 않으므로 이 부분은 최적화되었습니다.
    - ✅ `AudioPlayer` 컴포넌트도 `portfolio.js`에서 `next/dynamic`으로 동적 임포트되어 있습니다.
    - ⚠️ **개선 필요**: `package.json`에는 `react-grid-gallery`가 의존성으로 포함되어 있으나, 현재 코드베이스 어디에서도 사용되지 않는 미사용 의존성입니다.
- **해결 방안:**
    - `react-grid-gallery` 의존성을 제거합니다 (npm uninstall react-grid-gallery).
    - 향후 새로운 무거운 라이브러리를 추가할 때는 위의 `AudioPlayer`와 `MediaGallery` 구현을 참고하여 `next/dynamic`을 적극 활용하세요.

### 4. 이미지 `sizes` 속성 - 현황 및 미세 최적화

- **현재 상태:** 대부분의 이미지에서 이미 구체적인 `sizes` 속성이 잘 구현되어 있습니다.
    - ✅ `MediaGallery.js:52`: `"(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 90vw"` (반응형으로 구체적)
    - ✅ `PortfolioCard.js:24`: `"(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"` (그리드 레이아웃 기반)
    - ✅ `ResponsiveImage.js`의 기본값 `100vw`는 각 사용처에서 필요에 따라 오버라이드됩니다.
- **미세 최적화 (선택사항):**
    - 일부 페이지 헤로 섹션의 이미지가 전체 화면 너비를 차지하지 않는 경우, 더 정밀한 `sizes` 값을 설정할 수 있습니다.
    - 예: 페이지 최대 너비가 1280px인 경우, `"(min-width: 1280px) 1280px, 100vw"` 같이 절대값 사용 가능.
    - 효과는 미미하지만 모바일에서 필요 이상 큰 이미지 다운로드를 방지할 수 있습니다.
