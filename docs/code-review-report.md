# 코드 리뷰 보고서: 코드 중복 및 버그 분석

> 분석 일자: 2026-02-04 (업데이트됨)
> 대상: Studio Nol 웹사이트 전체 코드베이스

---

## 1. 버그 및 잠재적 이슈 (총 7건)

### BUG-1: `useAudioPlayer` SSR 안전성 부재
- **심각도**: HIGH
- **파일**: `components/AudioPlayer/useAudioPlayer.ts` (38-39행)
- **문제**: `new Audio()`를 브라우저 환경 체크 없이 직접 호출하고 있음. 현재는 `useEffect` 내부에서만 실행되어 SSG 빌드에서는 문제가 없지만, `typeof window !== 'undefined'` 가드가 없어 향후 SSR 전환 시 서버에서 에러 발생 가능.
- **해당 코드**:
  ```typescript
  // useAudioPlayer.ts:38-39
  if (!audioRef.current && tracks && tracks.length > 0) {
      audioRef.current = new Audio(tracks[currentTrack].src);
  }
  ```
- **권장 수정**: `typeof window !== 'undefined'` 가드 추가

---

### BUG-2: `useAudioPlayer` 언마운트 후 상태 업데이트
- **심각도**: HIGH
- **파일**: `components/AudioPlayer/useAudioPlayer.ts` (86-88행)
- **문제**: `play()` Promise의 `.catch()` 핸들러에서 `setIsPlaying(false)`를 호출함. 컴포넌트가 언마운트된 후 Promise가 reject되면 "Can't perform a React state update on an unmounted component" 경고가 발생함.
- **해당 코드**:
  ```typescript
  // useAudioPlayer.ts:78-92
  if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
          playPromise
              .then(() => {
                  animationRef.current = requestAnimationFrame(whilePlaying);
              })
              .catch((error) => {
                  console.error('오디오 재생 오류:', error);
                  setIsPlaying(false);  // 언마운트 후 호출될 수 있음
              });
      }
  }
  ```
- **권장 수정**: `useRef`로 마운트 상태를 추적하여 언마운트 후 상태 업데이트를 방지

---

### BUG-3: `ResponsiveImage` non-null assertion
- **심각도**: MEDIUM
- **파일**: `components/ResponsiveImage.tsx` (90-91행)
- **문제**: `fill`이 아닌 모드에서 `width={width!}` / `height={height!}`로 non-null assertion을 사용함. `width`/`height`가 전달되지 않으면 Next.js Image 컴포넌트가 런타임 에러를 발생시킴.
- **해당 코드**:
  ```typescript
  // ResponsiveImage.tsx:84-94
  <Image
    src={error ? fallbackSrc : normalizedSrc}
    alt={alt}
    sizes={sizes}
    priority={priority}
    width={width!}    // undefined일 경우 에러
    height={height!}  // undefined일 경우 에러
    onError={() => setError(true)}
    {...rest}
  />
  ```
- **권장 수정**: `fill`이 아닐 때 `width`/`height`가 없으면 `fill` 모드로 자동 전환하거나 기본값 설정

---

### BUG-4: 불필요한 `@ts-ignore` 남용 (일부 해결됨)
- **심각도**: MEDIUM
- **상태**: **PARTIALLY RESOLVED**
  - `pages/portfolio.tsx`: 해결됨 (`AnimatePresence` 타입 이슈 해결로 제거)
  - `pages/stories/[id].tsx`, `pages/portfolio/[id].tsx`: 여전히 존재
- **파일**:
  - `pages/stories/[id].tsx` (7-16행)
  - `pages/portfolio/[id].tsx` (7-10행)
- **문제**: SEO, ResponsiveImage, MarkdownRenderer 등은 이미 `.tsx` 파일인데 `// @ts-ignore - component is JS`라는 잘못된 주석과 함께 타입 체크를 건너뛰고 있음. 실제 타입 에러가 있더라도 발견할 수 없게 됨.
- **해당 코드**:
  ```typescript
  // stories/[id].tsx:7-16
  // @ts-ignore - SEO component is JS
  import SEO from '../../components/SEO';
  // @ts-ignore - MarkdownRenderer component is JS
  import MarkdownRenderer from '../../components/MarkdownRenderer';
  // @ts-ignore - StoryCard component is JS
  import StoryCard from '../../components/StoryCard';
  // @ts-ignore - ImageHero component is JS
  import ImageHero from '../../components/common/ImageHero';
  // @ts-ignore - ResponsiveImage component is JS
  import ResponsiveImage from '../../components/ResponsiveImage';
  ```
