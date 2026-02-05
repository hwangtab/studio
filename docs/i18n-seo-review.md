# i18n SEO 코드리뷰 보고서

현재 스튜디오 놀 프로젝트의 다국어 SEO 구현 상태를 검토한 결과입니다.

## 1. i18n 구현 방식 검토
- **현재 방식**: `[locale]` 동적 경로(Dynamic Route)를 이용한 수동 다국어 라우팅
- **이유**: `next.config.mjs`에서 `output: 'export'`(정적 내보내기)를 사용 중이므로, Next.js의 내장 `i18n` 설정(`locales`, `defaultLocale`)을 사용할 수 없는 구조입니다.
- **평가**: 정적 웹사이트 구축을 위한 올바른 선택이며, 수동으로 다국어 SEO를 관리하고 있습니다.

## 2. SEO 이점 확보 현황

### ✅ 잘 구현된 점 (이점 얻고 있음)
1. **Hreflang 태그 (`SEO.tsx`)**:
   - `rel="alternate" hreflang="..."` 태그가 모든 언어(ko, en, zh, es, vi, th, uz)에 대해 정확하게 삽입되고 있습니다.
   - 이는 검색 엔진(Google 등)에 해당 페이지의 다국어 버전을 알려주는 가장 중요한 요소입니다.
2. **x-default 설정**:
   - 언어 설정이 없는 사용자에게 보여줄 기본값(`ko`)을 `x-default`로 잘 지정하고 있습니다.
3. **Canonical URL**:
   - 각 언어별 경로에 맞는 정본 URL(Canonical)이 생성되어 중복 콘텐츠 문제를 방지하고 있습니다.
4. **Open Graph 다국어 대응**:
   - `og:locale` 및 `og:locale:alternate`를 통해 SNS 공유 시에도 다국어 정보가 전달됩니다.

### ⚠️ 개선이 필요한 점 (이점 놓치고 있는 부분)
1. **HTML `lang` 속성 (`_document.tsx`)**:
   - 현재 `<Html lang="ko">`로 고정되어 있습니다.
   - `next export`의 한계상 `_document.tsx`에서 동적으로 처리하기 어렵지만, 현재는 모든 언어 페이지가 검색 엔진에 일단 '한국어'로 인식될 위험이 있습니다. (클라이언트 사이드에서 JS로 수정하고 있으나, 크롤러에겐 초기 HTML이 중요합니다.)
2. **Sitemap 다국어 링크 (`next-sitemap.config.js`)**:
   - 현재 사이트맵에는 단순 URL 목록만 나열될 뿐, 각 URL의 다국어 버전(xhtml:link) 정보가 포함되지 않고 있습니다.

## 3. 권장 개선 방안
- **사이트맵 보강**: `next-sitemap` 설정에서 `alternateRefs` 기능을 활성화하여 사이트맵 단계에서도 언어 간 연결 정보를 강화할 수 있습니다.
- **HTML Lang 자동화**: 정적 배포 후 사후 처리(post-processing) 스크립트를 통해 각 `index.html`의 `lang` 속성을 해당 언어 코드로 치환하는 것을 권장합니다.

## 종합 평가
**"절반 이상의 이점을 얻고 있으나, 기술적 제약으로 인해 완벽하지는 않은 상태"**입니다.
가장 중요한 `hreflang` 태그가 `SEO.tsx`를 통해 완벽하게 제어되고 있으므로, 검색 노출 자체에는 큰 무리가 없습니다. 다만, 위에 언급한 사이트맵과 HTML lang 속성까지 보강한다면 '완벽한' 다국어 SEO가 완성됩니다.
