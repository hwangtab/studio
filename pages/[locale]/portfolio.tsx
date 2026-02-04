import React, { useMemo, useState, useEffect } from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Music, Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { filterPortfolioItems } from '../../utils/portfolioDataUtils';
import CategoryFilter from '../../components/CategoryFilter';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import { getPortfolioItems, getAudioTracks, getCategories } from '../../data/portfolio';
import PortfolioDetailModal from '../../components/PortfolioDetailModal';
const AudioPlayer = dynamic(() => import('../../components/AudioPlayer'), { ssr: false });
import ProjectRowCard from '../../components/ui/ProjectRowCard';
import SectionHeading from '../../components/ui/SectionHeading';
import type { PortfolioItem, AudioTrack, PortfolioCategory } from '../../types/data';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PortfolioProps {
  locale: Locale;
  initialPortfolioItems: readonly PortfolioItem[];
  audioTracks: readonly AudioTrack[];
  categories: readonly PortfolioCategory[];
}

const Portfolio: NextPage<PortfolioProps> = ({
  locale,
  initialPortfolioItems = [],
  audioTracks = [],
  categories = [],
}) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [selectedCategory, setSelectedCategory] = useState<PortfolioCategory>({
    id: 'all',
    name: t('nav.portfolio'),
    description: 'All',
    color: '#000'
  });
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  const filteredItems = useMemo(
    () => filterPortfolioItems(initialPortfolioItems, selectedCategory.id === 'all' ? 'all' : selectedCategory.id),
    [initialPortfolioItems, selectedCategory]
  );

  // Update state when router param changes or categories update (e.g. locale change)
  useEffect(() => {
    const allCat = categories.find(c => c.id === 'all');
    if (allCat && selectedCategory.id === 'all') {
      setSelectedCategory(allCat);
    } else if (selectedCategory.id !== 'all') {
      const currentCat = categories.find(c => c.id === selectedCategory.id);
      if (currentCat) {
        setSelectedCategory(currentCat);
      }
    }
  }, [categories, selectedCategory.id]);


  useEffect(() => {
    const itemId = router.query.item;
    if (itemId) {
      const item = initialPortfolioItems.find((p) => p.id === itemId);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [router.query.item, initialPortfolioItems]);

  const handleCardClick = (item: PortfolioItem) => {
    setSelectedItem(item);
    router.push(`/${locale}/portfolio?item=${item.id}`, undefined, { shallow: true, scroll: false });
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    router.push(`/${locale}/portfolio`, undefined, { shallow: true, scroll: false });
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategory(category);
    }
  };

  return (
    <>
      <SEO
        title={t('portfolio.title')}
        description={t('portfolio.subtitle')}
        keywords="녹음 샘플, 믹싱 전후 비교, 마스터링 예시, 스튜디오 포트폴리오, 음원 제작 퀄리티, 레코딩 결과물, 스튜디오 놀"
        canonical={`https://studionol.co.kr/${locale}/portfolio`}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
        ]}
      />
      <ImageHero
        {...{
          title: t('portfolio.title'),
          subtitle: (
            <>
              {t('portfolio.subtitle')}
            </>
          ),
          backgroundImage: "/images/recording1.png",
          imageAlt: "Studio NOL Portfolio",
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/40 via-transparent to-black/20",
        }}
      />

      {audioTracks.length > 0 && (
        <Section variant="default">
          <motion.div
            id="sample-tracks"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <SectionHeading
              icon={Headphones}
              title={t('portfolio.sampleTracks')}
              align="left"
              className="mb-8"
              titleClassName="typo-card-title"
              as="h2"
            />
            <AudioPlayer tracks={audioTracks} />
          </motion.div>
        </Section>
      )}

      <Section variant="alternate">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="flex items-center">
              <SectionHeading
                icon={Music}
                title={t('portfolio.projects')}
                align="left"
                className="mb-0"
                titleClassName="typo-card-title"
                as="h2"
              />
            </div>

            <CategoryFilter
              activeCategory={selectedCategory.id}
              setActiveCategory={handleCategoryChange}
              categories={categories}
              buttonSize="sm"
              useCustomColors={true}
              gap="gap-2"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center pt-16 pb-12">
              <Music className="text-gray-300 dark:text-gray-600 mx-auto mb-4" size={64} />
              <p className="typo-card-body text-gray-500 dark:text-gray-400">
                {t('portfolio.noProjects')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredItems.map((item, index) => (
                <ProjectRowCard
                  key={item.id}
                  {...item}
                  index={index}
                  onClick={() => handleCardClick(item)}
                />
              ))}
            </div>
          )}
        </motion.div>
      </Section>

      <AnimatePresence>
        {selectedItem && (
          <PortfolioDetailModal key={selectedItem.id} item={selectedItem} categories={categories} onClose={handleCloseModal} />
        )}
      </AnimatePresence>
    </>
  );
};

(Portfolio as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps<PortfolioProps> = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';

  const initialPortfolioItems = getPortfolioItems(locale);
  const audioTracks = getAudioTracks(locale);
  const categories = getCategories(locale);

  return {
    props: {
      locale,
      initialPortfolioItems,
      audioTracks,
      categories,
    },
  };
};

export default Portfolio;
