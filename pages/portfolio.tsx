import React, { useMemo, useState, useEffect } from 'react';
import type { NextPage, GetStaticProps } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Headphones } from 'lucide-react';
import { filterPortfolioItems } from '../utils/portfolioDataUtils';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import SEO from '../components/SEO';
import ImageHero from '../components/common/ImageHero';
import { categories, portfolioItems, audioTracks } from '../data/portfolio';
import PortfolioDetailModal from '../components/PortfolioDetailModal';
const AudioPlayer = dynamic(() => import('../components/AudioPlayer'), { ssr: false });
import PortfolioCard from '../components/ui/PortfolioCard';
import type { PortfolioItem, AudioTrack, PortfolioCategory } from '../types/data';

interface PortfolioProps {
  initialPortfolioItems: readonly PortfolioItem[];
  audioTracks: readonly AudioTrack[];
  categories: readonly PortfolioCategory[];
}

const Portfolio: NextPage<PortfolioProps> = ({
  initialPortfolioItems = [],
  audioTracks = [],
  categories = [],
}) => {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  const filteredItems = useMemo(
    () => filterPortfolioItems(initialPortfolioItems, selectedCategory),
    [initialPortfolioItems, selectedCategory]
  );

  useEffect(() => {
    const itemId = router.query.item;
    if (itemId) {
      const item = initialPortfolioItems.find((p) => p.id === itemId);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [router.query.item, initialPortfolioItems]);

  useEffect(() => {
    const handlePopState = () => {
      if (!router.query.item) {
        setSelectedItem(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [router.query.item]);

  const handleCardClick = (item: PortfolioItem) => {
    setSelectedItem(item);
    router.push(`/portfolio?item=${item.id}`, undefined, { shallow: true, scroll: false });
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    router.push('/portfolio', undefined, { shallow: true, scroll: false });
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  return (
    <>
      <SEO
        title="녹음/믹싱 샘플 듣기 · 포트폴리오 | 스튜디오 놀"
        description="스튜디오 놀의 레코딩, 믹싱, 마스터링 결과물을 직접 확인해보세요. 인디 록부터 발라드, 힙합까지 장르별 고음질 사운드 샘플을 들어보실 수 있습니다."
        keywords="녹음 샘플, 믹싱 전후 비교, 마스터링 예시, 스튜디오 포트폴리오, 음반 제작 퀄리티, 레코딩 결과물, 스튜디오 놀"
        canonical="https://studionol.co.kr/portfolio"
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '포트폴리오', path: '/portfolio' },
        ]}
      />
      <ImageHero
        {...{
          title: "포트폴리오",
          subtitle: (
            <>
              스튜디오 놀에서 작업한 다양한 프로젝트들을 소개합니다.
              <br />
              각 작품을 클릭하여 더 자세한 정보를 확인하세요.
            </>
          ),
          backgroundImage: "/images/recording1.png",
          imageAlt: "스튜디오 놀 포트폴리오",
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/60 via-black/40 to-transparent",
        }}
      />
      <div className="container mx-auto px-4 py-16">

        {audioTracks.length > 0 && (
          <motion.section
            id="sample-tracks"
            className="mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center mb-8">
              <Headphones className="text-primary mr-3" size={24} />
              <h2 className="typo-card-title text-gray-600 dark:text-gray-200">샘플 트랙</h2>
            </div>
            <AudioPlayer tracks={audioTracks} />
          </motion.section>
        )}

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

        <motion.div
          className="mb-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Music className="text-primary mr-3" size={24} />
              <h2 className="typo-card-title text-gray-600 dark:text-gray-200">작업 프로젝트</h2>
            </div>
            <div className="typo-card-meta text-gray-500 dark:text-gray-400">
              {filteredItems.length > 0 ? `${filteredItems.length}개 프로젝트` : '등록된 프로젝트 없음'}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center pt-16 pb-12">
              <Music className="text-gray-300 dark:text-gray-600 mx-auto mb-4" size={64} />
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

      {/* @ts-ignore - AnimatePresence type issue */}
      <AnimatePresence>
        {selectedItem && (
          <PortfolioDetailModal item={selectedItem} onClose={handleCloseModal} />
        )}
      </AnimatePresence>
    </>
  );
};

export default Portfolio;

(Portfolio as any).hasHero = true;

export const getStaticProps: GetStaticProps<PortfolioProps> = () => {
  return {
    props: {
      initialPortfolioItems: portfolioItems,
      audioTracks: audioTracks,
      categories: categories,
    },
  };
};
