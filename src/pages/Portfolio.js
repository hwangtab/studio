import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaBackward, FaForward, FaVolumeUp, FaVolumeMute, FaHeadphones, FaExternalLinkAlt, FaMusic } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import { 
  getAllPortfolioItems, 
  getPortfolioItemsByCategory, 
  getAllCategories, 
  getAllAudioTracks 
} from '../utils/portfolioDataUtils';
import CategoryFilter from '../components/CategoryFilter';
import { PAGE_TITLE_ANIMATION, PAGE_SUBTITLE_ANIMATION, PAGE_CONTENT_ANIMATION } from '../utils/animationUtils';
import ResponsiveImage from '../components/ResponsiveImage';

// 개선된 포트폴리오 카드 컴포넌트
const PortfolioItem = ({ image, title, description, link, index }) => (
  <motion.div
    className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 cursor-pointer"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
    whileHover={{ y: -5 }}
    onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
  >
    {/* 이미지 컨테이너 */}
    <div className="relative overflow-hidden">
      <div className="w-full pb-[100%] relative">
        <ResponsiveImage 
          src={image} 
          alt={title} 
          pictureClassName="absolute inset-0 block h-full w-full"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          loading="lazy"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
        />
      </div>
      
      {/* 오버레이 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* 링크 버튼 */}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 right-4 bg-white/90 text-primary p-3 rounded-full shadow-lg transform translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-white z-10"
        aria-label="외부 링크로 이동"
        onClick={(e) => e.stopPropagation()}
      >
        <FaExternalLinkAlt />
      </a>
    </div>
    
    {/* 컨텐츠 */}
    <div className="p-6">
      <h3 className="typo-card-title text-gray-600 dark:text-gray-200 mb-3">{title}</h3>
      <p className="typo-card-body">{description}</p>
    </div>
    
    {/* 상단 바 요소 */}
    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
  </motion.div>
);

