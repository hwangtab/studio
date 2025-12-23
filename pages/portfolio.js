import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FaMusic, FaHeadphones } from 'react-icons/fa';
import { filterPortfolioItems } from '../utils/portfolioDataUtils';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import { categories, portfolioItems, audioTracks } from '../data/portfolio';
import PortfolioDetailModal from '../components/PortfolioDetailModal';
const AudioPlayer = dynamic(() => import('../components/AudioPlayer').then((mod) => mod.default), { ssr: false });

import PortfolioCard from '../components/ui/PortfolioCard';

const Portfolio = ({
  initialPortfolioItems = [],
  audioTracks = [],
  categories = [],
}) => {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = useMemo(
    () => filterPortfolioItems(initialPortfolioItems, selectedCategory),
    [initialPortfolioItems, selectedCategory]
  );

  // URL 쿼리에서 모달 상태 복원 (shallow routing 지원)
  useEffect(() => {
    const itemId = router.query.item;
    if (itemId) {
      const item = initialPortfolioItems.find((p) => p.id === itemId);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [router.query.item, initialPortfolioItems]);

  // 브라우저 뒤로가기 처리
  useEffect(() => {
    const handlePopState = () => {
      if (!router.query.item) {
        setSelectedItem(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router.query.item]);

  // 카드 클릭 핸들러
  const handleCardClick = (item) => {
    setSelectedItem(item);
    router.push(`/portfolio?item=${item.id}`, `/portfolio/${item.id}`, { shallow: true });
  };

  // 모달 닫기 핸들러
  const handleCloseModal = () => {
    setSelectedItem(null);
    router.push('/portfolio', undefined, { shallow: true });
  };

  // 카테고리 변경 핸들러
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  return (
    <>
      <SEO
        title="포트폴리오 - 스튜디오 놀의 작업 결과물"
        description="스튜디오 놀에서 제작한 음반, 싱글, 앨범 작업 결과물. 다양한 장르의 뮤지션들과 함께한 레코딩, 믹싱, 마스터링 포트폴리오."
        keywords="스튜디오 놀 포트폴리오, 음반 제작 실적, 믹싱 마스터링 작업물, 레코딩 샘플, 음악 제작 사례"
        canonical="https://studionol.co.kr/portfolio"
      />
      <div className="container mx-auto px-4 pt-16 pb-12">
        {/* 헤더 섹션 */}
        <div className="mb-16 text-center">
          <motion.h1
            className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
            {...PAGE_TITLE_ANIMATION}
          >
            포트폴리오
          </motion.h1>
          <motion.p
            className="typo-section-lead max-w-2xl mx-auto"
            {...PAGE_SUBTITLE_ANIMATION}
          >
            스튜디오 놀에서 작업한 다양한 프로젝트들을 소개합니다.
            <br />
            각 작품을 클릭하여 더 자세한 정보를 확인하세요.
          </motion.p>
          {audioTracks.length > 0 && <div className="mt-6" />}
        </div>

        {/* 샘플 트랙 섹션 */}
        {audioTracks.length > 0 && (
          <motion.section
            id="sample-tracks"
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center mb-8">
              <FaHeadphones className="text-2xl text-primary mr-3" />
              <h2 className="typo-card-title text-gray-600 dark:text-gray-200">샘플 트랙</h2>
            </div>
            <AudioPlayer tracks={audioTracks} />
          </motion.section>
        )}

        {/* 카테고리 필터 */}
        <motion.div
          className="mb-12"
          {...PAGE_CONTENT_ANIMATION}
        >
          <CategoryFilter
            activeCategory={selectedCategory}
            setActiveCategory={handleCategoryChange}
            categories={categories}
            buttonSize="lg"
            useCustomColors={true}
            gap="gap-3"
          />
        </motion.div>

        {/* 포트폴리오 그리드 */}
        <motion.div
          className="mb-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <FaMusic className="text-2xl text-primary mr-3" />
              <h2 className="typo-card-title text-gray-600 dark:text-gray-200">작업 프로젝트</h2>
            </div>
            <div className="typo-card-meta text-gray-500 dark:text-gray-400">
              {filteredItems.length > 0 ? `${filteredItems.length}개 프로젝트` : '등록된 프로젝트 없음'}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center pt-16 pb-12">
              <FaMusic className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="typo-card-body text-gray-500 dark:text-gray-400">
                선택한 카테고리에 해당하는 프로젝트가 없습니다.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredItems.map((item) => (
                <PortfolioCard
                  key={item.id}
                  {...item}
                  onClick={() => handleCardClick(item)}
                />
              ))}
            </div>
          )}
        </motion.div>

      </div>

      {/* 포트폴리오 상세 모달 */}
      {selectedItem && (
        <PortfolioDetailModal item={selectedItem} onClose={handleCloseModal} />
      )}
    </>
  );
};

export default Portfolio;

export const getStaticProps = () => {
  return {
    props: {
      initialPortfolioItems: portfolioItems,
      audioTracks,
      categories,
    },
    revalidate: 60,
  };
};
