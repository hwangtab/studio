import React from 'react';
import ResponsiveImage from '../ResponsiveImage';
import Breadcrumb from '../ui/Breadcrumb';
import type { Locale } from '../../lib/i18n';
import type { Breadcrumb as BreadcrumbItem } from '../../types/data';
import { hasNavigatedSinceLoad } from '../../lib/navigationState';

/**
 * 히어로 사진 위 스크림.
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

interface ImageHeroProps {
  title: React.ReactNode;
  /** h1 위에 놓이는 요소(예: /author의 인물 아바타). h1 안에 넣으면 hero 텍스트가 오염되므로 별도 슬롯. */
  aboveTitle?: React.ReactNode;
  subtitle?: React.ReactNode;
  ctaButtons?: React.ReactNode;
  backgroundImage: string;
  imageAlt?: string;
  minHeight?: string;
  overlayGradient?: string;
  textAlign?: 'center' | 'left';
  className?: string;
  locale?: Locale;
  priority?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
}

const ImageHero = ({
  title,
  aboveTitle,
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
}: ImageHeroProps) => {
  const cinematicOverlay = `bg-gradient-to-b ${HERO_SCRIM}`;

  const alignmentClass = textAlign === 'center'
    ? 'text-center'
    : 'text-left';
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';

  const verticalAlignClass = 'justify-center pt-32 pb-12';

  // 페이지 전환으로 mount된 히어로만 페이드인. 첫 로드(SSR)는 loaded=true로 시작해
  // SSR HTML·hydration 클래스가 일치(opacity-100) → LCP 페인트에 영향 없음.
  const [imageLoaded, setImageLoaded] = React.useState(() => !hasNavigatedSinceLoad());

  return (
    <section
      // bg-gray-900: 이미지 로드 전 흰 body가 비쳐 어두운 히어로 사이 전환에서
      // 밝기 급변(번쩍임)을 일으키던 것을 차단. 로드 후엔 fill 이미지가 완전히 덮음.
      className={`relative overflow-hidden bg-gray-900 ${minHeight} flex flex-col ${verticalAlignClass} ${className}`}
    >
      {/* LCP 요소: framer-motion 래퍼 없이 즉시 페인트. 줌 애니메이션은 CSS로 처리(hero-zoom). */}
      <div className="absolute inset-0 z-0 hero-zoom">
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
          // 명시 breakpoints로 next/image의 srcset 후보 중 desktop max를 1280px로
          // 클램프. sizes="100vw" 단독이면 PSI Lighthouse Moto G4(412×732 1.5×DPR)는
          // 640 변형을 잘 잡지만, 일부 고밀도 모바일·태블릿에서 1920 변형까지 가져오는
          // 경우가 있어 보수적으로 명시.
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 1280px, 1920px"
          // hero 배경 이미지는 어두운 그라디언트 오버레이(black/20→black/10) 위에
          // 깔리고 hero-zoom 애니메이션 중에 보이므로 quality 60까지 낮춰도 화질
          // 저하가 인지되지 않음. 70→60으로 모바일 LCP 변형 ~8KB 추가 감축
          // (PSI '이미지 전송 개선' 항목 대응).
          quality={60}
        />
      </div>

      <div
        className={`absolute inset-0 z-10 ${overlayGradient ? `bg-gradient-to-b ${overlayGradient}` : cinematicOverlay}`}
      />

      <div className={`container mx-auto px-4 z-20 relative ${alignmentClass}`}>
        {/* framer-motion 래퍼 제거: 모바일 Lighthouse에서 LCP element(H1 내 span)의
            element render delay가 1.6s로 측정됨. `initial={{ y:30 }} → animate:{ y:0 }`
            애니메이션이 하이드레이션 완료까지 LCP 후보의 최종 위치 결정을 지연시킨 것이
            원인. SSR HTML이 즉시 최종 위치에 페인트되도록 순수 <div>로 교체.
            줌 애니메이션(hero-zoom)은 CSS keyframes라 영향 없음. */}
        <div>
          {aboveTitle && (
            <div className={`mb-6 ${textAlign === 'center' ? 'flex justify-center' : ''}`}>
              {aboveTitle}
            </div>
          )}
          {/* font-hero = Pretendard Bold 700 micro-subset (lib/fonts.ts pretendardHero).
              사이트 hero 텍스트 글자만 self-host + preload → critical path 진입,
              swap 거의 즉시. 글리프 미포함 글자는 fallback chain(--font-pretendard →
              시스템 한글)으로 자동 swap. */}
          <h1
            className={`font-hero text-5xl font-bold md:text-7xl lg:text-8xl text-white mb-8 drop-shadow-lg ${textBreakClass} leading-tight tracking-normal ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
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