const AudioPlayer = ({ tracks }) => {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const audioRef = useRef(new Audio(tracks[currentTrack].src));
  const progressBarRef = useRef(null);
  const animationRef = useRef(null);
  const routerLocation = useLocation();

  const stopPlayback = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const whilePlaying = useCallback(() => {
    if (progressBarRef.current) {
      progressBarRef.current.value = audioRef.current.currentTime;
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(whilePlaying);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    audio.src = tracks[currentTrack].src;
    audio.load();

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    }

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    }

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
    }
  }, [currentTrack, tracks]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (isPlaying) {
      const playPromise = audioRef.current.play();

      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            animationRef.current = requestAnimationFrame(whilePlaying);
          })
          .catch((error) => {
            console.error('오디오 재생 오류:', error);
            setIsPlaying(false);
          });
      } else {
        animationRef.current = requestAnimationFrame(whilePlaying);
      }
    } else {
      audioRef.current.pause();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, currentTrack, whilePlaying]);

  useEffect(() => {
    stopPlayback();
  }, [routerLocation.pathname, stopPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  const changeRange = () => {
    audioRef.current.currentTime = progressBarRef.current.value;
    setCurrentTime(progressBarRef.current.value);
  }

  const playPause = () => {
    setIsPlaying(!isPlaying);
  }

  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  }

  const prevTrack = () => {
    setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }

  const changeVolume = (e) => {
    let value;
    if (e.target.tagName !== 'INPUT') {
      const rect = e.target.getBoundingClientRect();
      const clickPosition = e.clientX - rect.left;
      value = clickPosition / rect.width;
      value = Math.max(0, Math.min(1, value));
    } else {
      value = e.target.value;
    }
    
    setVolume(value);
    audioRef.current.volume = value;
    setIsMuted(value === 0);
  }

  const toggleMute = () => {
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  }

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  }

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div 
      className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 transition-all duration-500 ${isExpanded ? 'p-8' : 'p-6'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      layout
    >
      {/* 앨범 아트 및 트랙 정보 */}
      <div className="flex flex-col md:flex-row items-center mb-6">
        <motion.div 
          className={`relative rounded-xl shadow-lg overflow-hidden mb-6 md:mb-0 md:mr-8 transition-all duration-300 ${isExpanded ? 'w-48 h-48' : 'w-36 h-36'}`}
          layout
        >
          <ResponsiveImage 
            src={tracks[currentTrack].albumArt} 
            alt={`${tracks[currentTrack].title} 앨범 아트`} 
            pictureClassName="block w-full h-full"
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
            loading="lazy"
            sizes="160px"
          />
          {/* 재생 중 표시기 */}
          {isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex space-x-1">
                <div className="w-1.5 h-6 bg-white rounded-full animate-sound-wave"></div>
                <div className="w-1.5 h-10 bg-white rounded-full animate-sound-wave animation-delay-200"></div>
                <div className="w-1.5 h-8 bg-white rounded-full animate-sound-wave animation-delay-400"></div>
                <div className="w-1.5 h-4 bg-white rounded-full animate-sound-wave animation-delay-300"></div>
                <div className="w-1.5 h-7 bg-white rounded-full animate-sound-wave animation-delay-100"></div>
              </div>
            </div>
          )}
          {/* 재생/일시정지 오버레이 */}
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={playPause}
          >
            <div className="bg-white/20 backdrop-blur-md p-4 rounded-full">
              {isPlaying ? (
                <FaPause className="text-white text-2xl" />
              ) : (
                <FaPlay className="text-white text-2xl ml-1" />
              )}
            </div>
          </div>
        </motion.div>
        
        <div className="text-center md:text-left flex-1">
          <motion.h3 
            className="typo-card-title text-white mb-2"
            layout
          >
            {tracks[currentTrack].title}
          </motion.h3>
          <motion.div 
            className="flex items-center justify-center md:justify-start mb-4 text-gray-300"
            layout
          >
            <FaHeadphones className="mr-2 text-primary-light" /> 
            <span>트랙 {currentTrack + 1} / {tracks.length}</span>
          </motion.div>
          
          {/* 확장 시 표시되는 추가 정보 */}
          {isExpanded && (
            <motion.div 
              className="typo-card-body text-gray-400 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <p>스튜디오 놀에서 녹음 및 믹싱한 트랙입니다.</p>
              <p className="mt-2">고품질 오디오로 즐겨보세요.</p>
            </motion.div>
          )}
        </div>
        
        {/* 확장/축소 버튼 */}
        <motion.button
          className="text-gray-400 hover:text-white p-2 rounded-full self-start hidden md:block"
          onClick={toggleExpand}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          layout
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            {isExpanded ? (
              <path fillRule="evenodd" d="M5 10a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z" clipRule="evenodd" />
            )}
          </svg>
        </motion.button>
      </div>
      
      {/* 프로그레스 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="typo-card-meta text-gray-400">{formatTime(currentTime)}</span>
          <span className="typo-card-meta text-gray-400">{formatTime(duration)}</span>
        </div>
        <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
          <input 
            type="range" 
            ref={progressBarRef}
            defaultValue="0"
            onChange={changeRange}
            max={duration || 0}
            className="absolute inset-0 w-full h-full appearance-none bg-transparent z-10 opacity-0 cursor-pointer"
          />
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full" 
            style={{ width: `${progress}%` }}
          ></div>
          <div 
            className="absolute top-0 left-0 h-full w-full bg-gray-600 rounded-full opacity-20"
            style={{ transform: `scaleX(${progress / 100})`, transformOrigin: 'left' }}
          ></div>
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md pointer-events-none" 
            style={{ left: `calc(${progress}% - 8px)`, display: progress > 0 ? 'block' : 'none' }}
          ></div>
        </div>
      </div>
      
      {/* 컨트롤 버튼 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }} 
            onClick={toggleMute}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            {isMuted ? <FaVolumeMute className="text-xl" /> : <FaVolumeUp className="text-xl" />}
          </motion.button>
          <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden hidden sm:block relative">
            <div 
              className="absolute top-0 left-0 h-full w-full bg-gray-700 rounded-full"
              onClick={changeVolume}
            ></div>
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary-light to-secondary rounded-full" 
              style={{ width: `${volume * 100}%` }}
              onClick={changeVolume}
            ></div>
            <input 
              type="range" 
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={changeVolume}
              className="w-full h-full appearance-none bg-transparent opacity-0 absolute cursor-pointer z-10"
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none" 
              style={{ left: `calc(${volume * 100}% - 6px)` }}
            ></div>
          </div>
        </div>
        
        <div className="flex items-center justify-center space-x-4">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }} 
            onClick={prevTrack}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <FaBackward className="text-xl" />
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }} 
            onClick={playPause} 
            className="bg-gradient-to-r from-primary to-secondary text-white p-5 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            {isPlaying ? <FaPause className="text-2xl" /> : <FaPlay className="text-2xl ml-1" />}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }} 
            onClick={nextTrack}
            className="text-gray-400 hover:text-white transition-colors p-2"
          >
            <FaForward className="text-xl" />
          </motion.button>
        </div>
        
        <div className="w-24 flex justify-end">
          <motion.button
            className="text-gray-400 hover:text-white p-2 rounded-full md:hidden"
            onClick={toggleExpand}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              {isExpanded ? (
                <path fillRule="evenodd" d="M5 10a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z" clipRule="evenodd" />
              )}
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

const Portfolio = () => {
  // 상태 관리
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 데이터 로딩
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [itemsData, tracksData, categoriesData] = await Promise.all([
          getAllPortfolioItems(),
          getAllAudioTracks(),
          getAllCategories()
        ]);
        
        setPortfolioItems(itemsData);
        setAudioTracks(tracksData);
        setCategories(categoriesData);
        setFilteredItems(itemsData);
        setError(null);
      } catch (err) {
        console.error('데이터 로딩 오류:', err);
        setError('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 카테고리 필터링
  useEffect(() => {
    const filterItems = async () => {
      try {
        const filtered = await getPortfolioItemsByCategory(selectedCategory);
        setFilteredItems(filtered);
      } catch (err) {
        console.error('필터링 오류:', err);
        setFilteredItems(portfolioItems);
      }
    };

    if (portfolioItems.length > 0) {
      filterItems();
    }
  }, [selectedCategory, portfolioItems]);

  // 카테고리 변경 핸들러
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  // 로딩 상태 렌더링
  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="typo-section-lead">포트폴리오 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태 렌더링
  if (error) {
    return (
      <div className="container mx-auto px-4 pt-16 pb-12">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="typo-section-lead text-red-600 dark:text-red-400 text-center">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-16 pb-12">
      {/* 헤더 섹션 */}
      <div className="mb-16 text-center">
        <motion.h1 
          className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
          {...PAGE_TITLE_ANIMATION}
        >
          포트폴리오
        </motion.h1>
        <motion.p
          className="typo-section-lead max-w-2xl mx-auto"
          {...PAGE_SUBTITLE_ANIMATION}
        >
          스튜디오 놀에서 작업한 다양한 프로젝트들을 소개합니다.
          <br />
          각 작품을 클릭하여 더 자세한 정보를 확인하세요.
        </motion.p>
      </div>

      {/* 카테고리 필터 */}
      <motion.div
        className="mb-12"
        {...PAGE_CONTENT_ANIMATION}
      >
        <CategoryFilter
          activeCategory={selectedCategory}
          setActiveCategory={handleCategoryChange}
          categories={categories}
          buttonSize="lg"
          useCustomColors={true}
          gap="gap-3"
        />
      </motion.div>
      
      {/* 포트폴리오 그리드 */}
      <motion.div
        className="mb-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <FaMusic className="text-2xl text-primary mr-3" />
            <h2 className="typo-card-title text-gray-600 dark:text-gray-200">작업 프로젝트</h2>
          </div>
          <div className="typo-card-meta text-gray-500 dark:text-gray-400">
            {filteredItems.length}개 프로젝트
          </div>
        </div>
        
        {filteredItems.length === 0 ? (
          <div className="text-center pt-16 pb-12">
            <FaMusic className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="typo-card-body text-gray-500 dark:text-gray-400">
              선택한 카테고리에 해당하는 프로젝트가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map((item, index) => (
              <PortfolioItem key={item.id} {...item} index={index} />
            ))}
          </div>
        )}
      </motion.div>
      
      {/* 오디오 플레이어 섹션 */}
      <motion.div
        className="mt-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex items-center mb-8">
          <FaHeadphones className="text-2xl text-primary mr-3" />
          <h2 className="typo-card-title text-gray-600 dark:text-gray-200">샘플 트랙</h2>
        </div>
        {audioTracks.length > 0 ? (
          <AudioPlayer tracks={audioTracks} />
        ) : (
          <div className="text-center pt-16 pb-12 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <FaHeadphones className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="typo-card-body text-gray-500 dark:text-gray-400">
              샘플 트랙을 준비중입니다.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Portfolio;
