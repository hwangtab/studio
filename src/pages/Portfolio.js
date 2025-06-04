import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaBackward, FaForward, FaVolumeUp, FaVolumeMute, FaHeadphones, FaExternalLinkAlt, FaMusic } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';

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
        <img 
          src={image} 
          alt={title} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
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
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
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
  const location = useLocation();

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
    if (isPlaying) {
      audioRef.current.play();
      animationRef.current = requestAnimationFrame(whilePlaying);
    } else {
      audioRef.current.pause();
      cancelAnimationFrame(animationRef.current);
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      cancelAnimationFrame(animationRef.current);
    }
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      audioRef.current.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const whilePlaying = () => {
    if (progressBarRef.current) {
      progressBarRef.current.value = audioRef.current.currentTime;
      setCurrentTime(audioRef.current.currentTime);
      animationRef.current = requestAnimationFrame(whilePlaying);
    }
  }

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
          <img 
            src={tracks[currentTrack].albumArt} 
            alt={`${tracks[currentTrack].title} 앨범 아트`} 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
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
            className="text-2xl font-bold text-white mb-2"
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
              className="text-gray-400 text-sm mb-4"
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
          <span className="text-sm text-gray-400">{formatTime(currentTime)}</span>
          <span className="text-sm text-gray-400">{formatTime(duration)}</span>
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
  const portfolioItems = [
    { 
      image: "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5IjoiY292ZXIvZTg0NGRhNDAtMDNmOS00NmQ1LWE0ODUtY2NhY2YxYTIzMDVkLzVhYjQzY2I4LWFhMGEtNGU2Mi05NjhiLWFiNDRmYjdmNzZiNi5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoxMjQwLCJoZWlnaHQiOjEyNDAsIndpdGhvdXRFbmxhcmdlbWVudCI6dHJ1ZX19fQ==", 
      title: "삼각전파사 <Dystopia 2025>", 
      description: "기획, 녹음, 믹싱, 마스터링",
      link: "https://tumblbug.com/dystopia2025"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/373556/37355636.jpg", 
      title: "자이 <Golden Hour>", 
      description: "기획, 녹음, 믹싱",
      link: "https://soundcloud.com/user-292846120/sets/jai-golden-hour/s-BPI7SsQ1rfb?si=cf71793aa6574753902aefae1c68631f&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/363228/36322824.jpg", 
      title: "이서영 <우리>", 
      description: "기획, 녹음",
      link: "https://www.youtube.com/watch?v=GAXy7iJKGzk"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/364148/36414830.jpg", 
      title: "자이(Jai) x HANASH <분홍색 패딩 소녀>", 
      description: "기획, 녹음",
      link: "https://www.youtube.com/watch?v=812CJnROxxs"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/363226/36322647.jpg", 
      title: "모모 <If this can't be tolerated, what can't be?>", 
      description: "기획, 녹음, 믹싱",
      link: "https://www.youtube.com/watch?v=aq2DESx9ITQ"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/370548/37054815.jpg", 
      title: "여유 <서울의 밤 (feat. 정수민)>", 
      description: "기획, 녹음",
      link: "https://orcd.co/4e3m8rx"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/368417/36841743.jpg", 
      title: "나뭇잎들 <눈 앞의 마음>", 
      description: "기획, 녹음, 믹싱",
      link: "https://orcd.co/v4bq9px"
    },
    { 
      image: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d5/b2/77/d5b277e3-8285-0ef6-9cbd-7d1552b09ff7/198846759562.jpg/1200x630bb.jpg", 
      title: "모레도토요일 <We will sail for your freedom>", 
      description: "기획, 녹음, 믹싱",
      link: "https://orcd.co/qjanjyy"
    },
    { 
      image: "https://thumb.mt.co.kr/06/2025/01/2025011014033361606_1.jpg", 
      title: "김인 <별을 보러 간 사람>", 
      description: "기획, 편곡, 녹음, 믹싱",
      link: "https://www.youtube.com/watch?v=waPHNm89mDk"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/366016/36601647.jpg", 
      title: "까르 <TRANSITION>",
      description: "기획, 편곡, 녹음, 믹싱",
      link: "https://orcd.co/o3vzobo"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/363226/36322648.jpg", 
      title: "남수 <안녕 (먼 곳의 그대에게)>", 
      description: "기획, 녹음, 믹싱",
      link: "https://www.youtube.com/watch?v=JMKr0dOLWZo"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg", 
      title: "김동산과 블루이웃 <물결>", 
      description: "기획, 녹음, 믹싱",
      link: "https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/1000/363228/36322827.jpg", 
      title: "정진석 <이 땅이 니 땅이가>", 
      description: "기획, 편곡, 녹음, 믹싱",
      link: "https://orcd.co/7zkgde8"
    },
    { 
      image: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/32/6f/3d/326f3d7d-4467-9ebd-2b0e-3bbc8e02e78d/888618381700.jpg/600x600bf-60.jpg", 
      title: "황경하 <눈녹듯>", 
      description: "기획, 녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=WmI2EPjLr0c"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/500/206343/20634376.jpg", 
      title: "희우 <잊음>", 
      description: "편곡, 녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=fTmh92Lmo-w"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio1.jpg`, 
      title: "희우 <그대는>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=j5PuwQVzRe8"
    },
    { 
      image: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d6/bc/4b/d6bc4b2f-b966-61ad-82a5-460e191013a9/artwork.jpg/600x600bf-60.jpg", 
      title: "Jinu Konda <Burn In Hell>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=-7J59hf6rdc" 
    },
    { 
      image: "https://i.ytimg.com/vi/qzlkFmRBUl4/maxresdefault.jpg", 
      title: "남자애 <하란>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=qzlkFmRBUl4"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio2.jpg`, 
      title: "남자애 <해방>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=89hXcnBydp4&t=4s"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/500/206169/20616910.jpg", 
      title: "세민 <여린 잎>", 
      description: "기획, 믹싱, 마스터링",
      link: "https://www.youtube.com/playlist?list=PLzLIgzZ5BKyBQdDZE7wZRZ3YD-Aocx53W"
    },
    { 
      image: "https://image.bugsm.co.kr/album/images/350/308732/30873239.jpg", 
      title: "영인 <빨간 점>", 
      description: "믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=NGvBAaiWqU8"
    },
    { 
      image: "https://cdn.imweb.me/thumbnail/20221109/0132edb19f0bf.jpg", 
      title: "남자애 <위 인물은 X를 겪고 깨달음을 얻음>", 
      description: "편곡, 레코딩, 믹싱, 마스터링",
      link: "https://music.bugs.co.kr/album/30859733?wl_ref=M_contents_01_04"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio3.jpg`, 
      title: "류형수 <하루>", 
      description: "기획, 녹음, 믹싱",
      link: "https://youtu.be/6vgPysZOQ9c"
    },
    { 
      image: "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5Ijoic3RvcnkvNDRhY2E0MWItYzI0Zi00MTZmLWIyNzktNjMxZDZjZDA3MDAyLzA5Y2YzNjhjLThjZTgtNDYxMS1iZTQ4LTcwNzUyZjFiMTE2MS5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2l0aG91dEVubGFyZ2VtZW50Ijp0cnVlLCJ3aWR0aCI6IjEyNDAifX19", 
      title: "엉아들 <Self-titled>", 
      description: "기획, 녹음, 믹싱",
      link: "https://www.youtube.com/playlist?list=PLlm8-iwS-7gOY8-pmL0Xz25_Hzl2FM-U7"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio4.jpg`, 
      title: "강호중 <Self-titled>", 
      description: "기획, 녹음, 믹싱",
      link: "https://www.youtube.com/watch?v=emtWqYhuZQw"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio5.jpg`, 
      title: "Various Artists <물고기는 물이 없으면 죽어요>", 
      description: "기획, 녹음, 믹싱, 마스터링",
      link: "https://www.melon.com/album/detail.htm?albumId=11109846"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio6.jpg`, 
      title: "<발쾌한> CM송", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.11st.co.kr/products/5966956725"
    },
  ];

  const audioTracks = [
    { title: "황경하 - 눈녹듯", src: `${process.env.PUBLIC_URL}/audio/sample1.mp3`, albumArt: `${process.env.PUBLIC_URL}/images/album1.jpg` },
    { title: "휘우 - 그대는", src: `${process.env.PUBLIC_URL}/audio/sample2.mp3`, albumArt: `${process.env.PUBLIC_URL}/images/album2.jpg` },
    { title: "류형수 - 숨 (Vocal 김수린)", src: `${process.env.PUBLIC_URL}/audio/sample3.mp3`, albumArt: `${process.env.PUBLIC_URL}/images/album3.jpg` },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      {/* 헤더 섹션 */}
      <div className="mb-16 text-center">
        <motion.h1 
          className="text-heading-1 font-title mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent py-4"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          포트폴리오
        </motion.h1>
        <motion.p
          className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          스튜디오 놀에서 작업한 다양한 프로젝트들을 소개합니다.
          <br />
          각 작품을 클릭하여 더 자세한 정보를 확인하세요.
        </motion.p>
      </div>
      
      {/* 포트폴리오 그리드 */}
      <motion.div
        className="mb-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center mb-8">
          <FaMusic className="text-2xl text-primary mr-3" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">작업 프로젝트</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {portfolioItems.map((item, index) => (
            <PortfolioItem key={index} {...item} index={index} />
          ))}
        </div>
      </motion.div>
      
      {/* 오디오 플레이어 섹션 */}
      <motion.div
        className="mb-16"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center mb-8">
          <FaHeadphones className="text-2xl text-primary mr-3" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">샘플 트랙</h2>
        </div>
        <AudioPlayer tracks={audioTracks} />
      </motion.div>
    </div>
  );
};

export default Portfolio;