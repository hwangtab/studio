# 웹사이트 개선 제안 보고서 (Improvement Report)

> **분석 일자:** 2026-02-04
> **대상:** Studio Nol 웹사이트 코드베이스

이 보고서는 현재 웹사이트의 코드 품질, 성능, SEO, 유지보수성을 향상시키기 위한 개선점들을 제안합니다. 앞서 수행한 "버그 및 충돌" 리뷰와는 별도로, **더 나은 구조와 품질**을 위한 제안입니다.

## 1. 코드 품질 및 타입 안전성 (Type Safety & Quality)

### IMP-1: 불필요한 `@ts-ignore` 및 `as any` 제거
- **현상**: `pages/index.tsx`, `pages/portfolio.tsx` 등 주요 페이지에서 `SEO` 컴포넌트나 `ImageHero` 컴포넌트에 대해 `// @ts-ignore` 또는 `as any` 캐스팅이 사용되고 있습니다.
- **이유**: 초기 개발 단계에서 타입 정의가 불완전하거나 JS 파일 호환성 문제로 추가된 것으로 보이나, 현재는 대부분 `.tsx`로 변환되었으므로 불필요합니다.
- **개선 방안**:
  - `SEO.tsx`의 Props 인터페이스를 정확히 정의하여 `pages/index.tsx` 등에서 올바르게 데이터를 전달하도록 수정.
  - `Home` 컴포넌트의 `hasHero` 속성을 위한 커스텀 타입 정의 (`NextPageWithLayout` 등).

### IMP-2: 컴포넌트 Props 인터페이스 구체화
- **현상**: 일부 컴포넌트에서 `any` 타입을 사용하거나 Props 타입이 느슨하게 정의되어 있습니다.
- **개선 방안**:
  - 모든 컴포넌트의 Props에 대해 `interface`를 명시적으로 선언.
  - 특히 `children`을 받는 컴포넌트는 `React.PropsWithChildren` 활용.

## 2. SEO 및 메타데이터 구조화 (SEO & Metadata)

### IMP-3: Schema.org 데이터 생성 로직 분리
- **현상**: `components/SEO.tsx` 내부에 거대한 JSON-LD 객체 생성 로직(`defaultSchema`)이 포함되어 있어 가독성이 떨어지고 수정이 어렵습니다.
- **개선 방안**:
  - `utils/schemaGenerator.ts` 등의 유틸리티 파일로 스키마 생성 로직을 분리.
  - 비즈니스 정보(주소, 전화번호 등)를 `data/siteConfig.ts`와 같은 설정 파일에서 가져오도록 중앙화.

### IMP-4: 이미지 최적화 설정 검토 (Next.js Config)
- **현상**: `next.config.mjs`에 `output: 'export'`와 `images: { unoptimized: true }`가 설정되어 있습니다.
- **분석**: 정적 호스팅(GitHub Pages 등)을 위한 설정이라면 올바르지만, Vercel 등에 배포하는 경우라면 `unoptimized: true`는 Next.js의 강력한 이미지 최적화 기능을 포기하는 것입니다.
- **개선 방안**:
  - **배포 환경 확인**: Vercel 배포 시 `output: 'export'` 제거 및 `unoptimized: false`로 변경 권장.
  - 정적 배포 유지 시: 현재 설정 유지하되, 빌드 타임 이미지 최적화 스크립트(`scripts/optimizeImages.js`) 활용도 점검.

## 3. 성능 및 사용자 경험 (Performance & UX)

### IMP-5: 폰트 최적화
- **현상**: `pages/_app.tsx`에서 `next/font/google`을 사용하고 있으나, 전역 스타일 적용 방식(`div className={montserrat.variable}`)을 확인 필요.
- **개선 방안**:
  - `montserrat` 외에 한글 폰트(Pretendard 등)도 `next/font/local` 또는 최적화된 방식으로 로드하여 CLS(Cumulative Layout Shift) 방지.

### IMP-6: 접근성(Accessibility) 강화
- **현상**: 일부 버튼이나 링크에 `aria-label`이 누락될 수 있음.
- **개선 방안**:
  - `eslint-plugin-jsx-a11y` 규칙을 엄격하게 적용하여 모든 인터랙티브 요소에 적절한 라벨링 적용.
  - 색상 대비(Color Contrast) 확인 (특히 다크 모드 시).

## 4. 프로젝트 구조 (Project Structure)

### IMP-7: 상수 및 데이터 중앙 관리
- **현상**: `homeFaqs` 등이 `pages/index.tsx` 내부에 하드코딩되어 있습니다.
- **개선 방안**:
  - `data/home.ts` 또는 `data/faq.ts`로 데이터를 이동하여 콘텐츠와 프레젠테이션 로직 분리.
  - 유지보수 시 컴포넌트 코드를 건드리지 않고 데이터만 수정 가능하도록 개선.

---

## 추천 우선순위

1. **IMP-1, IMP-2**: 타입 안전성 확보 (가장 시급하며 버그 예방 효과 큼)
2. **IMP-7**: 데이터 분리 (코드 가독성 및 유지보수성 향상)
3. **IMP-3**: SEO 로직 분리
4. **IMP-4**: 배포 전략에 따른 이미지 설정 재검토
