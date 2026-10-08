import React from 'react';
import ResponsiveImage from '../ResponsiveImage';
import Breadcrumb from '../ui/Breadcrumb';
import type { Locale } from '../../lib/i18n';
import type { Breadcrumb as BreadcrumbItem } from '../../types/data';
import { hasNavigatedSinceLoad } from '../../lib/navigationState';

/**
 * 히어로 사진 위 스크림 — `overlay`·`sleeve` 레이아웃에서만 쓴다.
 *
 * 예전에는 열 개 페이지가 `from-black/40 via-transparent to-black/20`을 각자
 * 복사해 쓰고 있었다. **가운데가 투명인데 히어로 텍스트가 정확히 그 자리에 앉는다** —
 * 제목과 부제가 스크림 0인 구간 위에 얹혀 있었다.
 *
 * 2026-09-14 프로덕션 실측(렌더된 배경 픽셀 기준, 흰 글씨 대비 / AA 미달 픽셀 비율):
 *
 *   practice-room    1.71:1  92%      mixing-mastering  2.77:1  63%
 *   cover-video      3.54:1  45%      recording         3.60:1  45%
 *   lesson           4.03:1  34%      pricing           4.64:1  33%
 *   홈               4.88:1  24%      voice-acting      5.04:1  61%
 *   studio-info      6.00:1  19%      wedding-song      8.04:1  10%
 *
 * 두 단계로 나눈 이유: 한 값으로 밝은 사진을 살리면 이미 어두운 사진이 검게 죽는다.
 * 값은 합성 결과로 역산했다 — 검정 오버레이 알파 a는 배경 휘도를 (1-a)배로 낮추므로,
 * 목표 대비에서 필요한 a가 나온다. 목표는 평균 6:1(AA 4.5:1 위로 여유).
 *
 * 사진을 새로 넣을 때는 짐작하지 말고 재 볼 것. 밝은 사진이면 STRONG이다.
 */
export const HERO_SCRIM = "from-black/45 via-black/40 to-black/40";

/** 밝은 사진용. 위 측정에서 평균 4:1 아래로 떨어지던 페이지들이 쓴다. */
export const HERO_SCRIM_STRONG = "from-black/65 via-black/70 to-black/60";

/**
 * 히어로 합성(라이너 노트 §3-3, docs/design-liner-notes-plan-2026-10.md).
 *
 * - `overlay`: 전면 사진 + 균일 스크림 + 가운데 정렬 흰 제목. 2026-10-06 이전의 모든 페이지 모양.
 *   이행이 끝나면 지운다.
 * - `split`: 데스크톱은 왼쪽 잉크 면(primary-dark) + 오른쪽 사진, 모바일은 잉크 면 → 사진(4:5) 스택.
 *   글자가 사진 위에 앉지 않으므로 스크림·drop-shadow가 없고, 사진 면이 절반이라 바이트가 준다.
 * - `sleeve`: 전면 사진, 왼쪽 아래 제목(음반 슬리브). 스크림은 세로 한 방향 + 왼쪽 브랜드색 워시 두 겹.
 *   사진이 좋은 페이지만 쓴다 — 글자 대비는 사진마다 다시 잰다(위 표의 방법).
 * - `board`: 사진 없는 잉크 면. `boardContent`(큰 숫자·목록)가 있으면 h1은 작은 세리프 한 줄이 된다 — 가격판.
 *
 * h1 문장은 어느 레이아웃에서도 바뀌지 않는다(검색 타이틀과 묶여 있다). `minHeight`·`overlayGradient`는
 * overlay·sleeve에서만 의미가 있고 split·board는 자기 높이를 갖는다.
 */
export type HeroLayout = 'overlay' | 'split' | 'sleeve' | 'board';

