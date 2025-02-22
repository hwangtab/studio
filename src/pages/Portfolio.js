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
    <div className="relative pb-[100%]">
      <img 
        src={image} 
        alt={title} 
        className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
      />
    </div>
    <div className="p-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </motion.a>
);

const AudioPlayer = ({ title, audioSrc, coverArt, isCurrentlyPlaying, onPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!isCurrentlyPlaying && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isCurrentlyPlaying]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPlay(null);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      onPlay(audioSrc);
    }
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    const time = e.target.value;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      className="relative bg-white rounded-xl shadow-lg overflow-hidden mb-6 group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <div className="relative">
        <div 
          className="relative w-full pt-[56.25%] cursor-pointer"
          onClick={togglePlay}
        >
          <img 
            src={coverArt} 
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          
          {/* 재생 상태 표시 오버레이 */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-black/30 backdrop-blur-sm p-6 rounded-full">
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <motion.h3 
            className="text-xl font-bold mb-2"
            initial={false}
            animate={{ y: isHovered ? -8 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {title}
          </motion.h3>

          <motion.div 
            className="flex items-center space-x-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={togglePlay}
              className="bg-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition-colors duration-300"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>

            <div className="flex-grow flex items-center space-x-2">
              <span className="text-sm text-white/80 w-12">{formatTime(currentTime)}</span>
              <div className="flex-grow relative h-1.5">
                <div className="absolute inset-0 bg-white/20 rounded-full" />
                <motion.div
                  className="absolute left-0 top-0 h-full bg-white rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
                <input
                  type="range"
                  min="0"
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-sm text-white/80 w-12">{formatTime(duration)}</span>
            </div>
          </motion.div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
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
      image: "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5Ijoic3RvcnkvODVlZTNjNWItNGU5NS00ZWJjLWEyOWMtZmUwMTY4NGQ0MzQ5L2JiZDc3MDkwLTkzMGQtNGI2ZC1iMWE0LWM2MDhmYTFkMDFlOC5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoxMjQwLCJ3aXRob3V0RW5sYXJnZW1lbnQiOnRydWV9fX0=", 
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
    { title: "자이 - Fever", src: `${process.env.PUBLIC_URL}/audio/fever.mp3`, coverArt: "https://img.tumblbug.com/eyJidWNrZXQiOiJ0dW1ibGJ1Zy1pbWctYXNzZXRzIiwia2V5Ijoic3RvcnkvODVlZTNjNWItNGU5NS00ZWJjLWEyOWMtZmUwMTY4NGQ0MzQ5L2JiZDc3MDkwLTkzMGQtNGI2ZC1iMWE0LWM2MDhmYTFkMDFlOC5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoxMjQwLCJ3aXRob3V0RW5sYXJnZW1lbnQiOnRydWV9fX0="},
    { title: "김동산과 블루이웃 - 물결", src: `${process.env.PUBLIC_URL}/audio/wave.wav`, coverArt: "https://image.bugsm.co.kr/album/images/500/366018/36601838.jpg" },
    { title: "황경하 - 눈녹듯", src: `${process.env.PUBLIC_URL}/audio/sample1.mp3`, coverArt: `${process.env.PUBLIC_URL}/images/album1.jpg` },
    { title: "희우 - 그대는", src: `${process.env.PUBLIC_URL}/audio/sample2.mp3`, coverArt: `${process.env.PUBLIC_URL}/images/album2.jpg` },
    { title: "류형수 - 숨 (Vocal 김수린)", src: `${process.env.PUBLIC_URL}/audio/sample3.mp3`, coverArt: `${process.env.PUBLIC_URL}/images/album3.jpg` },
  ];

  const [currentlyPlayingTrack, setCurrentlyPlayingTrack] = useState(null);

  const handleTrackPlay = (trackSrc) => {
    setCurrentlyPlayingTrack(trackSrc);
  };

  return (
    <div className="container mx-auto px-4 py-12">
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
        {audioTracks.map((track, index) => (
          <AudioPlayer 
            key={index} 
            title={track.title} 
            audioSrc={track.src} 
            coverArt={track.coverArt}
            isCurrentlyPlaying={currentlyPlayingTrack === track.src}
            onPlay={handleTrackPlay}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default Portfolio;