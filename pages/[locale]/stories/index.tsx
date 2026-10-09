import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import ServiceLinkPill from '../../../components/ui/ServiceLinkPill';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import StoryCard from '../../../components/StoryCard';
import CategoryFilter from '../../../components/CategoryFilter';
import SEO from '../../../components/SEO';
import ImageHero from '../../../components/common/ImageHero';
import { getAllStories, isBrowsableStoryForLocale } from '../../../lib/stories';
import { STORY_CATEGORY_KEYS } from '../../../lib/storyCategories';
import type { Story } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import Pagination from '../../../components/ui/Pagination';

// Below-fold CTA는 코드 스플리팅. 페이지 하단 노출 전까진 JS 로드 지연.
const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));
import { buildPageStaticProps, getCommonStaticPaths, resolveLocaleParam } from '../../../lib/getStatic';
import type { Locale } from '../../../lib/i18n';
import { generateItemListSchema } from '../../../utils/schema';
import { getSiteConfig } from '../../../data/siteConfig';
import { normalizePageNumber } from '../../../utils/pagination';
import { getScrollBehavior } from '../../../utils/scrollUtils';

import type { NextPageWithLayout } from '../../../types';
import { EmptyState } from '../../../components/ui/EmptyState';

// 목록 페이지에 필요한 최소 필드만 포함하는 경량 Story 타입.
// category(라벨)는 제거 — i18n 번역(stories.categories[key])으로 대체.
// summary는 선택적 — 상위 50개(스키마 + 첫 페이지 카드)만 포함, 나머지는 payload 축소 위해 생략.
type StoryListItem = Pick<Story, 'slug' | 'title' | 'date' | 'categoryKey' | 'thumbnail'> & {
  summary?: string;
};

type StoryListPage = { stories: StoryListItem[]; totalItems: number; totalPages: number };

/**
 * 받아 온 목록 페이지를 (로케일·카테고리·페이지)로 기억한다. 글을 열었다 뒤로 오면 목록이 다시
 * 마운트되는데, 예전엔 1페이지(정적 데이터)를 먼저 그린 뒤 현재 페이지를 다시 받아 와서 카드가
 * 한 번 바뀌어 보였다 — 뒤로 가기 스크롤 복원도 그 사이의 다른 카드 위에 떨어졌다(2026-09-28
 * 프레임 기록). 여기 있으면 첫 렌더부터 그 목록을 그리고 다시 받지 않는다. 탭 안에서만 산다.
 */
const listPageCache = new Map<string, StoryListPage>();
const listPageKey = (locale: string, category: string, page: number) => `${locale}|${category}|${page}`;

interface StoriesPageProps {
  locale: Locale;
  initialStories: StoryListItem[];
  recentStories: Pick<StoryListItem, 'slug' | 'title'>[];
  categoryKeys: string[];
  totalStories: number;
  totalPages: number;
}

