import React, { useMemo, useState, useRef } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import { getAllStories, isListableStory } from '../../../lib/stories';
import { STORY_CATEGORY_KEYS } from '../../../lib/storyCategories';
import type { Story } from '../../../types/story';
import Section from '../../../components/ui/Section';
import Hero from '../../../components/ui/Hero';
import Pagination from '../../../components/ui/Pagination';

// Below-fold CTA는 코드 스플리팅. 페이지 하단 노출 전까진 JS 로드 지연.
const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { generateItemListSchema } from '../../../utils/schemaGenerator';
import { getSiteConfig } from '../../../data/siteConfig';

import type { NextPageWithLayout } from '../../../types';

// 목록 페이지에 필요한 최소 필드만 포함하는 경량 Story 타입.
// category(라벨)는 제거 — i18n 번역(stories.categories[key])으로 대체.
// summary는 선택적 — 상위 50개(스키마 + 첫 페이지 카드)만 포함, 나머지는 payload 축소 위해 생략.
type StoryListItem = Pick<Story, 'slug' | 'title' | 'date' | 'categoryKey' | 'thumbnail'> & {
  summary?: string;
};

interface StoriesPageProps {
  locale: Locale;
  stories: StoryListItem[];
}

const StoriesPage: NextPageWithLayout<StoriesPageProps> = ({ locale, stories }) => {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const currentPage = Number(router.query.page) || 1;
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = React.useMemo(() => getSiteConfig(locale).url, [locale]);

  const storiesItemListSchema = React.useMemo(() => {
    const top = stories.slice(0, 50);
    return generateItemListSchema(
      top.map((story) => ({
        id: story.slug,
        name: story.title,
        url: `${siteUrl}/${locale}/stories/${story.slug}`,
        image: story.thumbnail ?? undefined,
        description: story.summary,
      })),
      siteUrl,
      locale,
      t('nav.stories')
    );
  }, [stories, locale, siteUrl, t]);
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
      categoryByKey: Object.fromEntries(
        STORY_CATEGORY_KEYS.map((key) => [key, t(`stories.categories.${key}`)])
      ),
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

  // 페이지별 self-referencing canonical — Google이 rel=prev/next를 더 이상 공식 지원하지 않으므로
  // 각 페이지 고유 콘텐츠가 색인되도록 canonical을 페이지마다 분리한다.
  const canonicalUrl = currentPage > 1
    ? `/${locale}/stories?page=${currentPage}`
    : `/${locale}/stories`;

  const prevUrl = currentPage > 1
    ? `${siteUrl}/${locale}/stories${currentPage - 1 > 1 ? `?page=${currentPage - 1}` : ''}`
    : null;
  const nextUrl = currentPage < totalPages
    ? `${siteUrl}/${locale}/stories?page=${currentPage + 1}`
    : null;

  return (
    <>
      <SEO
        locale={locale}
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
        canonical={canonicalUrl}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
        ]}
      />
      {(prevUrl || nextUrl) && (
        <Head>
          {prevUrl && <link rel="prev" href={prevUrl} />}
          {nextUrl && <link rel="next" href={nextUrl} />}
        </Head>
      )}
      <Hero
        variant="lightEditorial"
        eyebrow={t('stories.hero.subtitle')}
        title={t('stories.hero.title')}
        orbs={[{ color: 'peach', size: 600, top: '-100px', right: '-80px', opacity: 0.4 }]}
      />
      <Section tone="canvas">
        <div ref={sectionRef}>
          <div className="mb-8">
            <CategoryFilter
              activeCategory={activeCategory}
              setActiveCategory={handleCategoryChange}
              categories={categories}
              allLabel={t('stories.filters.all')}
            />
          </div>

          {/* 크롤러용 카테고리 허브 링크 (시각적으로는 CategoryFilter가 주 UX, 여기는 SEO 내부 링크) */}
          <nav aria-label="Story categories" className="sr-only">
            <ul>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <a href={`/${locale}/stories/category/${cat.id}`}>{cat.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          {filteredStories.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-ink-muted-40 text-2xl mb-4">📭</div>
              <h2 className="typo-card-title mb-4 text-ink dark:text-on-dark">
                {t('stories.empty.title')}
              </h2>
              <p className="typo-card-body text-ink-muted-80 dark:text-on-dark-soft">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
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

          {/* 크롤러용 최근 스토리 링크 — sitemap.xml이 전체 색인을 담당하므로
              여기는 허브 신호 강화용 상위 50개만 렌더한다. (성능: DOM 1707→50, TBT 대폭 감소) */}
          <nav aria-label="Recent stories" className="sr-only">
            <ul>
              {stories.slice(0, 50).map((story) => (
                <li key={story.slug}>
                  <a href={`/${locale}/stories/${story.slug}`}>{story.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Section>
      {/* 서비스 바로가기 — prefetch={false}: 본문 fold 내 button pill들의
          무거운 SSG JSON 자동 prefetch 방지. hover/focus 시 prefetch는 유지. */}
      <Section tone="warm" className="py-10">
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={`/${locale}/wedding-song`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink/[0.04] transition-colors duration-200 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
          >
            {t('nav.weddingSong')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/voice-acting`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink/[0.04] transition-colors duration-200 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
          >
            {t('nav.voiceActing')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/lesson`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink/[0.04] transition-colors duration-200 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
          >
            {t('nav.lesson')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href={`/${locale}/practice-room`}
            prefetch={false}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-pill border border-hairline-strong text-ink font-semibold hover:bg-ink/[0.04] transition-colors duration-200 dark:text-on-dark dark:border-white/20 dark:hover:bg-white/[0.06]"
          >
            {t('nav.practiceRoom')} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </Section>

      <Section tone="deep" className="py-16">
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
  // 일반 시·군 지역 페이지는 noindex 처리되어 listing에서도 숨김 (광역 허브 16개만 노출).
  const fullStories = getAllStories(locale).filter(isListableStory);

  // 목록 페이지에 필요한 필드만 추출.
  // - summary: 상위 50개만 포함(스키마 + 첫 페이지 카드용). 나머지는 생략하여 payload 대폭 축소.
  //   JSON 전체 크기가 ~540KB → ~250KB 예상. Hydration TBT 대폭 감소.
  // - category 라벨은 제거 (StoryCard가 i18n labels.categoryByKey를 우선 사용).
  const stories: StoryListItem[] = fullStories.map((s, idx) => ({
    slug: s.slug,
    title: s.title,
    date: s.date,
    categoryKey: s.categoryKey,
    thumbnail: s.thumbnail,
    ...(idx < 50 && s.summary ? { summary: s.summary } : {}),
  }));

  return buildPageStaticProps(
    locale,
    {
      stories,
    },
    { revalidate: 1800, i18nSections: ['stories', 'pricing'] }
  );
};

export default StoriesPage;
