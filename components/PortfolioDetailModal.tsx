import React, { useEffect, useCallback, useRef } from 'react';
import { m, Variants, useReducedMotion } from 'framer-motion';
import { X, Share2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ResponsiveImage from './ResponsiveImage';
import type { PortfolioItem, PortfolioCategory } from '../types/data';
import { shareContent } from '../utils/shareUtils';
import { getCategoryInfo } from '../utils/portfolioDataUtils';
import { defaultLocale, type Locale } from '../lib/i18n';
import { getSiteConfig } from '../data/siteConfig';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';
import { useDisableMotionEffects } from '../utils/deviceUtils';

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

interface PortfolioDetailModalProps {
  item: PortfolioItem | null;
  categories: readonly PortfolioCategory[];
  onClose: () => void;
  locale?: Locale;
}

const PortfolioDetailModal = ({ item, categories, onClose, locale = defaultLocale }: PortfolioDetailModalProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const shouldReduceMotion = useReducedMotion();
  const disableMotionEffects = useDisableMotionEffects();
  const shouldAnimate = !disableMotionEffects && !shouldReduceMotion;
  const siteConfig = getSiteConfig(locale);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!item) return;

    triggerRef.current = document.activeElement as HTMLElement;

    document.addEventListener('keydown', handleEsc);
    lockBodyScroll();

    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      (closeButtonRef.current || focusableElements[0]).focus();
    }

    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes || nodes.length === 0) return;

      const firstElement = nodes[0];
      const lastElement = nodes[nodes.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleFocusTrap);

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.removeEventListener('keydown', handleFocusTrap);
      unlockBodyScroll();
      if (triggerRef.current && triggerRef.current.focus) {
        triggerRef.current.focus();
      }
    };
  }, [handleEsc, item]);

  if (!item) return null;

  const categoryInfo = getCategoryInfo(item.category, categories);

  const shareUrl = `${siteConfig.url}/${locale}/portfolio/${item.id}`;
  const metaDescription = t('portfolio.detail.metaDescription', {
    artist: item.artist,
    title: item.title,
    description: item.description,
  });

  const sharePortfolio = async () => {
    try {
      await shareContent({
        title: `${item.title} - ${t('portfolio.detail.titleSuffix')}`,
        text: metaDescription,
        url: shareUrl,
        messages: {
          copied: t('actions.shareCopied'),
          unsupported: t('actions.shareUnsupported'),
        },
      });
    } catch (error) {
      console.error('Portfolio share failed:', error);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <m.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      variants={shouldAnimate ? overlayVariants : undefined}
      initial={shouldAnimate ? "hidden" : false}
      animate={shouldAnimate ? "visible" : undefined}
      exit={shouldAnimate ? "hidden" : undefined}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <m.div
        className={`absolute inset-0 bg-black/60 ${shouldAnimate ? 'backdrop-blur-sm' : ''}`}
        variants={shouldAnimate ? overlayVariants : undefined}
        onClick={onClose}
        aria-hidden="true"
      />

      <m.div
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        variants={shouldAnimate ? modalVariants : undefined}
        initial={shouldAnimate ? "hidden" : false}
        animate={shouldAnimate ? "visible" : undefined}
        exit={shouldAnimate ? "exit" : undefined}
      >
        <div className={`sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-gray-800/95 border-b border-gray-100 dark:border-gray-700 ${shouldAnimate ? 'backdrop-blur-sm' : ''}`}>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            aria-label={t('actions.close')}
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" aria-hidden="true" />
          </button>
          <button
            onClick={sharePortfolio}
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <Share2 size={16} aria-hidden="true" />
            {t('portfolio.detail.share')}
          </button>
        </div>

        <div className="px-6 pt-6">
          <div className="relative aspect-square max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg">
            <ResponsiveImage
              src={item.image}
              alt={item.title}
              className="object-cover"
              pictureClassName="block w-full h-full"
              sizes="320px"
              fill={true}
              width={320}
              height={320}
            />
          </div>
        </div>

        <div className="p-6">
          <div className="mb-3">
            <span
              className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
              style={{ backgroundColor: categoryInfo.color }}
            >
              {categoryInfo.name}
            </span>
          </div>

          <h2
            id="modal-title"
            className="typo-card-title text-gray-900 dark:text-white mb-2"
          >
            {item.title}
          </h2>

          <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-4">
            {t('portfolio.detail.artistLabel')}: {item.artist}
          </p>

          <div className="mb-6">
            <h3 className="typo-card-meta font-medium text-gray-400 dark:text-gray-500 mb-2">
              {t('portfolio.detail.servicesProvided')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.services.map((service) => (
                <span
                  key={service}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                >
                  {service}
                </span>
              ))}
            </div>
          </div>

          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium"
          >
            <ExternalLink size={16} aria-hidden="true" />
            {t('portfolio.detail.listenNow')}
          </a>
        </div>
      </m.div>
    </m.div>
  );
};

export default PortfolioDetailModal;
