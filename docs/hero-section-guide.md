# ImageHero 컴포넌트 가이드

## 개요

`ImageHero`는 페이지 상단에 이미지 배경을 가진 히어로 섹션을 렌더링하는 컴포넌트입니다. 모든 페이지에서 일관된 히어로 섹션을 제공하며, 파셜산스(PartialSansKR) 폰트로 제목을 표시합니다.

## 파일 위치

```
/components/common/ImageHero.js
```

## Props

| Prop | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| `title` | `string \| ReactNode` | O | - | 메인 제목 (font-logo 적용) |
| `subtitle` | `string \| ReactNode` | X | - | 부제목/설명 |
| `backgroundImage` | `string` | O | - | 배경 이미지 경로 |
| `ctaButtons` | `ReactNode` | X | - | CTA 버튼 영역 |
| `imageAlt` | `string` | X | `"Hero Background"` | 이미지 alt 텍스트 |
| `minHeight` | `string` | X | `"min-h-[55vh]"` | 최소 높이 (Tailwind 클래스) |
| `overlayOpacity` | `number` | X | `60` | 오버레이 불투명도 (0-100) |
| `overlayGradient` | `string` | X | - | 커스텀 그래디언트 클래스 |
| `textAlign` | `'left' \| 'center'` | X | `'center'` | 텍스트 정렬 |
| `className` | `string` | X | `""` | 추가 클래스 |

## 기본 사용법

```jsx
import ImageHero from '../components/common/ImageHero';

<ImageHero
  title="페이지 제목"
  subtitle="페이지에 대한 간단한 설명입니다."
  backgroundImage="/images/studio1.jpg"
  imageAlt="배경 이미지 설명"
/>
```

## 고급 사용법

### CTA 버튼 포함

```jsx
import Link from 'next/link';

<ImageHero
  title="당신의 음악에 생명을 불어넣는 공간"
  subtitle="최고급 장비와 전문 엔지니어가 함께합니다."
  backgroundImage="/images/studio2.jpg"
  minHeight="min-h-[90vh]"
  ctaButtons={
    <>
      <Link
        href="/contact"
        className="inline-flex items-center justify-center bg-white text-primary-dark py-3 px-8 rounded-full hover:bg-white/90 transition duration-300 shadow-lg"
      >
        예약하기
      </Link>
      <Link
        href="/portfolio"
        className="inline-flex items-center justify-center bg-transparent border-2 border-white text-white py-3 px-8 rounded-full hover:bg-white/10 transition duration-300"
      >
        포트폴리오 보기
      </Link>
    </>
  }
/>
```

### 커스텀 오버레이

```jsx
<ImageHero
  title="커스텀 오버레이"
  backgroundImage="/images/studio3.jpg"
  overlayGradient="bg-gradient-to-br from-primary-dark/70 via-black/50 to-secondary/60"
/>
```

### JSX 제목/부제목

```jsx
<ImageHero
  title={
    <>
      <span className="whitespace-nowrap">당신의 음악에</span>{' '}
      <span className="text-accent-light">생명</span>을 불어넣는 공간
    </>
  }
  subtitle={
    <>
      기획부터 유통, 홍보까지 함께하는{" "}
      <span className="whitespace-nowrap">올인원 프로덕션</span>
    </>
  }
  backgroundImage="/images/studio2.jpg"
/>
```

## 페이지별 적용 현황

| 페이지 | 배경 이미지 | 높이 |
|--------|------------|------|
| Home | `/images/studio2.jpg` | 90vh |
| About | `/images/studio3.jpg` | 55vh |
| Pricing | `/images/service1.jpg` | 55vh |
| Contact | `/images/studio5.jpg` | 50vh |
| Portfolio | `/images/recording1.png` | 55vh |
| Stories | `/images/studio1.jpg` | 50vh |
| Practice Room | `/images/room6.jpg` | 55vh |
| Studio Info | `/images/hardware1.jpg` | 55vh |

## 스타일링

### 폰트
- **제목**: `font-logo` (PartialSansKR-Regular)
- **부제목**: `font-pretendard`

### 반응형 타이포그래피
- 모바일: `text-heading-1` (2.5rem)
- 태블릿: `text-display-2` (3rem)
- 데스크톱: `text-display-1` (3.5rem)

### 오버레이
기본 오버레이는 검정 그래디언트로 설정되어 있습니다:
```
bg-gradient-to-b from-black/{opacity} via-black/{opacity-20} to-black/{opacity}
```

## 애니메이션

Framer Motion을 사용한 애니메이션이 적용되어 있습니다:
- 제목: 아래에서 위로 페이드 인 (0.6s)
- 부제목: 아래에서 위로 페이드 인 (0.6s, 0.2s 지연)
- CTA 버튼: 아래에서 위로 페이드 인 (0.6s, 0.4s 지연)

## 관련 파일

- `/components/ResponsiveImage.js` - 이미지 렌더링
- `/utils/animationUtils.js` - 애니메이션 상수
- `/styles/globals.css` - PartialSansKR 폰트 import
- `/tailwind.config.js` - font-logo 클래스 정의
