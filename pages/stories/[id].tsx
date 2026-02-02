import React from 'react';
import type { NextPage, GetStaticProps, GetStaticPaths, GetStaticPropsContext } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Tag, Share2 } from 'lucide-react';
// @ts-ignore - SEO component is JS
import SEO from '../../components/SEO';
// @ts-ignore - MarkdownRenderer component is JS
import MarkdownRenderer from '../../components/MarkdownRenderer';
// @ts-ignore - StoryCard component is JS
import StoryCard from '../../components/StoryCard';
// @ts-ignore - ResponsiveImage component is JS
import ResponsiveImage from '../../components/ResponsiveImage';
import { stripMarkdown } from '../../utils/localDataUtils';
import { timeAgo } from '../../utils/dateUtils';
import { getAllStories, getStoryDetail, getStoryPaths } from '../../lib/stories';
import type { Story, StoryDetail } from '../../types/story';

interface StoryDetailPageProps {
  story: StoryDetail;
  relatedStories: Story[];
}

type Params = {
  id: string;
};

const StoryDetailPage: NextPage<StoryDetailPageProps> = ({ story, relatedStories }) => {
  const router = useRouter();

  if (router.isFallback) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);
  const shareUrl = `https://studionol.co.kr/stories/${story.slug}`;

  const shareStory = async () => {
    const shareData = {
      title: story.title,
      text: metaDescription,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${story.title}\n${shareUrl}`);
        alert('링크가 클립보드에 복사되었습니다.');
      }
    } catch (error) {
      console.error('공유 오류:', error);
    }
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
        // @ts-ignore - SEO component is JS
        breadcrumbs={[
          { name: '홈', path: '/' },
          { name: '스토리', path: '/stories' },
          { name: story.title, path: `/stories/${story.slug}` },
        ]}
      />
      <div className="container mx-auto px-4 pt-8 pb-12">
        {story.thumbnail && !story.thumbnailDerived && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 rounded-xl overflow-hidden"
          >
            <ResponsiveImage
              src={story.thumbnail}
              alt={story.title}
              className="object-cover"
              pictureClassName="block w-full h-72 md:h-[26rem]"
              sizes="100vw"
              width={1200}
              height={600}
              fill
            />
          </motion.div>
        )}

        <div className="mb-8">
          <Link
            href="/stories"
            className="inline-flex items-center typo-card-cta hover:underline mb-6"
          >
            <ArrowLeft className="mr-2" size={16} />
            스토리 목록으로 돌아가기
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-heading-1 font-title mb-4">
              {story.title}
            </h1>

            <div className="flex flex-wrap items-center mb-6 typo-card-meta">
              <div className="flex items-center mr-6 mb-2">
                <Calendar className="mr-2 text-gray-500" size={14} />
                <span>{story.createdAt ? timeAgo(story.createdAt) : '날짜 정보 없음'}</span>
              </div>

              <div className="flex items-center mr-6 mb-2">
                <Tag className="mr-2" size={14} />
                <span>{story.category}</span>
              </div>

              <button
                onClick={shareStory}
                className="inline-flex items-center typo-card-cta hover:underline ml-auto mb-2"
              >
                <Share2 className="mr-2" size={14} />
                공유하기
              </button>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <MarkdownRenderer content={story.content} />
        </motion.div>

        {Array.isArray(story.images) && story.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
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
      </div>
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
