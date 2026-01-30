import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import ResponsiveImage from '../ResponsiveImage';

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
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]); // Parallax effect

  // 기본 오버레이 그래디언트 업그레이드 (Cinematic Atmosphere)
  // 하단에서 올라오는 짙은 그림자와 상단의 은은한 비네팅
  const cinematicOverlay = "bg-gradient-to-b from-black/30 via-transparent to-[#0f172a] via-80%";

  const alignmentClass = textAlign === 'center'
    ? 'text-center'
    : 'text-left';

  return (
    <section
      className={`relative overflow-hidden ${minHeight} flex flex-col justify-center -mt-20 pt-32 pb-12 ${className}`}
    >
      {/* 배경 이미지 (Ken Burns Effect + Parallax) */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y }}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 10, ease: "easeOut" }}
      >
        <ResponsiveImage
          src={backgroundImage}
          alt={imageAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </motion.div>

      {/* 오버레이 */}
      <div
        className={`absolute inset-0 z-10 ${overlayGradient || cinematicOverlay}`}
      />
      {/* 노이즈 텍스처 오버레이 (Premium Feel) */}
      <div className="absolute inset-0 z-10 opacity-[0.03] bg-[url('/images/noise.png')] pointer-events-none mix-blend-overlay" />

      {/* 콘텐츠 */}
      <div className={`container mx-auto px-4 z-20 relative ${alignmentClass}`}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1
            className={`font-logo text-heading-1 md:text-6xl lg:text-7xl text-white mb-8 break-keep leading-tight tracking-tight ${textAlign === 'center' ? 'max-w-5xl mx-auto' : 'max-w-3xl'}`}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              className={`font-pretendard text-lg md:text-2xl text-gray-200 mb-10 max-w-2xl leading-relaxed opacity-90 ${textAlign === 'center' ? 'mx-auto' : ''}`}
            >
              {subtitle}
            </p>
          )}

          {ctaButtons && (
            <div
              className={`flex flex-wrap gap-4 ${textAlign === 'center' ? 'justify-center' : ''}`}
            >
              {ctaButtons}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ImageHero;
