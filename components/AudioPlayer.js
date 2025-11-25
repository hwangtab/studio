import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaBackward, FaForward, FaVolumeUp, FaVolumeMute, FaHeadphones } from 'react-icons/fa';
import ResponsiveImage from './ResponsiveImage';
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
  const router = useRouter();

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
  }, [router.asPath, stopPlayback]);

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

export default AudioPlayer;
