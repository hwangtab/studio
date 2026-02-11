import React, { useMemo, useState, useEffect } from 'react';
import type { NextPageWithLayout } from '../../types';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { Music, Headphones } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { filterPortfolioItems } from '../../utils/portfolioDataUtils';
import CategoryFilter from '../../components/CategoryFilter';
import SEO from '../../components/SEO';
import ImageHero from '../../components/common/ImageHero';
import ContactCTA from '../../components/common/ContactCTA';
import { getPortfolioItems, getAudioTracks, getCategories } from '../../data/portfolio';
const PortfolioDetailModal = dynamic(() => import('../../components/PortfolioDetailModal'), { ssr: false });
const AudioPlayer = dynamic(() => import('../../components/AudioPlayer'), { ssr: false });
import ProjectRowCard from '../../components/ui/ProjectRowCard';
import SectionHeading from '../../components/ui/SectionHeading';
import type { PortfolioItem, AudioTrack, PortfolioCategory } from '../../types/data';
import { Section } from '../../components/ui/Section';
import { getCommonStaticPaths, getI18nStaticProps } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';

interface PortfolioProps {
  locale: Locale;
  initialPortfolioItems: readonly PortfolioItem[];
  audioTracks: readonly AudioTrack[];
  categories: readonly PortfolioCategory[];
}

const Portfolio: NextPageWithLayout<PortfolioProps> = ({
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
  const [visibleCount, setVisibleCount] = useState(12);

  const filteredItems = useMemo(
    () => filterPortfolioItems(initialPortfolioItems, selectedCategory.id === 'all' ? 'all' : selectedCategory.id),
    [initialPortfolioItems, selectedCategory]
  );

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const hasMoreItems = filteredItems.length > visibleCount;

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
      setVisibleCount(12);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 12);
  };

  return (
    <>
      <SEO
        title={t('portfolio.title')}
        description={t('portfolio.subtitle')}
        keywords={t('portfolio.seo.keywords')}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
        ]}
        includeSchema={true}
      />
      <ImageHero
        {...{
          locale,
          title: t('portfolio.title'),
          subtitle: (
            <>
              {t('portfolio.subtitle')}
            </>
          ),
          backgroundImage: "/images/recording1.webp",
          imageAlt: t('portfolio.heroAlt'),
          minHeight: "min-h-[60vh]",
          overlayGradient: "from-black/40 via-transparent to-black/20",
        }}
      />

      {audioTracks.length > 0 && (
        <Section variant="default">
          <m.div
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
            <AudioPlayer tracks={audioTracks} locale={locale} />
          </m.div>
        </Section>
      )}

      <Section variant="alternate">
        <m.div
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
              <Music className="text-gray-300 dark:text-gray-600 mx-auto mb-4" size={64} aria-hidden="true" />
              <p className="typo-card-body text-gray-500 dark:text-gray-400">
                {t('portfolio.noProjects')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleItems.map((item, index) => (
                <ProjectRowCard
                  key={item.id}
                  {...item}
                  index={index}
                  locale={locale}
                  onClick={() => handleCardClick(item)}
                />
              ))}
            </div>
          )}

          {hasMoreItems && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors font-medium"
              >
                {t('actions.more')}
              </button>
            </div>
          )}
        </m.div>
      </Section>

      <ContactCTA
        locale={locale}
        title={t('pricing.cta.title')}
        subtitle={t('pricing.cta.subtitle')}
        imageSrc="/images/recording15.webp"
        imageAlt={t('pricing.images.packageAlt')}
        primaryButtonLabel={t('pricing.cta.inquiry')}
        secondaryButtonLabel={t('pricing.cta.location')}
      />

      <AnimatePresence>
        {selectedItem && (
          <PortfolioDetailModal
            key={selectedItem.id}
            item={selectedItem}
            categories={categories}
            onClose={handleCloseModal}
            locale={locale}
          />
        )}
      </AnimatePresence>
    </>
  );
};

Portfolio.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps<PortfolioProps> = async ({ params }) => {
  const locale = (params?.locale as Locale) || 'ko';

  const initialPortfolioItems = getPortfolioItems(locale);
  const audioTracks = getAudioTracks(locale);
  const categories = getCategories(locale);

  return {
    props: {
      ...getI18nStaticProps(locale),
      initialPortfolioItems,
      audioTracks,
      categories,
    },
    revalidate: 3600,
  };
};

export default Portfolio;