- **권장 수정**: `@ts-ignore` 제거. 타입 에러가 발생하면 정확한 타입 선언으로 해결

---

### BUG-5: `Math.random()` 사용으로 인한 하이드레이션 불일치 가능성
- **심각도**: MEDIUM
- **파일**: `pages/stories/[id].tsx` (34행)
- **문제**: `getCTAType` 함수가 `Math.random()`을 사용하여 CTA 타입을 결정함. 현재는 `useEffect` 내부에서 호출되므로 서버에서는 기본값 `'recording'`이 사용되고, 클라이언트에서 랜덤값으로 변경됨. 이로 인해 첫 렌더링 후 CTA가 바뀌는 깜빡임 현상이 발생할 수 있음.
- **해당 코드**:
  ```typescript
  // stories/[id].tsx:33-74
  const getCTAType = (category: string | undefined): CTAType => {
      const random = Math.random();
      if (category?.includes('강좌')) {
          if (random < 0.4) return 'lesson';
          // ...
      }
      // ...
  };

  const [ctaType, setCtaType] = React.useState<CTAType>('recording');
  React.useEffect(() => {
      if (story?.category) {
          setCtaType(getCTAType(story.category));
      }
  }, [story?.category]);
  ```
- **권장 수정**: `slug` 기반 해시 함수로 결정적(deterministic)인 CTA 선택 방식으로 변경

---

### BUG-6: Layout 스크롤 핸들러의 `requestAnimationFrame` 미정리
- **심각도**: LOW
- **파일**: `components/Layout.tsx` (90-104행)
- **문제**: 컴포넌트 언마운트 시 `removeEventListener`는 수행하지만, 이미 큐에 들어간 `requestAnimationFrame` 콜백은 취소되지 않음. 언마운트 직후 `setIsScrolled`가 호출될 수 있음 (Layout은 앱 전체를 감싸므로 실제로 언마운트되는 경우는 거의 없음).
- **해당 코드**:
  ```typescript
  // Layout.tsx:90-104
  useEffect(() => {
      if (typeof window === 'undefined') return;
      let ticking = false;
      const handleScroll = () => {
          if (!ticking) {
              window.requestAnimationFrame(() => {
                  setIsScrolled(window.scrollY > 10);
                  ticking = false;
              });
              ticking = true;
          }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => window.removeEventListener('scroll', handleScroll);
      // requestAnimationFrame ID를 저장하여 cleanup에서 취소하지 않음
  }, []);
  ```
- **권장 수정**: RAF ID를 ref로 저장하고 cleanup에서 `cancelAnimationFrame` 호출

---

### BUG-7: `getStaticProps`에서 `as any` 캐스팅
- **심각도**: LOW
- **파일**: `pages/portfolio/[id].tsx` (176행)
- **문제**: `props: { item: item as any }` - Next.js의 serialization 검사와 TypeScript 타입 체크를 동시에 우회하고 있음.
- **해당 코드**:
  ```typescript
  // portfolio/[id].tsx:175-177
  return {
      props: { item: item as any },
  };
  ```
- **권장 수정**: `PortfolioItem` 타입이 JSON serializable한지 확인 후 `as any` 제거

---

### ETC-1: 테스트 파일 타입 에러 (해결됨)
- **상태**: **RESOLVED**
- **파일**: `utils/localDataUtils.test.ts`
- **내용**: 존재하지 않는 함수(`summarizeContent`)를 import하여 발생하던 `tsc` 에러를 수정함. `textUtils.ts`에서 올바른 함수(`summarizeText`, `stripMarkdown`)를 import하도록 변경.

---

## 2. 코드 중복 (총 5건)

### DUP-1: 공유 기능 3중 중복
- **우선순위**: HIGH
- **파일**:
  - `components/PortfolioDetailModal.tsx` (66-83행)
  - `pages/portfolio/[id].tsx` (41-58행)
  - `pages/stories/[id].tsx` (97-114행)
- **중복 패턴**: 3개 파일 모두 아래와 동일한 로직을 각각 구현:
  ```typescript
  const shareXxx = async () => {
      const shareData = {
          title: `${item.title} - 스튜디오 놀`,
          text: metaDescription,
          url: shareUrl,
      };
      try {
          if (navigator.share) {
              await navigator.share(shareData);
          } else if (navigator.clipboard) {
              await navigator.clipboard.writeText(`${item.title}\n${shareUrl}`);
              alert('링크가 클립보드에 복사되었습니다.');
          }
      } catch (error) {
          console.error('공유 오류:', error);
      }
  };
  ```