const StoriesPage: NextPageWithLayout<StoriesPageProps> = ({
  locale,
  initialStories,
  recentStories,
  categoryKeys,
  totalStories,
  totalPages: initialTotalPages,
}) => {
  const router = useRouter();
  // 카테고리는 URL(?category=)에 싣는다. 컴포넌트 상태에만 두면 글을 열었다 뒤로 올 때 필터가
  // 풀려 전체 목록으로 돌아온다. 모르는 값은 전체.
  const queryCategory = Array.isArray(router.query.category) ? router.query.category[0] : router.query.category;
  const activeCategory = queryCategory && categoryKeys.includes(queryCategory) ? queryCategory : 'all';
  const [pageAnnouncement, setPageAnnouncement] = useState('');
  listPageCache.set(listPageKey(locale, 'all', 1), { stories: initialStories, totalItems: totalStories, totalPages: initialTotalPages });
  const [initialPage] = useState(
    () => listPageCache.get(listPageKey(locale, activeCategory, normalizePageNumber(router.query.page, Number.MAX_SAFE_INTEGER))),
  );
  const [stories, setStories] = useState<StoryListItem[]>(initialPage?.stories ?? initialStories);
  const [totalItems, setTotalItems] = useState(initialPage?.totalItems ?? totalStories);
  const [totalPages, setTotalPages] = useState(initialPage?.totalPages ?? initialTotalPages);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const ITEMS_PER_PAGE = 12;
  const { t } = useTranslation('common', { lng: locale });
  const siteUrl = React.useMemo(() => getSiteConfig(locale).url, [locale]);

  const sectionRef = useRef<HTMLDivElement>(null);
  // 카테고리/페이지 빠른 전환 시 구 요청의 finally가 최신 요청의 로딩 상태를
  // 끄는 경합을 막기 위한 요청 식별자 (effect 실행마다 증가).
  const requestIdRef = useRef(0);

  const categories = useMemo(() => {
    return categoryKeys.map(key => ({
      id: key,
      label: t(`stories.categories.${key}`)
    }));
  }, [categoryKeys, t]);

  const currentPage = normalizePageNumber(router.query.page, totalPages);

  const storiesItemListSchema = React.useMemo(() => generateItemListSchema(
    stories.map((story) => ({
      id: story.slug,
      name: story.title,
      url: `${siteUrl}/${locale}/stories/${story.slug}`,
      image: story.thumbnail ?? undefined,
      description: story.summary,
    })),
    siteUrl,
    locale,
    t('nav.stories')
  ), [stories, locale, siteUrl, t]);

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
    setPageAnnouncement('');
    const query: Record<string, string> = { locale: router.query.locale as string };
    if (categoryId !== 'all') query.category = categoryId;
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
  };

  useEffect(() => {
    if (!router.isReady) return;

    const cacheKey = listPageKey(locale, activeCategory, currentPage);
    const cached = listPageCache.get(cacheKey);
    if (cached) {
      requestIdRef.current += 1; // 진행 중이던 요청의 로딩 해제·결과 반영을 무효로
      setStories(cached.stories);
      setTotalItems(cached.totalItems);
      setTotalPages(cached.totalPages);
      setIsLoadingStories(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const loadStories = async () => {
      setIsLoadingStories(true);
      try {
        const params = new URLSearchParams({
          locale,
          category: activeCategory,
          page: String(currentPage),
          pageSize: String(ITEMS_PER_PAGE),
        });
        const response = await fetch(`/api/stories/catalog?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Story catalog request failed: ${response.status}`);
        const data = await response.json() as {
          stories: StoryListItem[];
          totalItems: number;
          totalPages: number;
          page: number;
        };
        listPageCache.set(cacheKey, { stories: data.stories, totalItems: data.totalItems, totalPages: data.totalPages });
        if (requestId !== requestIdRef.current) return;
        setStories(data.stories);
        setTotalItems(data.totalItems);
        setTotalPages(data.totalPages);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        // 자신이 최신 요청일 때만 로딩 해제. 구 요청(abort됨)의 finally가 이미
        // 시작된 최신 요청의 로딩 상태를 잘못 끄지 않도록 방지한다.
        if (requestId === requestIdRef.current) {
          setIsLoadingStories(false);
        }
      }
    };

    void loadStories();
    return () => controller.abort();
  }, [activeCategory, currentPage, locale, router.isReady]);

  const handlePageChange = (page: number) => {
    const query: Record<string, string | number> = { locale: router.query.locale as string };
    if (activeCategory !== 'all') query.category = activeCategory;
    if (page > 1) query.page = page;
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
    setPageAnnouncement(`${t('nav.stories')} — ${page} / ${totalPages}`);
    if (sectionRef.current) {
      const yOffset = -100;
      const y = sectionRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: getScrollBehavior() });
    }
  };

  // Query 기반 페이지네이션은 SSG 원본 HTML에서 항상 1페이지로 렌더된다.
  // 따라서 ?page=2+는 noindex 대신 대표 목록 canonical로 통합하고, 클라이언트 렌더 후
  // 현재 화면과 어긋날 수 있는 ItemList만 제거한다.
  const canonicalUrl = `/${locale}/stories`;

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
        ogImage="/images/og-studio1.webp"
        ogImageAlt={t('stories.hero.alt')}
        ogImageWidth={1200}
        ogImageHeight={630}
        includeSchema
        includeBusinessReviews={false}
        webPageType="CollectionPage"
        schema={currentPage === 1 ? storiesItemListSchema : undefined}
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
      <ImageHero
        locale={locale}
        priority
        title={t('stories.hero.title')}
        subtitle={t('stories.hero.subtitle')}
        backgroundImage="/images/studio1.webp"
        imageAlt={t('stories.hero.alt')}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/40 via-transparent to-black/20"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
        ]}
      />
      <Section variant="default">
        <p aria-live="polite" aria-atomic="true" className="sr-only">{pageAnnouncement}</p>
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {isLoadingStories ? t('common.loading', { defaultValue: 'Loading' }) : `${totalItems} ${t('nav.stories')}`}
        </p>
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

          {stories.length === 0 ? (
            <EmptyState
              className="my-8"
              titleAs="h2"
              title={t('stories.empty.title')}
              description={
                activeCategory === 'all'
                  ? t('stories.empty.all')
                  : t('stories.empty.byCategory', { category: t(`stories.categories.${activeCategory}`) })
              }
            />
          ) : (
            <>
              <h2 className="sr-only">
                {activeCategory === 'all'
                  ? t('nav.stories')
                  : t(`stories.categories.${activeCategory}`)}
              </h2>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 transition-opacity duration-200 ${isLoadingStories ? 'opacity-60' : 'opacity-100'}`}>
                {stories.map((story) => (
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
              {recentStories.map((story) => (
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
          <ServiceLinkPill href={`/${locale}/practice-room`} tone="primary">
            {t('nav.practiceRoom')}
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
          secondaryHref="/contact"
          headingAs="h3"
        />
      </Section>
    </>
  );
};

StoriesPage.hasHero = true;
StoriesPage.designEdition = 'v2';

export const getStaticPaths: GetStaticPaths = getCommonStaticPaths;

export const getStaticProps: GetStaticProps<StoriesPageProps> = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  // noindex/thin/fallback 및 일반 시·군 지역 페이지는 listing에서도 숨김.
  const fullStories = getAllStories(locale).filter((story) =>
    isBrowsableStoryForLocale(story, locale)
  );
  const categoryKeys = STORY_CATEGORY_KEYS.filter((key) =>
    fullStories.some((story) => story.categoryKey === key)
  );

  const toStoryListItem = (s: Story): StoryListItem => ({
    slug: s.slug,
    title: s.title,
    date: s.date,
    categoryKey: s.categoryKey,
    thumbnail: s.thumbnail,
    ...(s.summary ? { summary: s.summary } : {}),
  });
  const initialStories = fullStories.slice(0, 12).map(toStoryListItem);
  const recentStories = fullStories.slice(0, 50).map((s) => ({
    slug: s.slug,
    title: s.title,
  }));

  return buildPageStaticProps(
    locale,
    {
      initialStories,
      recentStories,
      categoryKeys,
      totalStories: fullStories.length,
      totalPages: Math.max(1, Math.ceil(fullStories.length / 12)),
    },
    { revalidate: 1800, i18nSections: ['stories', 'pricing'] }
  );
};

export default StoriesPage;
