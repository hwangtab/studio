import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2 } from 'lucide-react';
import SEO from '../../../components/SEO';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import StoryCard from '../../../components/StoryCard';
import ImageHero from '../../../components/common/ImageHero';
import ResponsiveImage from '../../../components/ResponsiveImage';
import StoryCTA, { CTAType } from '../../../components/StoryCTA';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { shareContent } from '../../../utils/shareUtils';
import { stripMarkdown } from '../../../utils/textUtils';
import { timeAgo } from '../../../utils/dateUtils';
import { getAllStories, getStoryDetail, getStoryPaths } from '../../../lib/stories';
import type { Story, StoryDetail } from '../../../types/story';
import { Section } from '../../../components/ui/Section';
import type { Locale } from '../../../lib/i18n';

interface StoryDetailPageProps {
  locale: Locale;
  story: StoryDetail;
  relatedStories: Story[];
}

const StoryDetailPage: NextPage<StoryDetailPageProps> = ({ locale, story, relatedStories }) => {
  const getCTAType = (slug: string, category: string | undefined): CTAType => {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
      hash = (hash << 5) - hash + slug.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash % 100) / 100;

    if (category?.includes('강좌')) {
      if (seed < 0.4) return 'lesson';
      if (seed < 0.7) return 'practice';
      if (seed < 0.9) return 'recording';
      return 'production';
    }

    if (category === '장비' || category === '리뷰') {
      if (seed < 0.6) return 'practice';
      if (seed < 0.8) return 'recording';
      return 'lesson';
    }

    const types: CTAType[] = ['recording', 'lesson', 'practice', 'production'];
    return types[Math.floor(seed * types.length)];
  };

  const [ctaType, setCtaType] = React.useState<CTAType>('recording');

  React.useEffect(() => {
    if (story?.category) {
      setCtaType(getCTAType(story.slug, story.category));
    }
  }, [story?.category, story?.slug]);

  const router = useRouter();

  if (router.isFallback) {
    return <LoadingSpinner />;
  }

  const isKo = locale === 'ko';
  const getLink = (path: string) => `/${locale}${path}`;
  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);
  const shareUrl = `https://studionol.co.kr/${locale}/stories/${story.slug}`;

  const shareStory = async () => {
    await shareContent({
      title: story.title,
      text: metaDescription,
      url: shareUrl,
    });
  };

  return (
    <>
      <SEO
        title={`${story.title} - Studio NOL`}
        description={story.summary || metaDescription}
        keywords={story.tags ? story.tags.join(', ') : '스튜디오 놀, 음악, 스토리'}
        canonical={shareUrl}
        ogImage={story.thumbnail || '/images/hardware2.jpg'}
        ogType="article"
        articlePublishedTime={story.date}
        articleAuthor={story.author}
        includeSchema
        breadcrumbs={[
          { name: isKo ? '홈' : 'Home', path: `/${locale}` },
          { name: isKo ? '스토리' : 'Stories', path: `/${locale}/stories` },
          { name: story.title, path: `/${locale}/stories/${story.slug}` },
        ]}
      />

      <ImageHero
        title={story.title}
        subtitle={
          <div className="flex flex-wrap items-center justify-center gap-4 text-lg mt-4 opacity-90">
            <div className="flex items-center">
              <Tag className="mr-2" size={18} />
              <span>{story.category}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center">
              <Calendar className="mr-2" size={18} />
              <span>{story.createdAt ? timeAgo(story.createdAt) : story.date}</span>
            </div>
          </div>
        }
        backgroundImage={story.thumbnail || '/images/studio1.jpg'}
        imageAlt={story.title}
        minHeight="min-h-[50vh]"
        overlayGradient="from-black/70 via-black/40 to-black/70"
      />

      <Section variant="default" className="pt-12 pb-12">
        <div className="mb-12 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-6">
          <Link
            href={getLink("/stories")}
            className="inline-flex items-center typo-card-cta hover:underline"
          >
            <ArrowLeft className="mr-2" size={16} />
            {isKo ? "스토리 목록으로 돌아가기" : "Back to Stories"}
          </Link>

          <button
            onClick={shareStory}
            className="inline-flex items-center typo-card-cta hover:underline text-gray-600 dark:text-gray-400"
          >
            <Share2 className="mr-2" size={16} />
            {isKo ? "공유하기" : "Share"}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <MarkdownRenderer content={story.content} />
        </motion.div>

        <StoryCTA type={ctaType} locale={locale} />

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">{isKo ? "더 많은 스토리" : "More Stories"}</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {relatedStories.map((related) => (
                <StoryCard key={related.slug} story={related as any} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">{isKo ? "관련 스토리가 없습니다." : "No related stories."}</p>
          )}
          <Link href={getLink("/stories")} className="inline-flex items-center typo-card-cta hover:underline">
            <ArrowLeft className="mr-2" size={16} />
            {isKo ? "모든 스토리 보기" : "View all stories"}
          </Link>
        </div>
      </Section>
    </>
  );
};

(StoryDetailPage as any).hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: getStoryPaths(),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const locale = params?.locale || 'ko';
  try {
    const story = await getStoryDetail(params!.id as string, locale as string);
    const relatedStories = getAllStories(locale as string)
      .filter((item) => item.slug !== params!.id)
      .slice(0, 3);

    return {
      props: {
        locale,
        story,
        relatedStories,
      },
    };
  } catch (error) {
    console.error('Story detail error:', error);
    return {
      notFound: true,
    };
  }
};

export default StoryDetailPage;