- **권장 수정**: `utils/shareUtils.ts`에 공통 함수 추출
  ```typescript
  export async function shareContent(data: {
      title: string;
      text: string;
      url: string;
  }): Promise<void> {
      try {
          if (navigator.share) {
              await navigator.share(data);
          } else if (navigator.clipboard) {
              await navigator.clipboard.writeText(`${data.title}\n${data.url}`);
              alert('링크가 클립보드에 복사되었습니다.');
          }
      } catch (error) {
          console.error('공유 오류:', error);
      }
  }
  ```

---

### DUP-2: 텍스트 요약 함수 2중 중복
- **우선순위**: HIGH
- **파일**:
  - `utils/localDataUtils.ts` (27-38행) - `summarizeContent()`
  - `utils/textUtils.ts` (1-10행) - `summarizeText()`
- **비교**:
  | 항목 | `summarizeContent` | `summarizeText` |
  |------|-------------------|-----------------|
  | 마크다운 제거 | 내부적으로 `stripMarkdown` 호출 | 없음 (순수 텍스트 대상) |
  | 기본 길이 | 150자 | 100자 |
  | 핵심 로직 | `lastIndexOf(' ', maxLength)` → `'...'` | 동일 |
- **권장 수정**: `summarizeText` 사용처를 확인한 후 하나로 통일. 마크다운이 포함된 경우와 순수 텍스트를 모두 처리할 수 있도록 옵션 파라미터를 추가하거나, 마크다운 제거를 호출자 책임으로 분리

---

### DUP-3: 로딩 스피너 2중 중복
- **우선순위**: LOW
- **파일**:
  - `pages/portfolio/[id].tsx` (25-31행)
  - `pages/stories/[id].tsx` (86-92행)
- **동일 패턴**:
  ```tsx
  if (router.isFallback) {
      return (
          <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
      );
  }
  ```
- **권장 수정**: `components/ui/LoadingSpinner.tsx` 컴포넌트 추출

---

### DUP-4: 카테고리 정보 조회 로직 2중 중복
- **우선순위**: LOW
- **파일**:
  - `components/PortfolioDetailModal.tsx` (58-61행)
  - `pages/portfolio/[id].tsx` (36-39행)
- **동일 패턴**:
  ```typescript
  const categoryInfo = categories.find((cat) => cat.id === item.category) || {
      name: item.category,
      color: '#6d28d9',
  };
  ```
- **권장 수정**: `utils/portfolioDataUtils.ts` 또는 `data/portfolio.ts`에 헬퍼 함수 추출
  ```typescript
  export function getCategoryInfo(categoryId: string) {
      return categories.find((cat) => cat.id === categoryId) || {
          name: categoryId,
          color: '#6d28d9',
      };
  }
  ```

---

### DUP-5: `AnimatePresence as any` 캐스팅 2중 중복 (해결됨)
- **우선순위**: LOW
- **상태**: **RESOLVED**
- **파일**:
  - `pages/portfolio.tsx`
  - `components/ui/FAQSection.tsx`
  - `pages/_app.tsx` (기존 해결됨)
  - `components/Layout.tsx` (기존 해결됨)
- **해결 내용**: `framer-motion`의 `AnimatePresence` 타입 호환성 문제를 해결하기 위해 `components/ui/AnimatePresence.tsx`라는 커스텀 래퍼 컴포넌트를 사용하도록 모든 사용처를 통일함. 불필요한 `as any` 캐스팅과 `@ts-ignore` 주석을 제거함.

---

## 3. 요약

| 구분 | HIGH | MEDIUM | LOW | 합계 |
|------|------|--------|-----|------|
| 버그 | 2건 | 3건 | 2건 | **7건** |
| 코드 중복 | 2건 | - | 2건 | **4건** |
| **합계** | **4건** | **3건** | **4건** | **11건** |

### 우선 수정 권장 항목
1. **DUP-1**: 공유 기능 유틸 함수 추출 (3개 파일 영향)
2. **BUG-2**: useAudioPlayer 언마운트 후 상태 업데이트 방지
3. **DUP-2**: 텍스트 요약 함수 통일
4. **BUG-3**: ResponsiveImage non-null assertion 안전 처리
