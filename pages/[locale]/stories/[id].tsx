import React from 'react';
import type { GetStaticProps, GetStaticPaths } from 'next';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { m } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '../../../components/SEO';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import StoryCard from '../../../components/StoryCard';
import ImageHero from '../../../components/common/ImageHero';
import type { CTAType } from '../../../components/StoryCTA';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

// StoryCTA는 article 본문 아래 below-fold 영역 → 코드 스플리팅.
const StoryCTA = dynamic(() => import('../../../components/StoryCTA'));
import { shareContent } from '../../../utils/shareUtils';
import { stripMarkdown } from '../../../utils/textUtils';
import { timeAgo } from '../../../utils/dateUtils';
import { getRelatedStories, getStoryDetail, getStoryPaths } from '../../../lib/stories';
import { STORY_CATEGORY_KEYS } from '../../../lib/storyCategories';
import type { Story, StoryDetail } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import { buildPageStaticProps, resolveLocaleParam } from '../../../lib/getStatic';
import { type Locale } from '../../../lib/i18n';
import { getSiteConfig } from '../../../data/siteConfig';
import { generateFaqSchema, generatePracticeRoomMonthlyRentSchema } from '../../../utils/schemaGenerator';

import { createEnterAnimation } from '../../../utils/animationUtils';
import type { NextPageWithLayout } from '../../../types';

// 관련 스토리 카드에 필요한 필드만. author/tags/images/createdAt/thumbnailDerived/content 제외.
type RelatedStoryItem = Pick<Story, 'slug' | 'title' | 'date' | 'categoryKey' | 'thumbnail' | 'summary'>;

interface StoryDetailPageProps {
  locale: Locale;
  story: StoryDetail;
  relatedStories: RelatedStoryItem[];
}

const STORY_BODY_ANIMATION = createEnterAnimation();

