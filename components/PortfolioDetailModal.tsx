import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Share2, ExternalLink } from 'lucide-react';
import ResponsiveImage from './ResponsiveImage';
import type { PortfolioItem } from '../types/data';
import { shareContent } from '../utils/shareUtils';
import { getCategoryInfo } from '../utils/portfolioDataUtils';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
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
  onClose: () => void;
}

const PortfolioDetailModal = ({ item, onClose }: PortfolioDetailModalProps) => {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      // document.body.style.overflow = 'unset'; // Removed to restore in onAnimationComplete
    };
  }, [handleEsc]);

  if (!item) return null;

  const categoryInfo = getCategoryInfo(item.category);

  const shareUrl = `https://studionol.co.kr/portfolio/${item.id}`;
  const metaDescription = `${item.artist}의 "${item.title}" - ${item.description}. 스튜디오 놀에서 작업한 프로젝트입니다.`;

  const sharePortfolio = async () => {
    await shareContent({
      title: `${item.title} - 스튜디오 놀`,
      text: metaDescription,
      url: shareUrl,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={handleOverlayClick}
      onAnimationComplete={(definition) => {
        if (definition === 'hidden' || (typeof definition === 'object' && 'hidden' in (definition as any))) {
          document.body.style.overflow = 'unset';
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        variants={overlayVariants}
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="닫기"
          >
            <X size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <button
            onClick={sharePortfolio}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Share2 size={16} />
            공유
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
            아티스트: {item.artist}
          </p>

          <div className="mb-6">
            <h3 className="typo-card-meta font-medium text-gray-400 dark:text-gray-500 mb-2">
              제공 서비스
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
            <ExternalLink size={16} />
            음원 들으러 가기
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PortfolioDetailModal;
