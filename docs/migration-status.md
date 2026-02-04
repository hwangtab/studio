# 다국어 마이그레이션 현황 (완료)

## 완료된 작업
- [x] **기본 설정**: `lib/i18n.ts`, `lib/getStatic.ts` 생성
- [x] **리소스**: `public/locales` 디렉토리 및 기본 `common.json` 생성
- [x] **데이터 다국어화**:
    - `data/home.ts`, `data/faq.ts`
    - `data/pricing.ts`
    - `data/equipment.ts`
- [x] **로직 개선**: `lib/stories.ts`가 언어별 마크다운 파일(`.en.md` 등)을 인식하도록 수정
- [x] **UI**: `Layout.tsx` 언어 감지 및 `LanguageSwitcher.tsx` 추가
- [x] **전체 페이지 마이그레이션**:
    - `pages/[locale]/index.tsx` (홈)
    - `pages/[locale]/about.tsx` (소개)
    - `pages/[locale]/contact.tsx` (문의)
    - `pages/[locale]/pricing.tsx` (가격)
    - `pages/[locale]/studio-info.tsx` (장비)
    - `pages/[locale]/practice-room.tsx` (연습실)
    - `pages/[locale]/lesson.tsx` (레슨)
    - `pages/[locale]/portfolio/` (포트폴리오 목록 및 상세)
    - `pages/[locale]/stories/` (스토리 목록 및 상세)
- [x] **리다이렉트**: 기존 모든 루트 경로(`pages/*.tsx`)를 해당 언어 경로로 리다이렉트 처리

## 향후 과제
- **콘텐츠 번역**: `public/locales`의 JSON 파일과 `data/*.ts` 내의 번역 텍스트를 완성해야 합니다 (현재 영어 일부 적용됨).
- **마크다운 번역**: 특정 스토리를 번역하려면 `파일명.en.md`와 같이 파일을 생성하면 자동으로 해당 언어 페이지에서 노출됩니다.
- **이미지 텍스트**: 텍스트가 포함된 이미지가 있다면 언어별로 별도 제작을 고려하세요.

## 운영 가이드
- 새로운 페이지 추가 시 `pages/[locale]/` 내부에 생성하고 `lib/getStatic.ts`의 헬퍼를 사용하세요.
- 모든 내부 링크는 `/${locale}/path` 형식을 사용해야 언어 설정이 유지됩니다.