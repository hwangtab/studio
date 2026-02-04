# 다국어(i18n) 지원 구현 계획 (Next.js Static Export)

이 문서는 스튜디오 놀 웹사이트의 다국어(한국어, 영어, 중국어, 스페인어) 지원을 위한 구현 계획을 담고 있습니다. 현재 프로젝트가 `output: 'export'`(정적 HTML 내보내기) 설정을 사용하고 있으므로, 이에 최적화된 **Path-based Routing** 전략을 채택합니다.

## 1. 목표 및 전략

*   **지원 언어**: 한국어(기본), 영어(en), 중국어(zh), 스페인어(es)
*   **URL 구조**: `/ko/about`, `/en/about`, `/zh/about`, `/es/about`
    *   정적 호스팅 환경(Vercel, S3 등)에서의 SEO 최적화를 위해 언어별 고유 URL을 가집니다.
    *   기본 경로(`/`) 접속 시 브라우저 언어 설정을 감지하여 적절한 언어 경로로 리다이렉트하거나 기본 언어(예: `/ko`)로 이동합니다.
*   **기술 스택**:
    *   `react-i18next`: 클라이언트 사이드 번역 및 훅(`useTranslation`) 제공
    *   **Next.js Dynamic Routes**: `pages/[locale]/...` 구조를 사용하여 정적 페이지 생성

## 2. 주요 변경 사항

### 2.1 디렉토리 구조 변경

기존 `pages` 디렉토리의 파일들을 `pages/[locale]` 하위로 이동해야 합니다.

**변경 전:**
```
pages/
  index.tsx
  about.tsx
  contact.tsx
  portfolio/
    index.tsx
    [id].tsx
  ...
```

**변경 후:**
```
pages/
  index.tsx          <-- 언어 감지 및 리다이렉트 역할 (Root)
  [locale]/
    index.tsx        <-- 실제 메인 페이지
    about.tsx
    contact.tsx
    portfolio/
      index.tsx
      [id].tsx
    ...
```

### 2.2 라이브러리 설정

`i18next` 설정을 위한 유틸리티 파일을 생성합니다.

*   파일: `lib/i18n.ts` (또는 `utils/i18n.ts`)
*   내용: 지원 언어 목록 정의, 기본 언어 설정, `react-i18next` 초기화.

### 2.3 데이터 관리 전략

#### A. 정적 텍스트 (UI 레이블)
`public/locales` 폴더에 JSON 파일로 관리합니다.
```
public/
  locales/
    ko/
      common.json (헤더, 푸터, 버튼 등 공통 텍스트)
      home.json
      about.json
    en/
      common.json
      ...
```

#### B. 데이터 파일 (`data/*.ts`)
현재 `data` 폴더의 TypeScript 파일들은 객체 내에 언어별 키를 두거나, 함수 형태로 변경하여 로케일에 맞는 데이터를 반환하도록 수정합니다.

**예시 (객체 키 방식 - 추천):**
```typescript
// data/home.ts
export const homeData = {
  heroTitle: {
    ko: "음악이 시작되는 곳",
    en: "Where Music Begins",
    zh: "音乐开始的地方",
    es: "Donde Comienza la Música"
  },
  // ...
}
```

#### C. 콘텐츠 파일 (`content/stories/*.md`)
파일명에 언어 코드를 포함시켜 구분합니다.
*   `bulgwang-mixing-club.ko.md` (또는 기존 유지)
*   `bulgwang-mixing-club.en.md`
*   `bulgwang-mixing-club.zh.md`

`lib/stories.ts`를 수정하여 현재 로케일에 맞는 파일을 불러오도록 로직을 변경합니다.

## 3. 상세 구현 단계

### 1단계: 기본 설정 및 설치
이미 `i18next`, `react-i18next`가 설치되어 있습니다. `lib/i18n.ts`를 작성하여 설정을 잡습니다.

### 2단계: 번역 리소스 준비
`public/locales/{lang}/common.json` 등을 생성하고 주요 UI 텍스트(네비게이션 메뉴 등)를 번역하여 입력합니다.

### 3단계: 페이지 라우팅 구조 변경 (가장 큰 작업)
1.  `pages/[locale]` 폴더 생성.
2.  기존 페이지 파일들을 해당 폴더로 이동.
3.  각 페이지의 `getStaticPaths`에서 지원하는 모든 `locale`을 경로로 생성하도록 설정.
    ```typescript
    export async function getStaticPaths() {
      const locales = ['ko', 'en', 'zh', 'es'];
      const paths = locales.map((locale) => ({ params: { locale } }));
      return { paths, fallback: false };
    }
    ```
4.  `getStaticProps`에서 해당 `locale` 정보를 받아 컴포넌트에 전달.

### 4단계: 컴포넌트 수정
1.  `Layout` 컴포넌트 등에서 `useRouter` 대신 `params.locale` 또는 props로 전달받은 로케일을 사용.
2.  `Link` 컴포넌트를 래핑한 `LinkWithLocale` 컴포넌트 생성 (현재 언어를 유지하며 이동하도록).
3.  하드코딩된 텍스트들을 `t('key')` 형태로 변환.

### 5단계: SEO 태그 적용
`components/SEO.tsx`를 수정하여 언어별 대체 페이지(`hreflang`) 태그를 생성합니다.
```html
<link rel="alternate" hreflang="ko" href="https://studionol.co.kr/ko/..." />
<link rel="alternate" hreflang="en" href="https://studionol.co.kr/en/..." />
```

### 6단계: 언어 전환기(Language Switcher) UI 추가
헤더나 푸터에 언어 변경 드롭다운/버튼을 추가합니다. 클릭 시 해당 언어의 경로로 이동합니다 (예: `/ko/about` -> `/en/about`).

## 4. 예상 소요 시간 및 우선순위
1.  **구조 변경 및 설정**: 1~2일 (핵심 기능)
2.  **UI 텍스트 번역**: 1일 (리소스 필요)
3.  **데이터/콘텐츠 분리 및 번역**: 지속적 (콘텐츠 양에 따라 다름)

## 5. 주의사항
*   **이미지**: 텍스트가 포함된 이미지는 언어별로 별도 제작이 필요할 수 있습니다.
*   **레이아웃**: 언어별 텍스트 길이에 따라 UI가 깨지지 않는지 확인해야 합니다 (특히 독일어/스페인어는 길어질 수 있음).
*   **폰트**: 중국어(간체/번체) 지원을 위해 적절한 웹폰트 설정이 필요할 수 있습니다 (현재는 시스템 폰트나 구글 폰트 확인 필요).