interface ImageHeroProps {
  title: React.ReactNode;
  /**
   * 제목을 제목 서체 대신 본문 서체로 — DB에서 오는 제목에 서브셋 밖 글자가 있을 때(lib/fonts/displayCoverage.ts).
   * 글자 하나만 다른 서체로 섞이는 대신 제목 전체를 Pretendard로 그린다.
   */
  titleFallbackFont?: boolean;
  /** h1 위에 놓이는 요소(예: /author의 인물 아바타). h1 안에 넣으면 hero 텍스트가 오염되므로 별도 슬롯. */
  aboveTitle?: React.ReactNode;
  /** 제목 위 작은 라벨(split·sleeve·board). overlay에서는 그리지 않는다. */
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaButtons?: React.ReactNode;
  /** `board`는 사진을 쓰지 않으므로 생략할 수 있다. 나머지 레이아웃은 필수. */
  backgroundImage?: string;
  imageAlt?: string;
  minHeight?: string;
  overlayGradient?: string;
  textAlign?: 'center' | 'left';
  className?: string;
  locale?: Locale;
  priority?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
  layout?: HeroLayout;
  /** `board` 전용 — h1 아래 본문 블록(가격판의 큰 숫자 등). 있으면 h1이 작아진다. */
  boardContent?: React.ReactNode;
}

