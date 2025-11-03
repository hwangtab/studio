import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaCalendarAlt, FaTag, FaShare } from 'react-icons/fa';
import { getStoryById, getRelatedStories, stripMarkdown } from '../utils/localDataUtils';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { timeAgo } from '../utils/dateUtils';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Helmet } from 'react-helmet-async';
import StoryCard from '../components/StoryCard';

const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [galleryImagesLoaded, setGalleryImagesLoaded] = useState({});
  const [relatedStories, setRelatedStories] = useState([]);

  // 스토리 데이터 가져오기
  useEffect(() => {
    const fetchStory = async () => {
      try {
        setLoading(true);
        const storyData = await getStoryById(id);
        
        if (!storyData) {
          setError('스토리를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }
        
        setStory(storyData);
        setLoading(false);
      } catch (error) {
        console.error('스토리 상세 정보 불러오기 오류:', error);
        setError('스토리를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    };

    fetchStory();
  }, [id]);

  // 관련 스토리 가져오기
  useEffect(() => {
    if (!story) return;
    
    const fetchRelatedStories = async () => {
      try {
        const related = await getRelatedStories(story.id);
        setRelatedStories(related);
      } catch (error) {
        console.error('관련 스토리 불러오기 오류:', error);
      }
    };
    
    fetchRelatedStories();
  }, [story]);

  // 스토리 공유 기능
  const shareStory = () => {
    const thumbnailUrl = story?.image || 
      (story?.content?.match(/!\[.*?\]\((.*?)\)/) || [])[1] || 
      `${window.location.origin}/public/images/studio1.jpg`;

    if (navigator.share) {
      navigator.share({
        title: story?.title,
        text: story?.content?.substring(0, 100) + '...',
        url: window.location.href,
        ...(thumbnailUrl && { files: [thumbnailUrl] })
      })
      .catch(error => {
        console.error('공유 오류:', error);
        navigator.clipboard.writeText(`${story?.title}\n${window.location.href}`)
          .then(() => alert('공유 정보가 클립보드에 복사되었습니다.'))
          .catch(err => console.error('클립보드 복사 오류:', err));
      });
    } else {
      navigator.clipboard.writeText(`${story?.title}\n${window.location.href}`)
        .then(() => alert('공유 정보가 클립보드에 복사되었습니다.'))
        .catch(error => console.error('클립보드 복사 오류:', error));
    }
  };

  // 갤러리 이미지 로딩 상태 업데이트
  const handleGalleryImageLoad = (index) => {
    setGalleryImagesLoaded(prev => ({
      ...prev,
      [index]: true
    }));
  };

  // 로딩 중 표시
  if (loading) {
    return (
      <>
        <Helmet>
          <title>로딩 중 - 스튜디오 놀</title>
        </Helmet>
        <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </>
    );
  }

  // 오류 표시
  if (error) {
    return (
      <>
        <Helmet>
          <title>오류 발생 - 스튜디오 놀</title>
        </Helmet>
        <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-xl text-red-500 mb-4">{error}</p>
            <button
              onClick={() => navigate('/stories')}
              className="flex items-center text-primary hover:underline"
            >
              <FaArrowLeft className="mr-2" />
              스토리 목록으로 돌아가기
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!story) {
    return (
      <>
        <Helmet>
          <title>스토리 없음 - 스튜디오 놀</title>
        </Helmet>
        <div className="container mx-auto px-4 pt-16 pb-12 flex justify-center items-center h-64">
          <div className="text-center">
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">스토리를 찾을 수 없습니다.</p>
            <button
              onClick={() => navigate('/stories')}
              className="flex items-center text-primary hover:underline"
            >
              <FaArrowLeft className="mr-2" />
              스토리 목록으로 돌아가기
            </button>
          </div>
        </div>
      </>
    );
  }

  const metaDescription = stripMarkdown(story.content || '').substring(0, 160);

  return (
    <>
      <Helmet>
        <title>{story.title} - 스튜디오 놀</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={story.title} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="article" />
        <meta 
          property="og:image" 
          content={story.image || 
            (story.content.match(/!\[.*?\]\((.*?)\)/) || [])[1] || 
            `${window.location.origin}/public/images/studio1.jpg`} 
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      
      <div className="container mx-auto px-4 pt-8 pb-12">
        {/* 메인 이미지 */}
        {story.image && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 rounded-xl overflow-hidden"
          >
            <LazyLoadImage
              src={story.image}
              alt={story.title}
              className="w-full h-auto max-h-96 object-cover"
              effect="blur"
            />
          </motion.div>
        )}

        {/* 스토리 헤더 */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/stories')}
            className="inline-flex items-center typo-card-cta hover:underline mb-6"
          >
            <FaArrowLeft className="mr-2" />
            스토리 목록으로 돌아가기
          </button>
          
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-heading-1 font-title text-gray-900 dark:text-white mb-4">
              {story.title}
            </h1>
            
            <div className="flex flex-wrap items-center text-gray-600 dark:text-gray-300 mb-6 text-caption">
              <div className="flex items-center mr-6 mb-2 group text-thin">
                <FaCalendarAlt className="mr-2 text-gray-500 group-hover:text-primary transition-colors" />
                <span className="text-gray-600 dark:text-gray-300">
                  {story.createdAt ? timeAgo(story.createdAt) : '날짜 정보 없음'}
                </span>
              </div>
              
              <div className="flex items-center mr-6 mb-2 text-thin">
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
        
        {/* 스토리 내용 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <MarkdownRenderer content={story.content.replace(/^```markdown[\s\S]*?```/g, '')} />
        </motion.div>
        
        {/* 갤러리 */}
        {story.images && story.images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="typo-card-title mb-6">갤러리</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {story.images.map((image, index) => (
                <div key={index} className="aspect-w-16 aspect-h-9 relative rounded-lg overflow-hidden">
                  {!galleryImagesLoaded[index] && (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <LazyLoadImage
                    src={image}
                    alt={`갤러리 이미지 ${index + 1}`}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${galleryImagesLoaded[index] ? 'opacity-100' : 'opacity-0'}`}
                    effect="blur"
                    threshold={100}
                    afterLoad={() => handleGalleryImageLoad(index)}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
        
        {/* 관련 스토리 */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="typo-card-title mb-6">더 많은 스토리</h2>
          {relatedStories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {relatedStories.map(story => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          ) : (
            <p className="typo-card-body text-gray-500 mb-6">관련 스토리가 없습니다.</p>
          )}
          <Link
            to="/stories"
            className="inline-flex items-center typo-card-cta hover:underline"
          >
            <FaArrowLeft className="mr-2" />
            모든 스토리 보기
          </Link>
        </div>
      </div>
    </>
  );
};

export default StoryDetail;
