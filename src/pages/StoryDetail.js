import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaArrowLeft, FaCalendarAlt, FaTag, FaShare } from 'react-icons/fa';
import { getStoryById } from '../utils/localDataUtils'; 
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

// 스토리 상세 페이지
const StoryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [galleryImagesLoaded, setGalleryImagesLoaded] = useState({});

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

  // 스토리 공유 기능
  const shareStory = () => {
    if (navigator.share) {
      navigator.share({
        title: story?.title,
        text: story?.content?.substring(0, 100) + '...',
        url: window.location.href
      })
      .catch(error => console.error('공유 오류:', error));
    } else {
      // 클립보드 복사
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('링크가 클립보드에 복사되었습니다.'))
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
      <div className="container mx-auto px-4 py-16 flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // 오류 표시
  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center items-center h-64">
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
    );
  }

  if (!story) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center items-center h-64">
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
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      {/* 스토리 헤더 */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/stories')}
          className="inline-flex items-center text-primary hover:underline mb-6"
        >
          <FaArrowLeft className="mr-2" />
          스토리 목록으로 돌아가기
        </button>
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            {story.title}
          </h1>
          
          <div className="flex flex-wrap items-center text-gray-600 dark:text-gray-300 mb-6">
            <div className="flex items-center mr-6 mb-2">
              <FaCalendarAlt className="mr-2" />
              <span>{new Date(story.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            
            <div className="flex items-center mr-6 mb-2">
              <FaTag className="mr-2" />
              <span>{story.category}</span>
            </div>
            
            <button 
              onClick={shareStory}
              className="inline-flex items-center text-primary hover:underline ml-auto mb-2"
            >
              <FaShare className="mr-2" />
              공유하기
            </button>
          </div>
        </motion.div>
      </div>
      
      {/* 메인 이미지 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mb-12"
      >
        <div className="aspect-w-16 aspect-h-9 w-full pb-[56.25%] relative rounded-xl overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <LazyLoadImage
            src={story.imageUrl || 'https://via.placeholder.com/1200x600?text=No+Image'}
            alt={story.title}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            effect="blur"
            threshold={100}
            afterLoad={() => setImageLoaded(true)}
          />
        </div>
      </motion.div>
      
      {/* 스토리 내용 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="prose prose-lg dark:prose-invert max-w-none mb-12"
      >
        <div dangerouslySetInnerHTML={{ __html: story.content }} />
      </motion.div>
      
      {/* 갤러리 */}
      {story.images && story.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-12"
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            갤러리
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {story.images.map((image, index) => (
              <div 
                key={index} 
                className="aspect-w-16 aspect-h-9 w-full pb-[56.25%] relative rounded-lg overflow-hidden"
              >
                {!galleryImagesLoaded[index] && (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <LazyLoadImage
                  src={image}
                  alt={`${story.title} - ${index + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover hover:scale-105 transition-all duration-300 ${galleryImagesLoaded[index] ? 'opacity-100' : 'opacity-0'}`}
                  effect="blur"
                  threshold={100}
                  afterLoad={() => handleGalleryImageLoad(index)}
                />
              </div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* 관련 스토리 섹션 */}
      <div className="mt-12 text-center">
        <button
          onClick={() => navigate('/stories')}
          className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary-dark transition-colors duration-300 inline-block"
        >
          다른 스토리 보기
        </button>
      </div>
    </div>
  );
};

export default StoryDetail;