const ImageHero = ({
  title,
  titleFallbackFont = false,
  aboveTitle,
  eyebrow,
  subtitle,
  ctaButtons,
  backgroundImage,
  imageAlt = "Hero Background",
  minHeight = "min-h-[60vh]",
  overlayGradient,
  textAlign = "center",
  className = "",
  locale = 'ko',
  priority = false,
  breadcrumbItems,
  layout = 'overlay',
  boardContent,
}: ImageHeroProps) => {
  const heroFont = titleFallbackFont ? 'font-sans' : 'font-hero';
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';

  // 페이지 전환으로 mount된 히어로만 페이드인. 첫 로드(SSR)는 loaded=true로 시작해
  // SSR HTML·hydration 클래스가 일치(opacity-100) → LCP 페인트에 영향 없음.
  const [imageLoaded, setImageLoaded] = React.useState(() => !hasNavigatedSinceLoad());

  /**
   * LCP 요소. framer-motion 래퍼 없이 즉시 페인트. 2026-10-06까지 있던 5초 `hero-zoom`(scale 1.1→1)은
   * 걷었다 — 템플릿 인상에 한몫했고, 모바일·reduced-motion에선 이미 꺼져 있어 데스크톱만 움직이던 장식이었다.
   * sizes: overlay·sleeve는 전폭이라 desktop max를 1920으로(라이너 노트 §3-7, 새 사진은 1920 원본),
   * split은 절반 폭이라 50vw — 데스크톱 바이트가 지금보다 준다. 모바일 변형(640)은 셋 다 같다.
   */
  const renderImage = (sizes: string) =>
    backgroundImage ? (
      <ResponsiveImage
        src={backgroundImage}
        alt={imageAlt}
        fill={true}
        priority={priority}
        className={`object-cover transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setImageLoaded(true)}
        pictureClassName="absolute inset-0 block h-full w-full"
        width={1920}
        height={1080}
        sizes={sizes}
        // next.config.mjs images.qualities = [60, 75] — 목록 밖 값은 최적화기가 400을 돌려준다. 2주차 새 사진(1920 원본)이
        // 들어올 때 선명도를 다시 본다(라이너 노트 §3-7).
        quality={60}
      />
    ) : null;

  const renderBreadcrumb = (toneClassName: string) =>
    breadcrumbItems && breadcrumbItems.length > 1 ? (
      <Breadcrumb
        items={breadcrumbItems}
        className={`${toneClassName} [&_span]:text-white [&_a]:text-white/70 [&_a:hover]:text-white [&_svg]:text-white/50`}
      />
    ) : null;

  const eyebrowNode = eyebrow ? (
    <p className="typo-eyebrow !text-primary-lighter mb-4">{eyebrow}</p>
  ) : null;

  // ── split ──────────────────────────────────────────────────────────────────
  if (layout === 'split') {
    return (
      <section
        className={`relative overflow-hidden bg-primary-dark text-white lg:grid lg:grid-cols-[1.05fr_1fr] lg:min-h-[80svh] ${className}`}
      >
        <div
          // 데스크톱 왼쪽 여백은 컨테이너(max-w-7xl=80rem)의 왼쪽 선과 맞춘다 — 아래 절들의 제목과 한 선에 선다.
          className={`relative z-20 flex flex-col justify-end pt-28 pb-10 px-4 sm:px-6 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:pr-12 lg:pb-14 text-left ${textBreakClass}`}
        >
          {aboveTitle && <div className="mb-6">{aboveTitle}</div>}
          {eyebrowNode}
          <h1 className={`${heroFont} text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.12] tracking-normal text-white max-w-2xl`} style={{ letterSpacing: '0' }}>
            {title}
          </h1>
          {subtitle && (
            <div className="mt-5 text-lg md:text-xl text-white/85 leading-relaxed max-w-xl whitespace-pre-line [text-wrap:balance]">
              {subtitle}
            </div>
          )}
          {ctaButtons && <div className="mt-8 flex flex-wrap items-center gap-3">{ctaButtons}</div>}
          {renderBreadcrumb('mt-8')}
        </div>
        <div className="relative aspect-[4/5] max-h-[60svh] w-full lg:aspect-auto lg:max-h-none lg:min-h-full bg-gray-900">
          {renderImage('(max-width: 1024px) 100vw, 50vw')}
          {/* 헤더가 사진 위에 뜨는 데스크톱 상단·모바일에서 잉크 면과 이어지는 윗단 — 한 방향 워시 하나씩. */}
          <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-b from-primary-dark/70 to-transparent to-40% lg:from-gray-950/35 lg:to-30%" />
          <div aria-hidden="true" className="absolute inset-0 z-10 hidden lg:block bg-gradient-to-r from-primary-dark/60 to-transparent to-35%" />
        </div>
      </section>
    );
  }

  // ── board ──────────────────────────────────────────────────────────────────
  if (layout === 'board') {
    const compactTitle = Boolean(boardContent);
    return (
      <section className={`relative overflow-hidden bg-primary-dark text-white ${className}`}>
        <div className={`container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 md:pt-32 md:pb-16 text-left ${textBreakClass}`}>
          {aboveTitle && <div className="mb-6">{aboveTitle}</div>}
          {eyebrowNode}
          <h1
            className={`${heroFont} font-bold tracking-normal max-w-4xl ${
              compactTitle ? 'text-xl md:text-2xl leading-snug text-white/85' : 'text-4xl md:text-5xl lg:text-6xl leading-[1.12] text-white'
            }`}
            style={{ letterSpacing: '0' }}
          >
            {title}
          </h1>
          {boardContent && <div className="mt-8">{boardContent}</div>}
          {subtitle && (
            <div className={`${compactTitle ? 'mt-8 text-base md:text-lg' : 'mt-5 text-lg md:text-xl'} text-white/80 leading-relaxed max-w-2xl whitespace-pre-line [text-wrap:balance]`}>
              {subtitle}
            </div>
          )}
          {ctaButtons && <div className="mt-8 flex flex-wrap items-center gap-3">{ctaButtons}</div>}
          {renderBreadcrumb('mt-8')}
        </div>
      </section>
    );
  }

  // ── sleeve ─────────────────────────────────────────────────────────────────
  if (layout === 'sleeve') {
    return (
      <section className={`relative overflow-hidden bg-gray-900 text-white ${minHeight} flex flex-col justify-end ${className}`}>
        <div className="absolute inset-0 z-0">{renderImage('(max-width: 640px) 100vw, (max-width: 1280px) 1280px, 1920px')}</div>
        {/* 두 겹: 세로(위 옅게·아래 짙게)로 글자 자리를 만들고, 왼쪽 브랜드색 워시로 잉크 면과 이어 준다. */}
        <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-b from-gray-950/15 via-transparent via-35% to-gray-950/80 to-85%" />
        <div aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-r from-primary-dark/55 to-transparent to-55%" />
        <div className={`container mx-auto px-4 sm:px-6 lg:px-8 relative z-20 pt-32 pb-10 md:pb-14 text-left ${textBreakClass}`}>
          {aboveTitle && <div className="mb-6">{aboveTitle}</div>}
          {eyebrowNode}
          <h1 className={`${heroFont} text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.12] tracking-normal text-white max-w-3xl`} style={{ letterSpacing: '0' }}>
            {title}
          </h1>
          {subtitle && (
            <div className="mt-5 text-lg md:text-xl text-white/85 leading-relaxed max-w-2xl whitespace-pre-line [text-wrap:balance]">
              {subtitle}
            </div>
          )}
          {ctaButtons && <div className="mt-8 flex flex-wrap items-center gap-3">{ctaButtons}</div>}
          {renderBreadcrumb('mt-8')}
        </div>
      </section>
    );
  }

  // ── overlay (2026-10-06 이전 모양, 이행 중인 페이지만) ─────────────────────
  const cinematicOverlay = `bg-gradient-to-b ${HERO_SCRIM}`;
  const alignmentClass = textAlign === 'center' ? 'text-center' : 'text-left';
  const verticalAlignClass = 'justify-center pt-32 pb-12';

  return (
    <section
      // bg-gray-900: 이미지 로드 전 흰 body가 비쳐 어두운 히어로 사이 전환에서
      // 밝기 급변(번쩍임)을 일으키던 것을 차단. 로드 후엔 fill 이미지가 완전히 덮음.
      className={`relative overflow-hidden bg-gray-900 ${minHeight} flex flex-col ${verticalAlignClass} ${className}`}
    >
      <div className="absolute inset-0 z-0">
        {renderImage('(max-width: 640px) 100vw, (max-width: 1280px) 1280px, 1920px')}
      </div>

      <div
        className={`absolute inset-0 z-10 ${overlayGradient ? `bg-gradient-to-b ${overlayGradient}` : cinematicOverlay}`}
      />

      <div className={`container mx-auto px-4 z-20 relative ${alignmentClass}`}>
        {/* framer-motion 래퍼 제거: 모바일 Lighthouse에서 LCP element(H1 내 span)의
            element render delay가 1.6s로 측정됨. `initial={{ y:30 }} → animate:{ y:0 }`
            애니메이션이 하이드레이션 완료까지 LCP 후보의 최종 위치 결정을 지연시킨 것이
            원인. SSR HTML이 즉시 최종 위치에 페인트되도록 순수 <div>로 교체. */}
        <div>
          {aboveTitle && (
            <div className={`mb-6 ${textAlign === 'center' ? 'flex justify-center' : ''}`}>
              {aboveTitle}
            </div>
          )}
          {/* font-hero = 디스플레이 세리프 700 서브셋(lib/fonts.ts displayFont, 기본 Hahmlet).
              hero h1·섹션 제목 글자만 self-host + preload → critical path 진입, swap 거의 즉시.
              서브셋 밖 글자는 fallback chain(--font-pretendard → 로케일 폰트 → 시스템 한글)으로 자동 swap. */}
          <h1
            className={`${heroFont} text-5xl font-bold md:text-6xl lg:text-7xl text-white mb-8 drop-shadow-lg ${textBreakClass} leading-[1.15] tracking-normal ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
            style={{ letterSpacing: '0' }}
          >
            {title}
          </h1>

          {/* subtitle은 단순 텍스트뿐 아니라 JSX(div 포함)도 받기 때문에 <p> 대신 <div>를 사용.
              <p> 내부에 <div>가 들어가면 HTML 스펙 위반으로 브라우저가 자동 교정 →
              React 하이드레이션 HTML 불일치(#418) 유발 (stories/[id] 등에서 재현).
              drop-shadow-lg: 컴포넌트 기본값으로 이동(코드리뷰 후속) — 오버레이가
              from-black/20 via-black/10 to-transparent로 얕아서 호출부의 drop-shadow
              부착 여부에 따라 AA 대비가 갈리던 문제를 컴포넌트 레벨에서 항상 보장. */}
          {subtitle && (
            <div
              // [text-wrap:balance]: 부제가 컨테이너 폭에서 여러 줄로 감길 때 마지막 줄에
              // 한두 어절만 남는 고아 줄을 방지. 강제 개행(\n·block span) 세그먼트별로 적용된다.
              className={`text-xl md:text-3xl text-gray-200 mb-10 max-w-2xl leading-relaxed opacity-90 whitespace-pre-line [text-wrap:balance] drop-shadow-lg ${textBreakClass} ${textAlign === 'center' ? 'mx-auto' : ''}`}
            >
              {subtitle}
            </div>
          )}

          {ctaButtons && (
            <div
              className={`flex flex-wrap gap-4 ${textAlign === 'center' ? 'justify-center' : ''}`}
            >
              {ctaButtons}
            </div>
          )}
        </div>
      </div>

      {breadcrumbItems && breadcrumbItems.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/25 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <Breadcrumb
              items={breadcrumbItems}
              className="py-2 text-white/70 drop-shadow [&_span]:text-white [&_a]:text-white/70 [&_a:hover]:text-white [&_svg]:text-white/50"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default ImageHero;
