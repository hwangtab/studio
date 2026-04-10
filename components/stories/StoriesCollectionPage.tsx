import React, { useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import StoryCard from '../StoryCard';
import CategoryFilter from '../CategoryFilter';
import SEO from '../SEO';
import ImageHero from '../common/ImageHero';
import ContactCTA from '../common/ContactCTA';
import { Section } from '../ui/Section';
import Pagination from '../ui/Pagination';
import { buildStoriesPath } from '../../lib/storyRoutes';
import type { Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { generateItemListSchema } from '../../utils/schemaGenerator';
import { STORY_CATEGORY_KEYS, type StoryCategoryKey, type StoryListItem } from '../../types/story';

interface StoriesCollectionPageProps {
  locale: Locale;
  stories: StoryListItem[];
  availableCategories: StoryCategoryKey[];
  activeCategory: StoryCategoryKey | null;
  currentPage: number;
  totalPages: number;
}

const StoriesCollectionPage = ({
  locale,
  stories,
  availableCategories,
  activeCategory,
  currentPage,
  totalPages,
}: StoriesCollectionPageProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = React.useMemo(() => getSiteConfig(locale).url, [locale]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const canonicalPath = buildStoriesPath(locale, activeCategory, currentPage);
  const paginationPrev = currentPage > 1 ? buildStoriesPath(locale, activeCategory, currentPage - 1) : undefined;
  const paginationNext = currentPage < totalPages ? buildStoriesPath(locale, activeCategory, currentPage + 1) : undefined;
  const activeCategoryId = activeCategory ?? 'all';
  const activeCategoryLabel = activeCategory ? t(`stories.categories.${activeCategory}`) : null;

  const seoTitleBase = t('stories.seo.title');
  const seoTitle = activeCategoryLabel
    ? `${activeCategoryLabel} | ${seoTitleBase}${currentPage > 1 ? ` #${currentPage}` : ''}`
    : currentPage > 1
      ? `${seoTitleBase} #${currentPage}`
      : seoTitleBase;

  const seoDescription = activeCategoryLabel
    ? `${activeCategoryLabel} · ${t('stories.hero.subtitle')}`
    : t('stories.seo.description');

  const storiesItemListSchema = useMemo(
    () =>
      generateItemListSchema(
        stories.map((story) => ({
          id: story.slug,
          name: story.title,
          url: `/${locale}/stories/${story.slug}`,
          image: story.thumbnail ?? undefined,
          description: story.summary,
        })),
        siteUrl,
        locale,
        activeCategoryLabel || t('nav.stories')
      ),
    [activeCategoryLabel, locale, siteUrl, stories, t]
  );

  const categories = useMemo(
    () => [
      {
        id: 'all',
        label: t('stories.filters.all'),
        href: buildStoriesPath(locale, null, 1),
      },
      ...availableCategories.map((key) => ({
        id: key,
        label: t(`stories.categories.${key}`),
        href: buildStoriesPath(locale, key, 1),
      })),
    ],
    [availableCategories, locale, t]
  );

  const storyCardLabels = useMemo(
    () => ({
      defaultCategory: t('stories.list.defaultCategory'),
      noDate: t('stories.list.noDate'),
      noTitle: t('stories.list.noTitle'),
      noContent: t('stories.list.noContent'),
      categoryByKey: Object.fromEntries(
        STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
      ),
    }),
    [t]
  );

  const shouldNoIndex = currentPage > 1 || activeCategory !== null;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalPath}
        keywords={t('stories.seo.keywords')}
        ogImage="/images/studio1.webp"
        ogImageAlt={t('stories.hero.alt')}
        ogImageWidth={1440}
        ogImageHeight={809}
        includeSchema
        webPageType="CollectionPage"
        schema={storiesItemListSchema}
        robots={shouldNoIndex ? 'noindex, follow' : undefined}
        paginationPrev={paginationPrev}
        paginationNext={paginationNext}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          ...(activeCategoryLabel
            ? [{ name: activeCategoryLabel, path: buildStoriesPath(locale, activeCategory, 1) }]
            : []),
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

      <Section variant="default">
        <div ref={sectionRef}>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategoryId}
              categories={categories}
            />
          </div>

          <h2 className="sr-only">
            {activeCategoryLabel || t('nav.stories')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stories.map((story) => (
              <StoryCard
                key={story.slug}
                story={story}
                locale={locale}
                labels={storyCardLabels}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-12">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                getPageHref={(page) => buildStoriesPath(locale, activeCategory, page)}
                locale={locale}
              />
            </div>
          )}
        </div>
      </Section>

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

export default StoriesCollectionPage;
