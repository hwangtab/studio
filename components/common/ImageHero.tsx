import React from 'react';
import { m } from 'framer-motion';
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
  const textMotionProps = { initial: { opacity: 1, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: 0.2 } };

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
        <m.div
          {...textMotionProps}
        >
          {/* font-logo = PartialSansKR (지연 주입) → Pretendard (fallback).
              브랜드 정체성 유지 위해 원본 font-normal 복원. */}
          <m.h1
            className={`font-logo text-heading-1 font-normal md:text-6xl lg:text-7xl text-white mb-8 ${textBreakClass} leading-tight tracking-tight ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
          >
            {title}
          </m.h1>

          {subtitle && (
            <m.p
              className={`font-pretendard text-lg md:text-2xl text-gray-200 mb-10 max-w-2xl leading-relaxed opacity-90 ${textAlign === 'center' ? 'mx-auto' : ''}`}
            >
              {subtitle}
            </m.p>
          )}

          {ctaButtons && (
            <div
              className={`flex flex-wrap gap-4 ${textAlign === 'center' ? 'justify-center' : ''}`}
            >
              {ctaButtons}
            </div>
          )}
        </m.div>
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
