import { useMemo, useState, useEffect } from 'react';
import type { NextPageWithLayout } from '../../types';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import ServiceLinkPill from '../../components/ui/ServiceLinkPill';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import { Music, Headphones } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import { filterPortfolioItems } from '../../utils/portfolioDataUtils';
import CategoryFilter from '../../components/CategoryFilter';
import SEO from '../../components/SEO';
import { generateItemListSchema, generateAudioObjectSchema } from '../../utils/schema';
import { getSiteConfig } from '../../data/siteConfig';
import ImageHero, { HERO_SCRIM } from '../../components/common/ImageHero';
const ContactCTA = dynamic(() => import('../../components/common/ContactCTA'));
import { getPortfolioItems, getAudioTracks, getCategories } from '../../data/portfolio';
const PortfolioDetailModal = dynamic(() => import('../../components/PortfolioDetailModal'), { ssr: false });
import PortfolioCoverGrid from '../../components/portfolio/PortfolioCoverGrid';
import PortfolioSampleTracks from '../../components/portfolio/PortfolioSampleTracks';
import WaveRule from '../../components/ui/WaveRule';
import { EmptyState } from '../../components/ui/EmptyState';
import SectionHeading from '../../components/ui/SectionHeading';
import type { PortfolioItem, AudioTrack, PortfolioCategory } from '../../types/data';
import { Section } from '../../components/ui/Section';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../lib/getStatic';
import type { Locale } from '../../lib/i18n';
import { BUTTON_DEPTH } from '../../components/ui/buttonDepth';

interface PortfolioProps {
  locale: Locale;
  initialPortfolioItems: readonly PortfolioItem[];
  audioTracks: readonly AudioTrack[];
  categories: readonly PortfolioCategory[];
  itemListSchema: Record<string, unknown>;
  audioObjectSchemas: Record<string, unknown>[];
}

const Portfolio: NextPageWithLayout<PortfolioProps> = ({
  locale,
  initialPortfolioItems = [],
  audioTracks = [],
  categories = [],
  itemListSchema,
  audioObjectSchemas,
}) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  // canonical은 항상 목록 페이지로 고정. 모달은 클라이언트 UX이며 SSR 단계에서
  // 아이템 상세 URL이 canonical로 인식되면 색인이 오염됨.
  const canonicalOverride = `/${locale}/portfolio`;

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
        locale={locale}
        title={t('portfolio.seo.title')}
        description={t('portfolio.seo.description')}
        keywords={t('portfolio.seo.keywords')}
        ogImage="/images/og-recording1.webp"
        ogImageAlt={t('portfolio.heroAlt')}
        ogImageWidth={1200}
        ogImageHeight={630}
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
          overlayGradient: HERO_SCRIM,
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
            {/* 라이너 노트 §3-6: LP판 플레이어 대신 글로벌 미니 플레이어로 트는 세 줄. 재생 전 0바이트. */}
            <PortfolioSampleTracks locale={locale} tracks={audioTracks} />
            {/* SSR-visible track list for crawlers (AudioPlayer is ssr:false) */}
            <noscript>
              <ul>
                {audioTracks.map((track) => (
                  <li key={track.id}>{track.artist} - {track.title}</li>
                ))}
              </ul>
            </noscript>
            {/* 파형 모티프(§3-6 d) — 움직이지 않는 장식. */}
            <WaveRule className="mt-12 text-gray-300 dark:text-gray-700" />
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
            <EmptyState icon={Music} title={t('portfolio.noProjects')} className="my-8" />
          ) : (
            /* 라이너 노트 §3-8: 목록 행(배지·크레딧 나열) → 커버 그리드. 발췌가 있는 커버에는 재생 버튼. */
            <PortfolioCoverGrid
              locale={locale}
              items={visibleItems}
              categories={categories}
              onSelect={handleCardClick}
              viewProjectLabel={t('portfolio.viewProject')}
            />
          )}

          {hasMoreItems && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className={`min-h-[44px] px-6 py-3 rounded-full bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 transition-colors font-medium touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950/70 dark:focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${BUTTON_DEPTH.ink}`}
              >
                {t('actions.more')}
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section variant="default" spacing="tight">
        <div className="flex flex-wrap justify-center gap-4">
          <ServiceLinkPill href={`/${locale}/wedding-song`} tone="primary">
            {t('nav.weddingSong')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/voice-acting`} tone="primary">
            {t('nav.voiceActing')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/lesson`} tone="primary">
            {t('nav.lesson')}
          </ServiceLinkPill>
          <ServiceLinkPill href={`/${locale}/pricing`} tone="primary">
            {t('nav.pricing')}
          </ServiceLinkPill>
        </div>
      </Section>

      <Section variant="alternate">
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
Portfolio.designEdition = 'v2';

// i18n hook을 쓸 수 없는 getStaticProps용 포트폴리오 라벨 맵.
const PORTFOLIO_LABELS: Record<string, string> = {
  ko: '포트폴리오', en: 'Portfolio', zh: '作品集',
  es: 'Portafolio', vi: 'Danh mục', th: 'ผลงาน', uz: 'Portfolio',
};

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;
export const getStaticProps: GetStaticProps<PortfolioProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);

  // productionNotes는 7개 언어 전체가 포함되어 __NEXT_DATA__가 과대해짐.
  // 목록 페이지 모달은 현재 locale 노트만 표시하므로 나머지 언어를 제거해 직렬화 크기를 절감.
  // JSON round-trip으로 모든 undefined 키를 제거 — Next.js getStaticProps는 undefined 직렬화 불가.
  const initialPortfolioItems = JSON.parse(
    JSON.stringify(
      getPortfolioItems(locale).map((item) => {
        const note = item.productionNotes?.[locale];
        const { productionNotes: _omit, ...rest } = item;
        return note ? { ...rest, productionNotes: { [locale]: note } } : rest;
      })
    )
  ) as PortfolioItem[];
  const audioTracks = getAudioTracks(locale);
  const categories = getCategories(locale);

  // schema 연산을 빌드 타임에 수행해 hydration 블로킹 제거.
  const siteUrl = getSiteConfig(locale).url;
  const itemListSchema = generateItemListSchema(
    initialPortfolioItems.map((item) => ({
      id: item.id,
      name: `${item.artist} - ${item.title}`,
      url: `/${locale}/portfolio/${item.id}`,
      image: item.image,
      description: item.description,
    })),
    siteUrl,
    locale,
    PORTFOLIO_LABELS[locale] ?? 'Portfolio'
  );
  const audioObjectSchemas = generateAudioObjectSchema(
    audioTracks.map((track) => ({
      name: track.title,
      contentUrl: track.src,
      description: track.description,
      artist: track.artist,
    })),
    siteUrl,
    locale
  );

  return buildPageStaticProps(
    locale,
    {
      initialPortfolioItems,
      audioTracks,
      categories,
      itemListSchema,
      audioObjectSchemas,
    },
    { revalidate: 3600, i18nSections: ['portfolio', 'pricing'] }
  );
};

export default Portfolio;
