import React from 'react';
import { m, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import ResponsiveImage from '../ResponsiveImage';
import type { Locale } from '../../lib/i18n';

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
}: ImageHeroProps) => {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const yBg = useTransform(scrollY, [0, 500], [0, shouldReduceMotion ? 0 : 200]);
  const yTitle = useTransform(scrollY, [0, 500], [0, shouldReduceMotion ? 0 : -50]);
  const ySubtitle = useTransform(scrollY, [0, 500], [0, shouldReduceMotion ? 0 : -30]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

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
      <m.div
        className="absolute inset-0 z-0 will-change-transform"
        style={{ y: yBg }}
      >
        <m.div
          className="w-full h-full will-change-transform"
          initial={shouldReduceMotion ? false : { scale: 1.1 }}
          animate={shouldReduceMotion ? false : { scale: 1 }}
          transition={{ duration: 10, ease: "easeOut" }}
        >
          <ResponsiveImage
            src={backgroundImage}
            alt={imageAlt}
            fill={true}
            priority={true}
            className="object-cover"
            pictureClassName="absolute inset-0 block h-full w-full"
            width={1920}
            height={1080}
            sizes="100vw"
          />
        </m.div>
      </m.div>

      <div
        className={`absolute inset-0 z-10 ${overlayGradient ? `bg-gradient-to-b ${overlayGradient}` : cinematicOverlay}`}
      />

      <div className={`container mx-auto px-4 z-20 relative ${alignmentClass}`}>
        <m.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <m.h1
            style={{ y: yTitle, opacity }}
            className={`font-logo text-heading-1 font-normal md:text-6xl lg:text-7xl text-white mb-8 ${textBreakClass} leading-tight tracking-tight ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
          >
            {title}
          </m.h1>

          {subtitle && (
            <m.p
              style={{ y: ySubtitle, opacity }}
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
    </section>
  );
};

export default ImageHero;
