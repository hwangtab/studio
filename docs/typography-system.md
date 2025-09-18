# Typography System Documentation

## 개요

스튜디오 놀 웹사이트의 폰트 계층 시스템은 콘텐츠의 가독성을 높이고 시각적 위계를 명확히 하기 위해 설계되었습니다. 텍스트가 많은 웹사이트 특성상, 6단계의 폰트 웨이트를 통해 정보의 중요도를 직관적으로 구분할 수 있도록 구성했습니다.

## 기술 스택

### 주요 폰트
- **GmarketSans**: 메인 폰트 (Medium, Light, Bold)
- **Pretendard**: 얇은 웨이트용 보조 폰트 (Thin, Extra Light)
- **Montserrat**: 영문 및 숫자용 폰트
- **PartialSansKR**: 로고 전용 폰트

### 폰트 로딩 방식
- **CDN 기반**: jsdelivr CDN을 통한 안정적인 폰트 제공
- **Fallback 체계**: 'GmarketSans' → 'Pretendard' → 'Noto Sans KR' → 'sans-serif'

## 폰트 웨이트 계층 구조

### 6단계 계층 시스템

| 웨이트 | 폰트 소스 | 용도 | Tailwind 클래스 | 예시 |
|--------|----------|------|----------------|------|
| **100 (Thin)** | Pretendard-Thin | 캡션, 메타데이터 | `text-thin`, `caption` | 포트폴리오 시간 표시, 작은 안내 텍스트 |
| **200 (Extra Light)** | Pretendard-Light | 보조 설명 텍스트 | `text-extra-light`, `body-2` | 카드 설명, 폼 안내 메시지 |
| **300 (Light)** | GmarketSans-Light | 일반 설명 텍스트 | `font-light` | 문단 설명, 리스트 아이템 |
| **400 (Regular)** | GmarketSans-Medium | 기본 본문 | `body-1` | 일반 본문 텍스트 |
| **500 (Medium)** | GmarketSans-Medium | 부제목 | `subtitle-1`, `subtitle-2` | 섹션 부제목 |
| **700 (Bold)** | GmarketSans-Bold | 주제목 | `heading-1`, `heading-2`, `heading-3` | 메인 제목, 강조 텍스트 |

## 페이지별 적용 현황

### ✅ 완료된 페이지
- **About**: 전체 적용 완료 (메인 설명, 서비스 카드, 리스트 아이템, 푸터)
- **Contact**: 폼 관련 텍스트 적용 완료
- **Portfolio**: 메타데이터 및 시간 표시 적용 완료
- **PracticeRoom**: 설명 텍스트 적용 완료

### ⏳ 부분 적용된 페이지
- **Home**: 서비스 카드 설명 부분만 적용
- **Stories**: 메인 설명 텍스트 미적용
- **StoryDetail**: 메타데이터 영역만 적용

### ❌ 미적용 페이지
- **Services**: 전체 미적용
- **Studio**: 설명 문단들 미적용

## Tailwind 커스텀 클래스 정의

### 새로 추가된 클래스
```javascript
// tailwind.config.js
fontSize: {
  'text-thin': ['1rem', { lineHeight: '1.5', fontWeight: '100' }],
  'text-extra-light': ['0.875rem', { lineHeight: '1.5', fontWeight: '200' }],
  'body-2': ['0.875rem', { lineHeight: '1.5', fontWeight: '200' }],
  'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '100' }],
}
```

### 컴포넌트 레벨 유틸리티 (2025 리팩토링)

| 클래스 | 포함 스타일 | 주 용도 |
|--------|-------------|---------|
| `typo-nav-link` | `text-body-2` + `font-medium` + `tracking-tight` | 전역 네비게이션 메뉴 |
| `typo-section-title` | `text-heading-2` + `font-title` | 섹션 제목 (히어로 제외) |
| `typo-section-lead` | `text-body-1-light` + `leading-relaxed` | 섹션 리드 문단 |
| `typo-card-title` | `text-subtitle-2` + `font-title` | 카드 제목, 리스트 헤더 |
| `typo-card-body` | `text-body-1-light` | 카드/리스트 본문 텍스트 |
| `typo-card-meta` | `text-caption` + tracking | 메타 데이터, 태그 |
| `typo-card-cta` | `text-body-2` + `font-medium` | 카드 CTA, 인라인 링크 |
| `typo-footer-heading` | `text-subtitle-2` + `font-title` | 푸터 섹션 제목 |
| `typo-footer-body` | `text-body-1-light` | 푸터 설명 및 링크 텍스트 |
| `typo-footer-meta` | `text-caption` | 푸터 저작권, 주소 |

