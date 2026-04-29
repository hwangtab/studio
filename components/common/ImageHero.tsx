import React from 'react';
import ResponsiveImage from '../ResponsiveImage';
import Breadcrumb from '../ui/Breadcrumb';
import type { Locale } from '../../lib/i18n';
import type { Breadcrumb as BreadcrumbItem } from '../../types/data';

interface ImageHeroProps {
  title: React.ReactNode;
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
  const cinematicOverlay = "bg-gradient-to-b from-black/20 via-black/10 to-transparent";

  const alignmentClass = textAlign === 'center'
    ? 'text-center'
    : 'text-left';
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';

  const verticalAlignClass = 'justify-center pt-32 pb-12';

  return (
    <section
      className={`relative overflow-hidden ${minHeight} flex flex-col ${verticalAlignClass} ${className}`}
    >
      {/* LCP 요소: framer-motion 래퍼 없이 즉시 페인트. 줌 애니메이션은 CSS로 처리(hero-zoom). */}
      <div className="absolute inset-0 z-0 hero-zoom">
        <ResponsiveImage
          src={backgroundImage}
          alt={imageAlt}
          fill={true}
          priority={priority}
          className="object-cover"
          pictureClassName="absolute inset-0 block h-full w-full"
          width={1920}
          height={1080}
          sizes="100vw"
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
          {/* font-logo = Gasoek One (next/font/google 자동 self-hosted + preload + size-adjust).
              → Pretendard (fallback). 브랜드 정체성 유지 위해 원본 font-normal 복원. */}
          <h1
            className={`font-logo text-heading-1 font-normal md:text-6xl lg:text-7xl text-white mb-8 ${textBreakClass} leading-tight tracking-tight ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
          >
            {title}
          </h1>

          {/* subtitle은 단순 텍스트뿐 아니라 JSX(div 포함)도 받기 때문에 <p> 대신 <div>를 사용.
              <p> 내부에 <div>가 들어가면 HTML 스펙 위반으로 브라우저가 자동 교정 →
              React 하이드레이션 HTML 불일치(#418) 유발 (stories/[id] 등에서 재현). */}
          {subtitle && (
            <div
              className={`font-pretendard text-lg md:text-2xl text-gray-200 mb-10 max-w-2xl leading-relaxed opacity-90 ${textBreakClass} ${textAlign === 'center' ? 'mx-auto' : ''}`}
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
              className="py-2 text-white/70 [&_span]:text-white [&_a]:text-white/70 [&_a:hover]:text-white [&_svg]:text-white/50"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default ImageHero;
