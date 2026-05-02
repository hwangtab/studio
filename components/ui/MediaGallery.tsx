import React from 'react';
import { m } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from '../ResponsiveImage';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface MediaImage {
  src: string;
  alt: string;
  caption?: string;
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

      const index = Math.round(scrollLeft / (clientWidth * 0.85));
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
          className="absolute left-2 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-canvas-soft/85 dark:bg-surface-dark-elevated/85 rounded-pill shadow-card hover:shadow-card-hover border border-hairline dark:border-white/10 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
          aria-label={t('gallery.previous')}
        >
          <ChevronLeft className="w-6 h-6 text-ink dark:text-on-dark" />
        </button>
      )}
      {showRightArrow && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-30 min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-canvas-soft/85 dark:bg-surface-dark-elevated/85 rounded-pill shadow-card hover:shadow-card-hover border border-hairline dark:border-white/10 transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
          aria-label={t('gallery.next')}
        >
          <ChevronRight className="w-6 h-6 text-ink dark:text-on-dark" />
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
              <div className="rounded-card border border-hairline overflow-hidden aspect-[4/3] dark:border-white/10">
                <ResponsiveImage
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  pictureClassName="block w-full h-full"
                  loading="lazy"
                  width={600}
                  height={400}
                  sizes="(min-width: 1280px) 384px, (min-width: 768px) 320px, 85vw"
                />
              </div>
              {image.caption && (
                <p className="text-caption text-ink-muted-60 dark:text-on-dark-soft mt-2 px-1">{image.caption}</p>
              )}
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
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-pill transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2 ${i === activeIndex
                    ? 'text-ink dark:text-on-dark'
                    : 'text-ink-muted-40 dark:text-on-dark-soft hover:text-ink-muted-60 dark:hover:text-on-dark'
                  }`}
                aria-label={t('gallery.goToImage', { number: i + 1 })}
              >
                <span
                  className={`rounded-pill transition-all duration-300 bg-current ${i === activeIndex ? 'w-6 h-2' : 'w-2 h-2'
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
