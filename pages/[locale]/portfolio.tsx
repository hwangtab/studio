import React, { useMemo, useState, useEffect } from 'react';
import type { NextPageWithLayout } from '../../types';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { Music, Headphones, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { filterPortfolioItems } from '../../utils/portfolioDataUtils';
import CategoryFilter from '../../components/CategoryFilter';
import SEO from '../../components/SEO';
import { generateItemListSchema, generateAudioObjectSchema } from '../../utils/schemaGenerator';
import { getSiteConfig } from '../../data/siteConfig';
import ImageHero from '../../components/common/ImageHero';
import ContactCTA from '../../components/common/ContactCTA';
import { getPortfolioItems, getAudioTracks, getCategories } from '../../data/portfolio';
const PortfolioDetailModal = dynamic(() => import('../../components/PortfolioDetailModal'), { ssr: false });
const AudioPlayer = dynamic(() => import('../../components/AudioPlayer'), { ssr: false });
import ProjectRowCard from '../../components/ui/ProjectRowCard';
import SectionHeading from '../../components/ui/SectionHeading';
import type { PortfolioItem, AudioTrack, PortfolioCategory } from '../../types/data';
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
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
  const siteUrl = React.useMemo(() => getSiteConfig(locale).url, [locale]);
  // canonical은 항상 목록 페이지로 고정. 모달은 클라이언트 UX이며 SSR 단계에서
  // 아이템 상세 URL이 canonical로 인식되면 색인이 오염됨.
  const canonicalOverride = `/${locale}/portfolio`;

  const itemListSchema = React.useMemo(() => generateItemListSchema(
    initialPortfolioItems.map((item) => ({
      id: item.id,
      name: `${item.artist} - ${item.title}`,
      url: `/${locale}/portfolio/${item.id}`,
      image: item.image,
      description: item.description,
    })),
    siteUrl,
    locale,
    t('nav.portfolio')
  ), [initialPortfolioItems, locale, siteUrl, t]);

  const audioObjectSchemas = React.useMemo(() =>
    generateAudioObjectSchema(
      audioTracks.map((track) => ({
        name: track.title,
        contentUrl: track.src,
        description: track.description,
        artist: track.artist,
      })),
      siteUrl,
      locale
    ),
  [audioTracks, siteUrl, locale]);

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
        title={t('portfolio.seo.title')}
        description={t('portfolio.seo.description')}
        keywords={t('portfolio.seo.keywords')}
        ogImage="/images/recording1.webp"
        ogImageAlt={t('portfolio.heroAlt')}
        ogImageWidth={1920}
        ogImageHeight={937}
        canonical={canonicalOverride}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
        ]}
        includeSchema={true}
        schema={[itemListSchema, ...audioObjectSchemas]}
        webPageType="CollectionPage"
      />
      <ImageHero
        {...{
          locale,
          priority: true,
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
          breadcrumbItems: [
            { name: t('nav.home'), path: `/${locale}` },
            { name: t('nav.portfolio'), path: `/${locale}/portfolio` },
          ],
        }}
      />

      {audioTracks.length > 0 && (
        <Section variant="default">
          <div id="sample-tracks">
            <SectionHeading
              icon={Headphones}
              title={t('portfolio.sampleTracks')}
              align="left"
              className="mb-8"
              titleClassName="typo-card-title"
              as="h2"
            />
            <AudioPlayer tracks={audioTracks} locale={locale} />
            {/* SSR-visible track list for crawlers (AudioPlayer is ssr:false) */}
            <noscript>
              <ul>
                {audioTracks.map((track) => (
                  <li key={track.id}>{track.artist} - {track.title}</li>
                ))}
              </ul>
            </noscript>
          </div>
        </Section>
      )}

      <Section variant="alternate">
        <div>
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
                  viewProjectLabel={t('portfolio.viewProject')}
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
                className="min-h-[44px] px-6 py-3 rounded-full bg-primary text-white hover:bg-primary-dark transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
              >
                {t('actions.more')}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 서비스 바로가기 */}
      <Section variant="default" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-accent text-accent font-semibold hover:bg-accent hover:text-white transition-colors duration-200"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-colors duration-200"
          >
            {t('nav.pricing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section variant="alternate" className="py-16">
        <ContactCTA
          locale={locale}
          title={t('pricing.cta.title')}
          subtitle={t('pricing.cta.subtitle')}
          imageSrc="/images/recording15.webp"
          imageAlt={t('pricing.images.packageAlt')}
          primaryButtonLabel={t('pricing.cta.inquiry')}
          secondaryButtonLabel={t('pricing.cta.location')}
          headingAs="h3"
        />
      </Section>

      {/* 크롤러용 전체 포트폴리오 링크 (sr-only: 시각적으로 숨김, 크롤러 접근 가능) */}
      <nav aria-label="All portfolio items" className="sr-only">
        <ul>
          {initialPortfolioItems.map((item) => (
            <li key={item.id}>
              <a href={`/${locale}/portfolio/${item.id}`}>{item.artist} - {item.title}</a>
            </li>
          ))}
        </ul>
      </nav>

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
  const locale = resolveLocaleParam(params?.locale);

  const initialPortfolioItems = getPortfolioItems(locale);
  const audioTracks = getAudioTracks(locale);
  const categories = getCategories(locale);

  return buildPageStaticProps(
    locale,
    {
      initialPortfolioItems,
      audioTracks,
      categories,
    },
    { revalidate: 3600 }
  );
};

export default Portfolio;