> **주의:** 헤더 로고(`font-logo`)와 홈 히어로 섹션의 타이포그래피는 디자인 포인트이므로 리팩토링 대상에서 제외합니다.

### 폰트 페이스 정의
```css
/* src/index.css */
@font-face {
  font-family: 'GmarketSans';
  font-weight: 100;
  src: url('https://cdn.jsdelivr.net/gh/Project-Noonnu/noonfonts_2107@1.1/Pretendard-Thin.woff') format('woff');
}

@font-face {
  font-family: 'GmarketSans';
  font-weight: 200;
  src: url('https://cdn.jsdelivr.net/gh/Project-Noonnu/noonfonts_2107@1.1/Pretendard-Light.woff') format('woff');
}
```

## 적용 가이드라인

### 새 컴포넌트 작성 시 규칙

1. **제목 계층**:
   - H1: `text-heading-1 font-title` (Bold, 2.5rem)
   - H2: `text-heading-2` (Bold, 2.5rem)
   - H3: `text-heading-3` (Medium, 1.5rem)

2. **본문 텍스트**:
   - 중요 문단: `text-body-1` (Regular, 1rem)
   - 설명 문단: `font-light` (Light, 기본 사이즈)
   - 보조 설명: `text-extra-light` (Extra Light, 0.875rem)

3. **UI 요소**:
   - 버튼 텍스트: `text-extra-light` 또는 `font-medium`
   - 폼 안내: `text-extra-light`
   - 메타데이터: `text-thin` 또는 `caption`

### 예시 코드

```jsx
// 올바른 적용 예시
<div className="service-card">
  <h3 className="text-heading-3 font-bold">서비스 제목</h3>
  <p className="text-gray-600 dark:text-gray-300 font-light leading-relaxed">
    서비스에 대한 주요 설명 문단입니다.
  </p>
  <p className="text-extra-light text-gray-500">
    부가적인 정보나 안내 사항입니다.
  </p>
</div>
```

## 향후 리팩토링 계획

### 우선순위 1: 미적용 페이지
1. **Services 페이지**:
   - ServiceCard 컴포넌트의 description에 `font-light` 적용
   - 메인 설명 문단에 적절한 웨이트 적용

2. **Studio 페이지**:
   - 장비 설명 문단들에 `font-light` 적용
   - 스튜디오 소개 텍스트 계층화

3. **Stories 페이지**:
   - 메인 설명 문단 개선
   - StoryCard 컴포넌트 description 개선

### 우선순위 2: 성능 최적화
1. **폰트 로딩 최적화**:
   - 사용하지 않는 웨이트 제거
   - font-display: swap 최적화

2. **번들 사이즈 최적화**:
   - 불필요한 폰트 파일 정리
   - subset 폰트 도입 검토

### 우선순위 3: 디자인 시스템 확장
1. **다크모드 최적화**:
   - 다크모드에서의 폰트 가독성 검증
   - 대비율 개선

2. **반응형 최적화**:
   - 모바일에서의 폰트 크기 조정
   - 터치 환경 고려

## 알려진 이슈 및 해결책

### 이슈 1: 로컬 폰트 파일 빌드 실패
**문제**: CSS에서 로컬 폰트 파일 경로 인식 불가
**해결책**: CDN 기반 폰트 로딩으로 전환

### 이슈 2: 일부 브라우저에서 얇은 폰트 렌더링 이슈
**문제**: Windows 환경에서 얇은 폰트 표시 문제
**대응**: Pretendard 폰트 추가로 크로스 플랫폼 호환성 확보

### 이슈 3: 폰트 로딩 지연
**현재 상태**: font-display: swap으로 기본 대응
**향후 개선**: 폰트 preload 적용 검토

## 유지보수 가이드

### 정기 점검 사항
1. **월 1회**: 새로 추가된 페이지의 폰트 적용 상태 확인
2. **분기 1회**: 폰트 로딩 성능 모니터링
3. **연 1회**: 사용하지 않는 폰트 웨이트 정리

### 새 팀원 온보딩
1. 이 문서 숙지
2. Tailwind 커스텀 클래스 이해
3. 실제 적용 예시 코드 리뷰

---

**마지막 업데이트**: 2025-01-18
**작성자**: Claude Code Assistant
**버전**: 1.0
