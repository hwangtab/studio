import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, ExternalLink } from 'lucide-react';
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
          className="absolute inset-0 bg-black/60 backdrop-blur-sm will-change-transform [transform:translateZ(0)] [-webkit-transform:translateZ(0)]"
          variants={overlayVariants}
        />

        {/* 모달 콘텐츠 */}
        <motion.div
          className="relative w-full max-w-lg md:max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* 헤더 (모바일 전용 - 닫기 버튼) */}
          <div className="md:hidden sticky top-0 z-10 flex items-center justify-between p-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700">
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

          {/* 좌측: 이미지 영역 (데스크탑: 50% 너비 / 모바일: 상단) */}
          <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 relative min-h-[300px] md:min-h-[500px]">
            <div className="md:absolute md:inset-0 h-full w-full">
              <ResponsiveImage
                src={item.image}
                alt={item.title}
                className="object-cover"
                pictureClassName="block w-full h-full"
                sizes="(min-width: 768px) 50vw, 100vw"
                fill
              />
            </div>
            {/* 데스크탑 전용 닫기 버튼 (이미지 위에 오버레이) */}
            <button
              onClick={onClose}
              className="hidden md:flex absolute top-4 left-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full text-white transition-colors z-20"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>

          {/* 우측: 콘텐츠 영역 (데스크탑: 50% 너비, 스크롤 가능) */}
          <div className="w-full md:w-1/2 flex flex-col max-h-[90vh] md:overflow-y-auto">
            {/* 데스크탑 헤더 (공유 버튼 등) */}
            <div className="hidden md:flex justify-end p-6 pb-0">
              <button
                onClick={sharePortfolio}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <Share2 size={16} />
                공유하기
              </button>
            </div>

            <div className="p-6 md:p-8 flex flex-col flex-grow">
              {/* 카테고리 배지 */}
              <div className="mb-4">
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
              <p className="typo-card-body text-gray-600 dark:text-gray-300 mb-6 text-lg">
                아티스트: <span className="font-semibold text-gray-900 dark:text-white">{item.artist}</span>
              </p>

              <hr className="border-gray-100 dark:border-gray-700 mb-6" />

              {/* 제공 서비스 */}
              <div className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  제공 서비스
                </h3>
                <div className="flex flex-wrap gap-2">
                  {item.services.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md text-sm font-medium border border-gray-200 dark:border-gray-700"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-grow"></div>

              {/* 외부 링크 버튼 */}
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 pb-2">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-nori-dark hover:bg-nori-dark/90 text-white rounded-xl transition-all font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  음원 들으러 가기
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PortfolioDetailModal;