const StoryDetailPage: NextPageWithLayout<StoryDetailPageProps> = ({ locale, story, relatedStories }) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = getSiteConfig(locale);

  // 글 주제 → CTA 매칭. slug 키워드 우선·categoryKey 폴백 모두 deterministic.
  // 기존 hash seed 균등 25% 분포가 주제 무관 CTA를 양산하던 문제(예: 작곡 글에
  // recording CTA, 보컬 트레이닝 글에 production CTA)를 해소한다. 'equipment'는
  // 정의된 categoryKey가 아니라 dead branch였다.
  const getCTAType = (slug: string, categoryKey: string | undefined): CTAType => {
    if (slug.startsWith('practice-room-')) return 'practice';

    // slug 키워드 — 글의 실제 의도를 가장 잘 드러내는 신호. categoryKey보다 우선.
    // 작곡·편곡·코드·MIDI·비트메이킹은 24시간 작업 환경(음악연습실 월세) 페어링.
    // melody(?!ne): Melodyne(피치 보정 플러그인) 같은 mixing 도구는 제외.
    // harmony는 단독으론 매치 안 함 — jazz-harmony는 production 카테고리 폴백으로,
    // harmony1(녹음 가이드)·harmony-singing(보컬)은 각각 다른 의도라 폴백/lesson 매칭이 정확.
    if (/(^|[-_])(compos|songwrit|arrang|chord|midi|beatmak|producer|creative-?block|melody(?!ne)|topline)/i.test(slug)) {
      return 'practice';
    }
    // 레슨·트레이닝·기초·발성 → 1:1 음악 레슨.
    // 발성 키워드(belting/falsetto/vibrato/head-voice/chest-voice/mix-voice/mixed-voice/vocal-range)는
    // 보컬 카테고리 폴백(recording) 보다 lesson 매칭이 의도에 더 부합. lesson이 production보다
    // 앞에 있어야 'mix-voice' 같은 slug가 mixing CTA로 잘못 가지 않는다.
    if (/(^|[-_])(lesson|tutor|train(ing)?|beginner|breath|warmup|articulation|posture|pitch-?train|ear-?train|sight-?read|belting|falsetto|vibrato|head-?voice|chest-?voice|mix-?voice|mixed-?voice|vocal-?range|harmony-?sing)/i.test(slug)) {
      return 'lesson';
    }
    // 믹싱·마스터링·이펙트·EQ·컴프 → 외주 의뢰(production CTA → /contact).
    // amp-sim은 녹음 가이드(amp-simulator1)에 위치하므로 recording 폴백이 더 정확 → 제외.
    if (/(^|[-_])(mix|master(ing)?|eq[-_]|compress|reverb|delay|chorus-effect|de-?esser|sidechain|loudness|limiter|stereo-?imag|automation|bus-?comp|808-bass|ai-master|auto-?tune|autotune|clipper)/i.test(slug)) {
      return 'production';
    }
    // 녹음·마이크·트래킹·데모 → 녹음 의뢰.
    if (/(^|[-_])(record(ing)?|mic[-_]|demo-?tape|tracking|punch-?in|comping|studio-?record|takes)/i.test(slug)) {
      return 'recording';
    }

    // categoryKey 폴백. 작곡·악기연습·지역 글은 음악연습실 월세가 핵심 페어링.
    switch (categoryKey) {
      case 'instrument':
      case 'region':
      case 'production':
        return 'practice';
      case 'lesson':
        return 'lesson';
      case 'mixing':
      case 'business':
        return 'production';
      case 'recording':
      case 'vocal':
      case 'feedback':
      case 'event':
      default:
        return 'recording';
    }
  };

  const ctaType = React.useMemo(
    () => getCTAType(story.slug, story.categoryKey),
    [story.categoryKey, story.slug]
  );

  const router = useRouter();
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

  const faqSchema = React.useMemo(() => {
    if (!story.faq || story.faq.length === 0) return null;
    return generateFaqSchema(
      story.faq.map((item) => ({ question: item.q, answer: item.a })),
      locale
    );
  }, [story.faq, locale]);

  // practice-room-* 스토리는 월세 36만원을 본문·FAQ에 일관되게 명시하므로
  // Service+Offer 구조화 데이터로 가격을 노출해 SERP·AI 답변에서 직접 인용되도록 함.
  const practiceRoomOfferSchema = React.useMemo(() => {
    if (!story.slug.startsWith('practice-room-')) return null;
    if (locale !== 'ko') return null;
    const pageUrl = `${siteConfig.url}/${locale}/stories/${story.slug}`;
    return generatePracticeRoomMonthlyRentSchema(pageUrl, locale);
  }, [story.slug, locale, siteConfig.url]);

  const extraSchemas = React.useMemo(() => {
    const items: Record<string, unknown>[] = [];
    if (faqSchema) items.push(faqSchema as Record<string, unknown>);
    if (practiceRoomOfferSchema) items.push(practiceRoomOfferSchema as Record<string, unknown>);
    return items.length > 0 ? items : undefined;
  }, [faqSchema, practiceRoomOfferSchema]);

  const wordCount = React.useMemo(() => {
    if (!story.content) return undefined;
    const plainText = stripMarkdown(story.content);
    // CJK·Thai 등 어절 단위 공백이 없는 언어는 split(/\s+/) 결과가 어절 수에
    // 가까워 영어 대비 systematically 과소 보고된다. 비공백 글자 수로 환산해
    // Schema.org wordCount의 실질 정보량을 영문 텍스트와 같은 자릿수로 맞춘다.
    if (locale === 'ko' || locale === 'zh' || locale === 'th') {
      return plainText.replace(/\s+/g, '').length;
    }
    return plainText.split(/\s+/).filter(Boolean).length;
  }, [story.content, locale]);

  if (router.isFallback) {
    return <LoadingSpinner locale={locale} />;
  }

  const getLink = (path: string) => `/${locale}${path}`;
  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);

  const dynamicOgImage = `/api/og/story?title=${encodeURIComponent(story.title)}&category=${encodeURIComponent(story.category || '')}&date=${encodeURIComponent(story.date || '')}&locale=${locale}`;
  const ogImage = story.thumbnail || dynamicOgImage;
  // 동적 OG는 1200x630 보장. thumbnail은 실제 크기를 알 수 없으므로 메타에 크기 명시 안 함.
  const isDynamicOg = !story.thumbnail;

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
        canonical={story.isFallbackTranslation ? undefined : `/${locale}/stories/${story.slug}`}
        disableCanonicalAndAlternates={story.isFallbackTranslation}
        availableLocales={story.availableLocales}
        ogImage={ogImage}
        ogImageAlt={story.thumbnail ? story.title : `${story.title} - ${siteConfig.name}`}
        ogImageWidth={isDynamicOg ? 1200 : undefined}
        ogImageHeight={isDynamicOg ? 630 : undefined}
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
        webPageType="Article"
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

        <article itemScope itemType="https://schema.org/BlogPosting">
          <meta itemProp="headline" content={story.title} />
          {story.date && <meta itemProp="datePublished" content={story.date} />}
          <m.div
            itemProp="articleBody"
            {...STORY_BODY_ANIMATION}
            className="mb-12"
          >
            <MarkdownRenderer content={story.content} locale={locale} currentSlug={story.slug} />
          </m.div>
        </article>

        {story.boilerplateSection && (
          <aside
            data-boilerplate="region-visit"
            aria-label={t('stories.detail.boilerplateAside', { defaultValue: '공통 방문 안내' })}
            className="mb-12 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <MarkdownRenderer content={story.boilerplateSection} locale={locale} currentSlug={story.slug} />
          </aside>
        )}

        <StoryCTA type={ctaType} locale={locale} />

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
    const story = await getStoryDetail(params!.id as string, locale);
    const fullRelated = getRelatedStories(locale, params!.id as string, 6);

    // 관련 스토리 경량화 — StoryCard 렌더에 필요한 필드만 전달.
    const relatedStories: RelatedStoryItem[] = fullRelated.map((s) => ({
      slug: s.slug,
      title: s.title,
      date: s.date,
      categoryKey: s.categoryKey,
      thumbnail: s.thumbnail,
      summary: s.summary,
    }));

    return buildPageStaticProps(
      locale,
      {
        story,
        relatedStories,
      },
      { revalidate: 3600, i18nSections: ['stories'] }
    );
  } catch (error) {
    console.error('Story detail error:', error);
    return {
      notFound: true,
      revalidate: 60,
    };
  }
};

export default StoryDetailPage;
