import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { FaExternalLinkAlt, FaMusic, FaHeadphones } from 'react-icons/fa';
import { 
  getAllPortfolioItems, 
  getPortfolioItemsByCategory, 
  getAllCategories, 
  getAllAudioTracks 
} from '../utils/portfolioDataUtils';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';
import SEO from '../components/SEO';
const AudioPlayer = dynamic(() => import('../components/AudioPlayer'), { ssr: false });

const PortfolioItem = ({ image, title, description, link, index }) => (
  <motion.div
    className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 cursor-pointer"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    whileHover={{ y: -5 }}
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

const Portfolio = () => {
  // 상태 관리
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [itemsData, tracksData, categoriesData] = await Promise.all([
          getAllPortfolioItems(),
          getAllAudioTracks(),
          getAllCategories()
        ]);
        
        setPortfolioItems(itemsData);
        setAudioTracks(tracksData);
        setCategories(categoriesData);
        setFilteredItems(itemsData);
        setError(null);
      } catch (err) {
        console.error('데이터 로딩 오류:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 카테고리 필터링
  useEffect(() => {
    const filterItems = async () => {
      try {
        const filtered = await getPortfolioItemsByCategory(selectedCategory);
        setFilteredItems(filtered);
      } catch (err) {
        console.error('필터링 오류:', err);
        setFilteredItems(portfolioItems);
      }
    };

    if (portfolioItems.length > 0) {
      filterItems();
    }
  }, [selectedCategory, portfolioItems]);

  // 카테고리 변경 핸들러
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  // 로딩 상태 렌더링
  if (loading) {
    return (
      <>
        <SEO
          title="포트폴리오 - 스튜디오 놀의 작업 결과물"
          description="스튜디오 놀에서 제작한 음반, 싱글, 앨범 작업 결과물. 다양한 장르의 뮤지션들과 함께한 레코딩, 믹싱, 마스터링 포트폴리오."
          keywords="스튜디오 놀 포트폴리오, 음반 제작 실적, 믹싱 마스터링 작업물, 레코딩 샘플, 음악 제작 사례"
          canonical="https://studionol.co.kr/portfolio"
        />
        <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="typo-section-lead">포트폴리오 데이터를 불러오는 중...</p>
        </div>
        </div>
      </>
    );
  }

  // 에러 상태 렌더링
  if (error) {
    return (
      <>
        <SEO
          title="포트폴리오 - 스튜디오 놀의 작업 결과물"
          description="스튜디오 놀에서 제작한 음반, 싱글, 앨범 작업 결과물. 다양한 장르의 뮤지션들과 함께한 레코딩, 믹싱, 마스터링 포트폴리오."
          keywords="스튜디오 놀 포트폴리오, 음반 제작 실적, 믹싱 마스터링 작업물, 레코딩 샘플, 음악 제작 사례"
          canonical="https://studionol.co.kr/portfolio"
        />
        <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="typo-section-lead text-red-600 dark:text-red-400 text-center">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            다시 시도
          </button>
        </div>
        </div>
      </>
    );
  }

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
      </div>

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <FaMusic className="text-2xl text-primary mr-3" />
            <h2 className="typo-card-title text-gray-600 dark:text-gray-200">작업 프로젝트</h2>
          </div>
          <div className="typo-card-meta text-gray-500 dark:text-gray-400">
            {filteredItems.length}개 프로젝트
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
            {filteredItems.map((item, index) => (
              <PortfolioItem key={item.id} {...item} index={index} />
            ))}
          </div>
        )}
      </motion.div>
      
      {/* 오디오 플레이어 섹션 */}
      <motion.div
        className="mt-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex items-center mb-8">
          <FaHeadphones className="text-2xl text-primary mr-3" />
          <h2 className="typo-card-title text-gray-600 dark:text-gray-200">샘플 트랙</h2>
        </div>
        {audioTracks.length > 0 ? (
          <AudioPlayer tracks={audioTracks} />
        ) : (
          <div className="text-center pt-16 pb-12 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <FaHeadphones className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="typo-card-body text-gray-500 dark:text-gray-400">
              샘플 트랙을 준비중입니다.
            </p>
          </div>
        )}
      </motion.div>
      </div>
    </>
  );
};

export default Portfolio;
