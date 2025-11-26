import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { FaExternalLinkAlt, FaMusic, FaHeadphones } from 'react-icons/fa';
import { filterPortfolioItems, hydratePortfolioData } from '../utils/portfolioDataUtils';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
import { readPortfolioData } from '../lib/portfolio';
const AudioPlayer = dynamic(() => import('../components/AudioPlayer').then((mod) => mod.default), { ssr: false });

const PortfolioItem = ({ image, title, description, link }) => (
  <motion.div
    className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 cursor-pointer"
    onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
  >
    <div className="relative overflow-hidden">
      <div className="w-full pb-[100%] relative">
        <ResponsiveImage 
          src={image} 
          alt={title} 
          pictureClassName="absolute inset-0 block h-full w-full"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          loading="lazy"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        />
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 bg-white/90 text-primary p-3 rounded-full shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-white z-10"
        aria-label="외부 링크로 이동"
        onClick={(e) => e.stopPropagation()}
      >
        <FaExternalLinkAlt />
      </a>
    </div>
    
    <div className="p-6">
      <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-3">{title}</h3>
      <p className="typo-card-body">{description}</p>
    </div>
    
    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
  </motion.div>
);

const Portfolio = ({
  initialPortfolioItems = [],
  audioTracks = [],
  categories = [],
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredItems = useMemo(
    () => filterPortfolioItems(initialPortfolioItems, selectedCategory),
    [initialPortfolioItems, selectedCategory]
  );

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
        className="mb-24"
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
              <PortfolioItem key={item.id} {...item} />
            ))}
          </div>
        )}
      </motion.div>
      
      </div>
    </>
  );
};

export default Portfolio;

export const getStaticProps = () => {
  const rawData = readPortfolioData();
  const { portfolioItems, audioTracks, categories } = hydratePortfolioData(rawData);

  return {
    props: {
      initialPortfolioItems: portfolioItems,
      audioTracks,
      categories,
    },
    revalidate: 60,
  };
};
