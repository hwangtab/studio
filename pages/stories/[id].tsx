import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths, GetStaticPropsContext } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2 } from 'lucide-react';
import SEO from '../../components/SEO';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import StoryCard from '../../components/StoryCard';
import ImageHero from '../../components/common/ImageHero';
import ResponsiveImage from '../../components/ResponsiveImage';
import StoryCTA, { CTAType } from '../../components/StoryCTA';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { shareContent } from '../../utils/shareUtils';
import { extractFirstImageUrl } from '../../utils/localDataUtils';
import { stripMarkdown, summarizeText } from '../../utils/textUtils';
import { timeAgo } from '../../utils/dateUtils';
import { getAllStories, getStoryDetail, getStoryPaths } from '../../lib/stories';
import type { Story, StoryDetail } from '../../types/story';
import type { NextPageWithLayout } from '../../types';
import { Section } from '../../components/ui/Section';

interface StoryDetailPageProps {
  story: StoryDetail;
  relatedStories: Story[];
}

type Params = {
  id: string;
};

const StoryDetailPage: NextPageWithLayout<StoryDetailPageProps> = ({ story, relatedStories }) => {
  const getCTAType = (slug: string, category: string | undefined): CTAType => {
    // slug를 기반으로 결정적인 시드값 생성 (하이드레이션 오류 방지)
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

    if (category === '인터뷰' || category === '아티스트') {
      if (seed < 0.7) return 'production';
      if (seed < 0.9) return 'recording';
      return 'lesson';
    }

    if (category === '이벤트' || category === '공지') {
      if (seed < 0.3) return 'production';
      if (seed < 0.6) return 'lesson';
      if (seed < 0.8) return 'recording';
      return 'practice';
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

  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);
  const shareUrl = `https://studionol.co.kr/stories/${story.slug}`;

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
        title={`${story.title} - 스튜디오 놀`}
        description={story.summary || metaDescription}
        keywords={story.tags ? story.tags.join(', ') : '스튜디오 놀, 음악, 스토리'}
        canonical={shareUrl}
        ogImage={story.thumbnail || '/images/hardware2.jpg'}
        ogType="article"
        articlePublishedTime={story.date}
        articleModifiedTime={(story as any).updatedAt || story.date}
        articleAuthor={story.author}
        articleSection={story.category}
        includeSchema
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '스토리', path: '/stories' },
          { name: story.title, path: `/stories/${story.slug}` },
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
            href="/stories"
            className="inline-flex items-center typo-card-cta hover:underline"
          >
            <ArrowLeft className="mr-2" size={16} />
            스토리 목록으로 돌아가기
          </Link>

          <button
            onClick={shareStory}
            className="inline-flex items-center typo-card-cta hover:underline text-gray-600 dark:text-gray-400"
          >
            <Share2 className="mr-2" size={16} />
            공유하기
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

        <StoryCTA type={ctaType} />

        {Array.isArray(story.images) && story.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="typo-card-title mb-6">갤러리</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {story.images.map((image, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden aspect-[16/9]">
                  <ResponsiveImage
                    src={image}
                    alt={`갤러리 이미지 ${index + 1}`}
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    width={600}
                    height={400}
                    fill
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">더 많은 스토리</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {relatedStories.map((related) => (
                <StoryCard key={related.slug} story={related as any} />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">관련 스토리가 없습니다.</p>
          )}
          <Link href="/stories" className="inline-flex items-center typo-card-cta hover:underline">
            <ArrowLeft className="mr-2" size={16} />
            모든 스토리 보기
          </Link>
        </div>
      </Section>
    </>
  );
};

export const getStaticPaths: GetStaticPaths<Params> = () => {
  return {
    paths: getStoryPaths(),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<StoryDetailPageProps, Params> = async ({ params }) => {
  try {
    const story = await getStoryDetail(params!.id);
    const relatedStories = getAllStories()
      .filter((item) => item.slug !== params!.id)
      .slice(0, 3);

    return {
      props: {
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

StoryDetailPage.hasHero = true;
