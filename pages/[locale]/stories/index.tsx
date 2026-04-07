import React, { useMemo, useState, useRef } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import Breadcrumb from '../../../components/ui/Breadcrumb';
import ContactCTA from '../../../components/common/ContactCTA';
import { getAllStories } from '../../../lib/stories';
import type { Story } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import Pagination from '../../../components/ui/Pagination';
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { generateItemListSchema } from '../../../utils/schemaGenerator';
import { getSiteConfig } from '../../../data/siteConfig';

import type { NextPageWithLayout } from '../../../types';

interface StoriesPageProps {
  locale: Locale;
  stories: Story[];
}

const StoriesPage: NextPageWithLayout<StoriesPageProps> = ({ locale, stories }) => {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const currentPage = Number(router.query.page) || 1;
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = React.useMemo(() => getSiteConfig(locale).url, [locale]);

  const storiesItemListSchema = React.useMemo(() => generateItemListSchema(
    stories.slice(0, 20).map((story) => ({
      id: story.slug,
      name: story.title,
      url: `/${locale}/stories/${story.slug}`,
      image: story.thumbnail ?? undefined,
      description: story.summary,
    })),
    siteUrl,
    locale,
    t('nav.stories')
  ), [stories, locale, siteUrl, t]);
  const sectionRef = useRef<HTMLDivElement>(null);


  const categories = useMemo(() => {
    const uniqueKeys = new Set(stories.map((story) => story.categoryKey).filter(Boolean));
    return Array.from(uniqueKeys).map(key => ({
      id: key,
      label: t(`stories.categories.${key}`)
    }));
  }, [stories, t]);

  const filteredStories = useMemo(() => {
    if (activeCategory === 'all') return stories;
    return stories.filter((story) => story.categoryKey === activeCategory);
  }, [stories, activeCategory]);

  const totalPages = Math.ceil(filteredStories.length / ITEMS_PER_PAGE);

  const visibleStories = useMemo(
    () => filteredStories.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredStories, currentPage]
  );


  const storyCardLabels = useMemo(
    () => ({
      defaultCategory: t('stories.list.defaultCategory'),
      noDate: t('stories.list.noDate'),
      noTitle: t('stories.list.noTitle'),
      noContent: t('stories.list.noContent'),
      categoryByKey: {
        notice: t('stories.categories.notice'),
        event: t('stories.categories.event'),
        lesson: t('stories.categories.lesson'),
        interview: t('stories.categories.interview'),
        review: t('stories.categories.review'),
        region: t('stories.categories.region'),
        vocal: t('stories.categories.vocal'),
        recording: t('stories.categories.recording'),
        production: t('stories.categories.production'),
        mixing: t('stories.categories.mixing'),
        business: t('stories.categories.business'),
        guide: t('stories.categories.guide'),
      },
    }),
    [t]
  );

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId);
    router.push(
      { pathname: router.pathname, query: { locale: router.query.locale } },
      undefined,
      { shallow: true }
    );
  };

  const handlePageChange = (page: number) => {
    const query: Record<string, string | number> = { locale: router.query.locale as string };
    if (page > 1) query.page = page;
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
    if (sectionRef.current) {
      const yOffset = -100;
      const y = sectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <>
      <SEO
        title={t('stories.seo.title')}
        description={t('stories.seo.description')}
        keywords={t('stories.seo.keywords')}
        ogImage="/images/studio1.webp"
        ogImageAlt={t('stories.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={809}
        includeSchema
        webPageType="CollectionPage"
        schema={storiesItemListSchema}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
        ]}
      />
      <ImageHero
        locale={locale}
        priority
        title={t('stories.hero.title')}
        subtitle={t('stories.hero.subtitle')}
        backgroundImage="/images/studio1.webp"
        imageAlt={t('stories.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
      />
      <Breadcrumb
        items={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
        ]}
      />
      <Section variant="default">
        <div ref={sectionRef}>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategory}
              setActiveCategory={handleCategoryChange}
              categories={categories}
              allLabel={t('stories.filters.all')}
            />
          </div>

          {filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4 text-gray-800 dark:text-white">
                {t('stories.empty.title')}
              </h2>
              <p className="typo-card-body">
                {activeCategory === 'all'
                  ? t('stories.empty.all')
                  : t('stories.empty.byCategory', { category: t(`stories.categories.${activeCategory}`) })}
              </p>
            </div>
          ) : (
            <>
              <h2 className="sr-only">
                {activeCategory === 'all'
                  ? t('nav.stories')
                  : t(`stories.categories.${activeCategory}`)}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {visibleStories.map((story) => (
                  <StoryCard
                    key={story.slug}
                    story={story}
                    locale={locale}
                    labels={storyCardLabels}
                  />
                ))}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <div className="mt-12">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                locale={locale}
              />
            </div>
          )}

          {/* 크롤러용 전체 스토리 링크 (sr-only: 시각적으로 숨김, 크롤러 접근 가능) */}
          <nav aria-label="All stories" className="sr-only">
            <ul>
              {stories.map((story) => (
                <li key={story.slug}>
                  <a href={`/${locale}/stories/${story.slug}`}>{story.title}</a>
                </li>
              ))}
            </ul>
          </nav>
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
            href={`/${locale}/practice-room`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors duration-200"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
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
    </>
  );
};

StoriesPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  const stories = getAllStories(locale);

  return buildPageStaticProps(
    locale,
    {
      stories,
    },
    { revalidate: 1800 }
  );
};

export default StoriesPage;
