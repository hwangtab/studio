import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaCalendarAlt, FaTag, FaShare } from 'react-icons/fa';
import SEO from '../../components/SEO';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import StoryCard from '../../components/StoryCard';
import ResponsiveImage from '../../components/ResponsiveImage';
import { stripMarkdown } from '../../utils/localDataUtils';
import { timeAgo } from '../../utils/dateUtils';
import { getAllStories, getStoryDetail, getStoryPaths } from '../../lib/stories';

const StoryDetailPage = ({ story, relatedStories }) => {
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
        description={metaDescription}
        canonical={shareUrl}
        ogImage={story.thumbnail || '/images/hardware2.jpg'}
      />
      <div className="container mx-auto px-4 pt-8 pb-12">
        {story.thumbnail && (
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
              fill
            />
          </motion.div>
        )}

        <div className="mb-8">
          <Link
            href="/stories"
            className="inline-flex items-center typo-card-cta hover:underline mb-6"
          >
            <FaArrowLeft className="mr-2" />
            스토리 목록으로 돌아가기
          </Link>

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-heading-1 font-title text-gray-900 dark:text-white mb-4">
              {story.title}
            </h1>

            <div className="flex flex-wrap items-center text-gray-600 dark:text-gray-300 mb-6 text-caption">
              <div className="flex items-center mr-6 mb-2">
                <FaCalendarAlt className="mr-2 text-gray-500" />
                <span>{story.createdAt ? timeAgo(story.createdAt) : '날짜 정보 없음'}</span>
              </div>

              <div className="flex items-center mr-6 mb-2">
                <FaTag className="mr-2" />
                <span>{story.category}</span>
              </div>

              <button
                onClick={shareStory}
                className="inline-flex items-center typo-card-cta hover:underline ml-auto mb-2"
              >
                <FaShare className="mr-2" />
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
                <StoryCard key={related.slug} story={related} />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">관련 스토리가 없습니다.</p>
          )}
          <Link href="/stories" className="inline-flex items-center typo-card-cta hover:underline">
            <FaArrowLeft className="mr-2" />
            모든 스토리 보기
          </Link>
        </div>
      </div>
    </>
  );
};

export const getStaticPaths = () => {
  return {
    paths: getStoryPaths(),
    fallback: 'blocking',
  };
};

export const getStaticProps = async ({ params }) => {
  try {
    const story = await getStoryDetail(params.id);
    const relatedStories = getAllStories()
      .filter((item) => item.slug !== params.id)
      .slice(0, 3);

    return {
      props: {
        story,
        relatedStories,
      },
      revalidate: 60,
    };
  } catch (error) {
    console.error('Story detail error:', error);
    return {
      notFound: true,
    };
  }
};

export default StoryDetailPage;
