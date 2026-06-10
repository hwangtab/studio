import React from 'react';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface MediaImage {
  src: string;
  alt: string;
}

interface MediaGalleryProps {
  images: readonly MediaImage[];
  className?: string;
  locale?: Locale;
}

const MediaGallery = ({ images, className = '', locale = defaultLocale }: MediaGalleryProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = React.useState(false);
  const [showRightArrow, setShowRightArrow] = React.useState(true);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const checkScroll = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);

      // Update active dot based on scroll position
      const index = Math.round(scrollLeft / (clientWidth * 0.85)); // 0.85 is based on w-[85%]
      setActiveIndex(prev => (prev !== index ? index : prev));
    }
  }, []);

  React.useEffect(() => {
    const current = scrollRef.current;
    let rafId: number;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(checkScroll);
    };

    if (current) {
      current.addEventListener('scroll', handleScroll, { passive: true });
      // Initial check
      checkScroll();
      window.addEventListener('resize', handleScroll);
    }
    return () => {
      if (current) current.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [checkScroll]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth : clientWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollToImage = (index: number) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      // Approximate scroll position based on width
      const scrollAmount = index * clientWidth * 0.85;
      scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative group mb-12 ${className}`}>
      {/* Navigation Arrows */}
      {showLeftArrow && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-white/85 dark:bg-gray-800/85 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={t('gallery.previous')}
        >
          <ChevronLeft className="w-6 h-6 text-primary-dark dark:text-primary-light" />
        </button>
      )}
      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-white/85 dark:bg-gray-800/85 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={t('gallery.next')}
        >
          <ChevronRight className="w-6 h-6 text-primary-dark dark:text-primary-light" />
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-4 pb-8"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {images.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            className="flex-none w-[85%] sm:w-[45%] lg:w-[31%] snap-center"
          >
            <m.div
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <ResponsiveImage
                src={image.src}
                alt={image.alt}
                className="w-full h-64 object-cover rounded-xl shadow-md"
                pictureClassName="block aspect-video"
                loading="lazy"
                width={600}
                height={400}
                // 카드 실제 렌더 폭:
                //   lg:w-[31%] + container(max-w-screen-xl=1280, px-4) ≈ 377px
                //   sm:w-[45%] + container ≈ 320px (md~lg)
                //   w-[85%] (모바일) ≈ viewport * 0.85
                // 기존 30vw/45vw는 vw 기반이라 container 폭보다 과대 계산되어
                // 768w 변종이 선택되던 문제(Lighthouse: 384×256 표시에 624×512 이미지)를 수정.
                sizes="(min-width: 1280px) 384px, (min-width: 768px) 320px, 85vw"
              />
            </m.div>
          </div>
        ))}
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {images.length > 1 && (
          <div className="flex gap-2">
            {images.map((image, i) => (
              <button
                key={`dot-${image.src}-${i}`}
                type="button"
                onClick={() => scrollToImage(i)}
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${i === activeIndex
                    ? 'text-primary'
                    : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500'
                  }`}
                aria-label={t('gallery.goToImage', { number: i + 1 })}
              >
                <span
                  className={`rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 h-2 bg-current' : 'w-2 h-2 bg-current'
                    }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaGallery;
