import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2, Sparkles } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import TableOfContents from '../../../components/markdown/TableOfContents';
import StoryCard from '../../../components/StoryCard';
import ImageHero from '../../../components/common/ImageHero';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

// StoryCTA / ContactCTA는 article 본문 아래 below-fold 영역 → 코드 스플리팅.
const StoryCTA = dynamic(() => import('../../../components/StoryCTA'));
const ContactCTA = dynamic(() => import('../../../components/common/ContactCTA'));
const RelatedPortfolioInline = dynamic(() => import('../../../components/ui/RelatedPortfolioInline'));
const StickyBottomCTA = dynamic(() => import('../../../components/inline/StickyBottomCTA'), { ssr: false });
// faq 프론트매터는 이미 FAQPage JSON-LD로 발행 중(buildStoryExtraSchemas). 그 구조화
// 데이터에 대응하는 가시 콘텐츠가 페이지에 없어 Google 정책상 리치결과가 무시될 수
// 있었다 → 본문 하단에 FAQSection을 렌더해 스키마-가시콘텐츠 일치를 확보.
const FAQSection = dynamic(() => import('../../../components/ui/FAQSection'));
import { shareContent } from '../../../utils/shareUtils';
import { timeAgo } from '../../../utils/dateUtils';
import { getRelatedStories, getStoryDetail, getStoryPaths } from '../../../lib/stories';
import { getStoryRelatedPortfolio } from '../../../lib/storyRelatedPortfolio';
import { STORY_CATEGORY_KEYS } from '../../../lib/storyCategories';
import { resolveStoryCTAType } from '../../../lib/storyCtaPolicy';
import {
  buildStoryDynamicOgImage,
  buildStoryExtraSchemas,
  buildStoryMetaDescription,
  getStoryWordCount,
} from '../../../lib/storySeoData';
import type { Story, StoryDetail } from '../../../types/story';
import type { PortfolioItem } from '../../../types/data';
import { Section } from '../../../components/ui/Section';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';

import { createEnterAnimation } from '../../../utils/animationUtils';
import type { NextPageWithLayout } from '../../../types';

// 관련 스토리 카드에 필요한 필드만. author/tags/images/createdAt/thumbnailDerived/content 제외.
type RelatedStoryItem = Pick<Story, 'slug' | 'title' | 'date' | 'categoryKey' | 'thumbnail' | 'summary'>;

interface StoryDetailPageProps {
  locale: Locale;
  story: StoryDetail;
  relatedStories: RelatedStoryItem[];
  relatedPortfolio: PortfolioItem[];
}

const STORY_BODY_ANIMATION = createEnterAnimation();

