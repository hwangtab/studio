import React, { useEffect, useRef } from 'react';
import { m, Variants } from 'framer-motion';
import { X, Share2 } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import type { PortfolioItem, PortfolioCategory } from '../types/data';
import { shareContent } from '../utils/shareUtils';
import { defaultLocale, type Locale } from '../lib/i18n';
import { getSiteConfig } from '../data/siteConfig';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';
import { useFocusTrapDialog } from '../utils/useFocusTrapDialog';
import PortfolioDetailContent from './portfolio/PortfolioDetailContent';

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.2, ease: 'easeIn' },
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
  const siteConfig = getSiteConfig(locale);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useFocusTrapDialog({
    isOpen: Boolean(item),
    containerRef: modalRef,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    if (!item) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [item]);

  if (!item) return null;

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
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <m.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        variants={overlayVariants}
        onClick={onClose}
        aria-hidden="true"
      />

      <m.div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-50/95 dark:bg-gray-900/95 border-b border-gray-100 dark:border-gray-700 backdrop-blur-sm">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            type="button"
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
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

        <div id="modal-title" className="sr-only">
          {item.title}
        </div>

        <div className="px-4 sm:px-6 pb-8 pt-2">
          <PortfolioDetailContent
            item={item}
            categories={categories}
            locale={locale}
            titleTag="h2"
          />
        </div>
      </m.div>
    </m.div>
  );
};

export default PortfolioDetailModal;
