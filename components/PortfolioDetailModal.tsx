import React, { useEffect, useRef } from 'react';
import { m, Variants } from 'framer-motion';
import { X, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PortfolioItem, PortfolioCategory } from '../types/data';
import { shareContent } from '../utils/shareUtils';
import { getCategoryInfo } from '../utils/portfolioDataUtils';
import { defaultLocale, type Locale } from '../lib/i18n';
import { getSiteConfig } from '../data/siteConfig';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';
import { useFocusTrapDialog } from '../utils/useFocusTrapDialog';
import PortfolioDetailSummary from './portfolio/PortfolioDetailSummary';

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
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <m.div
        className="absolute inset-0 bg-canvas-deep/80 backdrop-blur-sm"
        variants={overlayVariants}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <m.div
        ref={modalRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain bg-canvas-soft dark:bg-surface-dark-elevated rounded-hero shadow-deep border border-hairline dark:border-white/10"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-canvas-soft/95 dark:bg-surface-dark-elevated/95 border-b border-hairline dark:border-white/10 backdrop-blur-sm">
          <button
            ref={closeButtonRef}
            onClick={onClose}
            type="button"
            className="bg-ink/[0.04] hover:bg-ink/[0.08] rounded-pill p-2 text-ink dark:bg-white/[0.06] dark:text-on-dark transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
            aria-label={t('actions.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <button
            onClick={sharePortfolio}
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink dark:text-on-dark hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] rounded-pill transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2"
          >
            <Share2 size={16} aria-hidden="true" />
            {t('portfolio.detail.share')}
          </button>
        </div>

        <div id="modal-title" className="sr-only">
          {item.title}
        </div>

        <div className="p-6 md:p-8">
          <PortfolioDetailSummary
            item={item}
            categoryName={categoryInfo.name}
            categoryColor={categoryInfo.color}
            artistLabel={t('portfolio.detail.artistLabel')}
            servicesTitle={t('portfolio.detail.servicesProvided')}
            listenNowLabel={t('portfolio.detail.listenNow')}
            listenUrl={item.link}
            imageSectionClassName="mb-6"
            imageWrapperClassName="relative aspect-square max-w-xs mx-auto rounded-card overflow-hidden shadow-card border border-hairline dark:border-white/10"
            contentSectionClassName=""
          />
        </div>
      </m.div>
    </m.div>
  );
};

export default PortfolioDetailModal;
