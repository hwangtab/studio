import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaForward, FaBackward, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

const PortfolioItem = ({ image, title, description, link, index }) => (
  <motion.a
  href={link}
  target="_blank"
  rel="noopener noreferrer"
  className="bg-white rounded-lg shadow-lg overflow-hidden block hover:shadow-xl transition-shadow duration-300"
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, delay: index * 0.1 }}
>
    <img src={image} alt={title} className="w-full h-48 object-cover" />
    <div className="p-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </motion.a>
);

const AudioPlayer = ({ tracks }) => {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef(new Audio(tracks[currentTrack].src));
  const progressBarRef = useRef(null);
  const animationRef = useRef(null);

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

  const whilePlaying = () => {
    progressBarRef.current.value = audioRef.current.currentTime;
    setCurrentTime(audioRef.current.currentTime);
    animationRef.current = requestAnimationFrame(whilePlaying);
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
    const value = e.target.value;
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
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center mb-4">
        <img 
          src={tracks[currentTrack].albumArt} 
          alt={`${tracks[currentTrack].title} Album Art`} 
          className="w-24 h-24 rounded-lg shadow-md mr-4 object-cover"
        />
        <div>
          <h3 className="text-lg font-bold">{tracks[currentTrack].title}</h3>
          <p className="text-gray-600">Track {currentTrack + 1} of {tracks.length}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm">{formatTime(currentTime)}</span>
        <input 
          type="range" 
          ref={progressBarRef}
          defaultValue="0"
          onChange={changeRange}
          max={duration}
          className="w-full mx-4 accent-primary"
        />
        <span className="text-sm">{formatTime(duration)}</span>
      </div>
      <div className="flex justify-center items-center space-x-4 mb-4">
        <motion.button whileTap={{ scale: 0.95 }} onClick={prevTrack}>
          <FaBackward className="text-primary text-xl" />
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.95 }} 
          onClick={playPause} 
          className="bg-primary text-white p-3 rounded-full"
        >
          {isPlaying ? <FaPause className="text-2xl" /> : <FaPlay className="text-2xl ml-1" />}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={nextTrack}>
          <FaForward className="text-primary text-xl" />
        </motion.button>
      </div>
      <div className="flex items-center">
        <motion.button whileTap={{ scale: 0.95 }} onClick={toggleMute}>
          {isMuted ? <FaVolumeMute className="text-primary" /> : <FaVolumeUp className="text-primary" />}
        </motion.button>
        <input 
          type="range" 
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={changeVolume}
          className="w-full ml-2 accent-primary"
        />
      </div>
    </div>
  );
};

const Portfolio = () => {
  const portfolioItems = [
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio1.jpg`, 
      title: "희우 <그대는>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=j5PuwQVzRe8"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio2.jpg`, 
      title: "남자애 <해방>", 
      description: "녹음, 믹싱, 마스터링",
      link: "https://www.youtube.com/watch?v=89hXcnBydp4&t=4s"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio3.jpg`, 
      title: "류형수 <하루>", 
      description: "음반기획, 녹음, 믹싱",
      link: "https://youtu.be/6vgPysZOQ9c"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio4.jpg`, 
      title: "강호중 <Self-titled>", 
      description: "음반기획, 녹음, 믹싱",
      link: "https://www.youtube.com/watch?v=emtWqYhuZQw"
    },
    { 
      image: `${process.env.PUBLIC_URL}/images/portfolio5.jpg`, 
      title: "옴니버스 앨범 <물고기는 물이 없으면 죽어요>", 
      description: "음반기획, 녹음, 믹싱, 마스터링",
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
    { title: "희우 - 그대는", src: `${process.env.PUBLIC_URL}/audio/sample2.mp3`, albumArt: `${process.env.PUBLIC_URL}/images/album2.jpg` },
    { title: "류형수 - 숨 (Vocal 김수린)", src: `${process.env.PUBLIC_URL}/audio/sample3.mp3`, albumArt: `${process.env.PUBLIC_URL}/images/album3.jpg` },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.h1 
        className="text-5xl pt-2 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        포트폴리오
      </motion.h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {portfolioItems.map((item, index) => (
          <PortfolioItem key={index} {...item} index={index} />
        ))}
      </div>
      <motion.div
        className="mb-12"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.h1 
        className="word-break-keep-all text-5xl pt-6 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        샘플 트랙
      </motion.h1>
        <AudioPlayer tracks={audioTracks} />
      </motion.div>
    </div>
  );
};

export default Portfolio;