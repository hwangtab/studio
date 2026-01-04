import React from 'react';
import { motion } from 'framer-motion';
import ResponsiveImage from '../ResponsiveImage';
import { HERO_TITLE_ANIMATION, HERO_SUBTITLE_ANIMATION, HERO_CTA_ANIMATION } from '../../utils/animationUtils';

const ImageHero = ({
  title,
  subtitle,
  ctaButtons,
  backgroundImage,
  imageAlt = "Hero Background",
  minHeight = "min-h-[55vh]",
  overlayGradient,
  textAlign = "center",
  className = "",
}) => {
  // 기본 오버레이 그래디언트 (Tailwind JIT 호환을 위해 고정 클래스 사용)
  const defaultGradient = "bg-gradient-to-b from-black/60 via-black/40 to-black/60";

  const alignmentClass = textAlign === 'center'
    ? 'text-center'
    : 'text-left';

  return (
    <section
      className={`relative overflow-hidden ${minHeight} flex items-center ${className}`}
    >
      {/* 배경 이미지 */}
      <div className="absolute inset-0 z-0">
        <ResponsiveImage
          src={backgroundImage}
          alt={imageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>

      {/* 오버레이 */}
      <div
        className={`absolute inset-0 z-10 ${overlayGradient || defaultGradient}`}
      />

      {/* 콘텐츠 */}
      <div className={`container mx-auto px-4 z-20 relative ${alignmentClass}`}>
        <motion.h1
          className={`font-logo text-heading-1 md:text-display-2 lg:text-display-1 text-white mb-6 break-keep ${textAlign === 'center' ? 'max-w-4xl mx-auto' : 'max-w-3xl'}`}
          {...HERO_TITLE_ANIMATION}
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            className={`font-pretendard text-body-1-light md:text-subtitle-1 text-white/90 mb-8 max-w-2xl leading-relaxed ${textAlign === 'center' ? 'mx-auto' : ''}`}
            {...HERO_SUBTITLE_ANIMATION}
          >
            {subtitle}
          </motion.p>
        )}

        {ctaButtons && (
          <motion.div
            className={`flex flex-wrap gap-4 ${textAlign === 'center' ? 'justify-center' : ''}`}
            {...HERO_CTA_ANIMATION}
          >
            {ctaButtons}
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default ImageHero;
