import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaShare, FaExternalLinkAlt } from 'react-icons/fa';
import ResponsiveImage from './ResponsiveImage';
import { categories } from '../data/portfolio';

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
    transition: { duration: 0.2 },
  },
};

const PortfolioDetailModal = ({ item, onClose }) => {
  // ESC 키로 닫기
  const handleEsc = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  // 스크롤 잠금 및 ESC 키 핸들링
  useEffect(() => {
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [handleEsc]);

  if (!item) return null;

  // 카테고리 정보 가져오기
  const categoryInfo = categories.find((cat) => cat.id === item.category) || {
    name: item.category,
    color: '#6d28d9',
  };

  const shareUrl = `https://studionol.co.kr/portfolio/${item.id}`;
  const metaDescription = `${item.artist}의 "${item.title}" - ${item.description}. 스튜디오 놀에서 작업한 프로젝트입니다.`;

  const sharePortfolio = async () => {
    const shareData = {
      title: `${item.title} - 스튜디오 놀`,
      text: metaDescription,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${item.title}\n${shareUrl}`);
        alert('링크가 클립보드에 복사되었습니다.');
      }
    } catch (error) {
      console.error('공유 오류:', error);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* 오버레이 배경 */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          variants={overlayVariants}
        />

        {/* 모달 콘텐츠 */}
        <motion.div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* 헤더 - 닫기 및 공유 버튼 */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="닫기"
            >
              <FaTimes className="text-xl text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={sharePortfolio}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <FaShare />
              공유
            </button>
          </div>

          {/* 이미지 영역 */}
          <div className="px-6 pt-6">
            <div className="relative aspect-square max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg">
              <ResponsiveImage
                src={item.image}
                alt={item.title}
                className="object-cover"
                pictureClassName="block w-full h-full"
                sizes="320px"
                fill
              />
            </div>
          </div>

          {/* 콘텐츠 영역 */}
          <div className="p-6">
            {/* 카테고리 배지 */}
            <div className="mb-3">
              <span
                className="inline-block px-3 py-1 text-sm font-medium text-white rounded-full"
                style={{ backgroundColor: categoryInfo.color }}
              >
                {categoryInfo.name}
              </span>
            </div>

            {/* 제목 */}
            <h2
              id="modal-title"
              className="text-heading-3 font-title text-gray-900 dark:text-white mb-2"
            >
              {item.title}
            </h2>

            {/* 아티스트 */}
            <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-4">
              아티스트: {item.artist}
            </p>

            {/* 제공 서비스 */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
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

            {/* 외부 링크 버튼 */}
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium"
            >
              <FaExternalLinkAlt />
              음원 들으러 가기
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PortfolioDetailModal;
