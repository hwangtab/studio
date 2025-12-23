# 포트폴리오 팝업 카드 및 SNS 공유 기능 구현

## 개요

포트폴리오 카드 클릭 시 팝업(모달)이 표시되고, 각 포트폴리오가 고유 URL과 메타데이터를 가져 SNS에 공유할 수 있도록 구현되었습니다.

## 핵심 기능

1. **팝업 모달**: 카드 클릭 시 상세 정보가 모달로 표시
2. **고유 URL**: 각 포트폴리오가 `/portfolio/[id]` 형태의 고유 URL 보유
3. **SNS 공유**: Open Graph 메타태그로 SNS 공유 시 썸네일과 설명 표시
4. **외부 링크**: 모달에서 원본 음원 페이지로 이동 가능

## 구현 방식

### 동적 라우팅 + 모달 하이브리드

| 진입 방식 | 결과 |
|-----------|------|
| 목록 페이지에서 카드 클릭 | 모달로 팝업 표시 (URL: `/portfolio/[id]`) |
| URL 직접 접근 | 전체 상세 페이지 렌더링 |
| 모달 닫기/뒤로가기 | URL이 `/portfolio`로 복원 |

### Shallow Routing

Next.js의 `shallow: true` 옵션을 사용하여 페이지 새로고침 없이 URL만 변경합니다.

```javascript
router.push(`/portfolio?item=${item.id}`, `/portfolio/${item.id}`, { shallow: true });
```

## 파일 구조

```
/pages/
  portfolio.js                    # 목록 페이지 + 모달 통합
  portfolio/
    [id].js                       # 상세 페이지 (직접 접근용)

/components/
  PortfolioDetailModal.js         # 모달 컴포넌트
  ui/
    PortfolioCard.js              # 카드 컴포넌트 (onClick 지원)
```

## 주요 컴포넌트

### 1. PortfolioDetailModal.js

모달 팝업 컴포넌트입니다.

**기능:**
- 앨범 아트 이미지 표시
- 카테고리 배지, 제목, 아티스트명
- 서비스 태그 리스트
- "음원 들으러 가기" 외부 링크 버튼
- 공유 버튼 (navigator.share API)
- ESC 키 닫기, 오버레이 클릭 닫기
- 스크롤 잠금

**Props:**
- `item`: 포트폴리오 항목 객체
- `onClose`: 모달 닫기 함수

### 2. portfolio/[id].js

SSG(Static Site Generation)로 생성되는 상세 페이지입니다.

**SEO 지원:**
- Open Graph 메타태그
- Twitter Card
- 동적 title, description

### 3. PortfolioCard.js

포트폴리오 카드 컴포넌트입니다.

**변경 사항:**
- `href` 대신 `onClick` prop 사용
- 아이콘: FaExternalLinkAlt → FaEye (상세 보기)

## 사용법

### 새 포트폴리오 추가

`/data/portfolio.js`에 항목 추가:

```javascript
{
    "id": "unique-id",           // 고유 ID (URL에 사용)
    "title": "제목",
    "description": "설명",
    "image": "이미지 URL",
    "link": "외부 링크 URL",
    "category": "single|album|compilation|commercial",
    "services": ["레코딩", "믹싱"],
    "artist": "아티스트명"
}
```

### 공유 URL

```
https://studionol.co.kr/portfolio/[id]
```

예시: `https://studionol.co.kr/portfolio/the-projectors-babu-first-flight`

## 기술 스택

- **Next.js Pages Router**: 동적 라우팅, getStaticPaths/Props
- **Framer Motion**: 모달 애니메이션
- **Tailwind CSS**: 스타일링
- **navigator.share API**: 네이티브 공유 기능

## 테스트

### 모달 동작 테스트
1. 포트폴리오 페이지에서 카드 클릭
2. 모달 팝업 확인
3. URL 변경 확인 (`/portfolio/[id]`)
4. 뒤로가기 시 모달 닫힘 확인
5. ESC 키로 닫기 확인

### SNS 공유 테스트
1. Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
2. Twitter Card Validator: https://cards-dev.twitter.com/validator

URL 입력: `https://studionol.co.kr/portfolio/[id]`

## 향후 개선 사항

1. 관련 포트폴리오 표시 (같은 카테고리)
2. 이미지 갤러리 기능
3. 오디오 미리듣기 기능