const StoryDetailPage: NextPageWithLayout<StoryDetailPageProps> = ({ locale, story, relatedStories, relatedPortfolio }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);

  const ctaType = React.useMemo(
    () => resolveStoryCTAType({
      slug: story.slug,
      categoryKey: story.categoryKey,
      override: story.cta,
    }),
    [story.cta, story.categoryKey, story.slug]
  );

  const router = useRouter();
  const stickyMarkerRef = React.useRef<HTMLDivElement>(null);
  const storyCardLabels = React.useMemo(
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

  const extraSchemas = React.useMemo(
    () => buildStoryExtraSchemas({ story, locale, siteUrl: siteConfig.url }),
    [story, locale, siteConfig.url]
  );

  const wordCount = React.useMemo(
    () => getStoryWordCount(story.content, locale),
    [story.content, locale]
  );

  // FAQPage JSON-LD와 동일한 소스(story.faq)를 FAQSection 가시 렌더에 재사용.
  // shape 변환은 스키마 생성부(buildStoryExtraSchemas)와 동일하게 {q,a}→{question,answer}.
  const faqItems = React.useMemo(
    () => (story.faq ?? []).map((item) => ({ question: item.q, answer: item.a })),
    [story.faq]
  );

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const getLink = (path: string) => `/${locale}${path}`;
  const metaDescription = buildStoryMetaDescription(story.content);

  // 카카오톡 등 소셜 스크레이퍼는 WebP og:image를 지원하지 않으므로
  // story.thumbnail(WebP)과 무관하게 항상 PNG를 반환하는 동적 OG 엔드포인트를 사용.
  const ogImage = buildStoryDynamicOgImage({
    title: story.title,
    category: story.category,
    date: story.date,
    locale,
  });

  const shareStory = async () => {
    const shareUrl = `${siteConfig.url}/${locale}/stories/${story.slug}`;
    await shareContent({
      title: story.title,
      text: metaDescription,
      url: shareUrl,
      messages: {
        copied: t('actions.shareCopied'),
        unsupported: t('actions.shareUnsupported'),
      },
    });
  };

  return (
    <>
      <SEO
        locale={locale}
        title={`${story.title} | ${siteConfig.name}`}
        description={story.summary || metaDescription}
        keywords={story.tags ? story.tags.join(', ') : t('stories.seo.fallbackKeywords')}
        canonical={story.isFallbackTranslation
          ? `/${story.sourceLocale}/stories/${story.slug}`
          : `/${locale}/stories/${story.slug}`}
        disableUrlMetaAndAlternates={story.isFallbackTranslation}
        availableLocales={story.availableLocales}
        // ko 원본 없는 native-only 스토리는 native locale에서 색인 가능(site-wide 비-ko
        // noindex 정책의 예외 — 사이트맵 등재와 대칭). 번역본(ko 원본 존재)이나 fallback
        // 렌더에는 켜지지 않는다. thin/frontmatter noindex는 아래 robots prop이 그대로
        // 통과 적용되므로 "사이트맵 등재 ⇔ 색인 가능" 불변식이 유지된다.
        allowNonDefaultLocaleIndexing={Boolean(story.isNativeOnly) && !story.isFallbackTranslation}
        ogImage={ogImage}
        ogImageAlt={story.thumbnail ? story.title : `${story.title} - ${siteConfig.name}`}
        ogImageWidth={1200}
        ogImageHeight={630}
        ogType="article"
        author={story.author || undefined}
        robots={story.robots || ((story.isFallbackTranslation || story.isThinContent) ? 'noindex, follow' : undefined)}
        articlePublishedTime={story.date}
        articleModifiedTime={story.modifiedDate}
        articleAuthor={story.author}
        articleSchemaType="BlogPosting"
        articleSection={story.category}
        articleTags={story.tags ?? undefined}
        articleWordCount={wordCount}
        includeSchema
        schema={extraSchemas}
        breadcrumbs={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
        webPageType="WebPage"
      />

      <ImageHero
        locale={locale}
        priority
        title={story.title}
        subtitle={
          <div className="flex flex-wrap items-center justify-center gap-4 text-lg mt-4 opacity-90">
            <div className="flex items-center">
              <Tag className="mr-2" size={18} aria-hidden="true" />
              <span>{story.category}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center">
              <Calendar className="mr-2" size={18} aria-hidden="true" />
              <time dateTime={story.date}>{story.createdAt ? timeAgo(story.createdAt, locale) : story.date}</time>
            </div>
          </div>
        }
        backgroundImage={story.thumbnail || '/images/studio1.webp'}
        imageAlt={story.title}
        minHeight="min-h-[60vh]"
        overlayGradient="from-black/70 via-black/40 to-black/70"
        breadcrumbItems={[
          { name: t('nav.home'), path: `/${locale}` },
          { name: t('nav.stories'), path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
      />

      <Section variant="default" className="pt-12 pb-12">
        <div className="mb-12 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-6">
          <Link
            href={getLink("/stories")}
            className="inline-flex items-center typo-card-cta hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.backToList')}
          </Link>

          <button
            type="button"
            onClick={shareStory}
            className="inline-flex items-center typo-card-cta hover:underline text-gray-600 dark:text-gray-400 min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
          >
            <Share2 className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.share')}
          </button>
        </div>

        <div
          ref={stickyMarkerRef}
          aria-hidden="true"
          data-sticky-trigger
          className="h-px"
        />
        <article itemScope itemType="https://schema.org/BlogPosting">
          <meta itemProp="headline" content={story.title} />
          {story.date && <meta itemProp="datePublished" content={story.date} />}
          {story.summary && (
            // 핵심 요약 리드 — meta에만 쓰이던 summary를 본문 상단에 가시 렌더.
            // AI 검색엔진(ChatGPT·Perplexity 등)이 인용하기 좋은 자기완결 요약 + 독자 UX.
            <div className="mb-8 rounded-lg border-l-4 border-primary bg-primary/5 p-5 dark:bg-primary/10">
              <p className="text-sm font-semibold text-primary mb-1.5">
                {t('stories.detail.summaryLabel', { defaultValue: '핵심 요약' })}
              </p>
              <p itemProp="description" className="typo-card-body leading-relaxed text-gray-700 dark:text-gray-200">
                {story.summary}
              </p>
            </div>
          )}
          <TableOfContents
            content={story.content}
            title={t('stories.detail.tocTitle', { defaultValue: '목차' })}
          />
          <m.div
            itemProp="articleBody"
            {...STORY_BODY_ANIMATION}
            className="mb-12"
          >
            <MarkdownRenderer content={story.content} locale={locale} currentSlug={story.slug} />
          </m.div>
        </article>

        {/* FAQPage 구조화 데이터(buildStoryExtraSchemas)와 대응하는 가시 FAQ.
            "본문 정독 → 궁금증 해소 → 상담 CTA" 순서로 CTA 앞에 배치. */}
        {faqItems.length > 0 && (
          <FAQSection
            items={faqItems}
            title={t('stories.detail.faqTitle', { defaultValue: '자주 묻는 질문' })}
            subtitle={t('stories.detail.faqSubtitle', { defaultValue: '이 주제에 대해 자주 묻는 질문을 모았습니다.' })}
            variant="default"
          />
        )}

        {/* Phase 2 — IntersectionObserver 기반 sticky bar. ssr: false라 서버 렌더 안 됨 */}
        <StickyBottomCTA markerRef={stickyMarkerRef} locale={locale} />

        {story.boilerplateSection && (
          // data-nosnippet은 Google 공식 indicator — 이 영역의 텍스트를 SERP snippet에
          // 사용하지 말라는 신호. AUTO-EXPAND 보일러플레이트가 도시명만 치환된 동일
          // 텍스트로 356+개 페이지에 박혀 있어 doorway/duplicate snippet 평가 위험이
          // 있던 것을 차단. 사용자에겐 그대로 노출 — UX 가치는 유지.
          <aside
            data-boilerplate="region-visit"
            data-nosnippet
            aria-label={t('stories.detail.boilerplateAside', { defaultValue: '공통 방문 안내' })}
            className="mb-12 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <MarkdownRenderer content={story.boilerplateSection} locale={locale} currentSlug={story.slug} />
          </aside>
        )}

        {/* 가이드를 다 읽은 사용자에게 "이 가이드대로 작업한 실제 결과물"을 노출.
            recording/mixing/production/vocal/instrument 카테고리에서만 채워진다 — 그 외
            카테고리는 getStoryRelatedPortfolio가 빈 배열을 반환해 섹션 자체가 숨김. */}
        {relatedPortfolio.length > 0 && (
          <RelatedPortfolioInline items={relatedPortfolio} locale={locale} />
        )}

        {/* event 카테고리(공지·모임 안내)는 행동 유도 맥락이 약해 CTA 노출 부자연 → 숨김.
            ko·en: 카카오 직링크 + lead_click_kakao 추적이 완비된 ContactCTA 사용.
            그 외 로케일: 기존 StoryCTA 유지(외국어 사용자 동선 보존). */}
        {story.categoryKey !== 'event' && (
          ['ko', 'en'].includes(locale) ? (
            <div className="my-16">
              <ContactCTA
                locale={locale}
                title={t('stories.bottomCta.title', { defaultValue: '지금 카톡으로 바로 상담하세요' })}
                subtitle={t('stories.bottomCta.subtitle', {
                  defaultValue: '이 글에서 본 작업도 동일하게 진행 가능합니다. 일정·견적 1분 안에 안내드려요.',
                })}
                imageSrc="/images/studio2.webp"
                imageAlt={t('stories.bottomCta.imageAlt', { defaultValue: '스튜디오 놀 작업 공간' })}
                primaryButtonLabel={t('actions.kakao')}
                secondaryButtonLabel={t('actions.location')}
                icon={Sparkles}
                headingAs="h3"
              />
            </div>
          ) : (
            <StoryCTA type={ctaType} locale={locale} />
          )
        )}

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">{t('stories.detail.moreTitle')}</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {relatedStories.map((related) => (
                <StoryCard
                  key={related.slug}
                  story={related}
                  locale={locale}
                  labels={storyCardLabels}
                />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">{t('stories.detail.noRelated')}</p>
          )}
          <Link href={getLink("/stories")} className="inline-flex items-center typo-card-cta hover:underline min-h-[44px] touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900">
            <ArrowLeft className="mr-2" size={16} aria-hidden="true" />
            {t('stories.detail.viewAll')}
          </Link>
        </div>
      </Section>
    </>
  );
};

StoryDetailPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: getStoryPaths(),
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = resolveLocaleParam(params?.locale);
  try {
    const story = await getStoryDetail(params?.id as string, locale);
    const fullRelated = getRelatedStories(locale, params?.id as string, 6);

    // 관련 스토리 경량화 — StoryCard 렌더에 필요한 필드만 전달.
    const relatedStories: RelatedStoryItem[] = fullRelated.map((s) => ({
      slug: s.slug,
      title: s.title,
      date: s.date,
      categoryKey: s.categoryKey,
      thumbnail: s.thumbnail,
      summary: s.summary,
    }));

    // recording/mixing/production/vocal/instrument 스토리만 portfolio 매칭이 채워지고,
    // 그 외 카테고리는 빈 배열 반환 → 페이지에서 섹션 자체가 렌더되지 않는다.
    const relatedPortfolio = getStoryRelatedPortfolio(story.categoryKey, story.slug, locale, 3);

    return buildPageStaticProps(
      locale,
      {
        story,
        relatedStories,
        relatedPortfolio,
      },
      { revalidate: 3600, i18nSections: ['stories'] }
    );
  } catch (error) {
    console.error('Story detail error:', error);
    return {
      notFound: true,
      revalidate: 3600,
    };
  }
};

export default StoryDetailPage;
