import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaForward, FaBackward } from 'react-icons/fa';

const PortfolioItem = ({ image, title, description }) => (
  <motion.div
    className="bg-white rounded-lg shadow-lg overflow-hidden"
    whileHover={{ y: -5 }}
  >
    <img src={image} alt={title} className="w-full h-48 object-cover" />
    <div className="p-4">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </motion.div>
);

const AudioPlayer = ({ tracks }) => {
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(new Audio(tracks[0].src));

  useEffect(() => {
    audioRef.current.src = tracks[currentTrack].src;
    if (isPlaying) {
      audioRef.current.play();
    }
  }, [currentTrack, tracks]);

  useEffect(() => {
    if (isPlaying) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  const playPause = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % tracks.length);
  };

  const prevTrack = () => {
    setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <h3 className="text-lg font-bold mb-2">{tracks[currentTrack].title}</h3>
      <div className="flex justify-center items-center space-x-4">
        <motion.button whileTap={{ scale: 0.95 }} onClick={prevTrack}>
          <FaBackward className="text-primary" />
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={playPause}>
          {isPlaying ? <FaPause className="text-primary text-2xl" /> : <FaPlay className="text-primary text-2xl" />}
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={nextTrack}>
          <FaForward className="text-primary" />
        </motion.button>
      </div>
    </div>
  );
};

const Portfolio = () => {
  const getImagePath = (imageName) => `${process.env.PUBLIC_URL}/images/${imageName}`;

  const portfolioItems = [
    { image: getImagePath("portfolio1.jpg"), title: "희우 <그대는>", description: "녹음, 믹싱, 마스터링" },
    { image: getImagePath("portfolio2.jpg"), title: "남자애 <해방>", description: "녹음, 믹싱, 마스터링" },
    { image: getImagePath("portfolio3.jpg"), title: "류형수 <하루>", description: "음반기획, 녹음, 믹싱" },
    { image: getImagePath("portfolio4.jpg"), title: "강호중 <Self-titled>", description: "음반기획, 녹음, 믹싱" },
    { image: getImagePath("portfolio5.jpg"), title: "옴니버스 앨범 <물고기는 물이 없으면 죽어요>", description: "음반기획, 녹음, 믹싱, 마스터링" },
    { image: getImagePath("portfolio6.jpg"), title: "<발쾌한> CM송", description: "녹음, 믹싱, 마스터링" },
  ];

  const audioTracks = [
    { title: "황경하 <눈녹듯>", src: `${process.env.PUBLIC_URL}/audio/sample1.mp3` },
    { title: "희우 <그대는>", src: `${process.env.PUBLIC_URL}/audio/sample2.mp3` },
    { title: "류형수 <숨> (Vocal 김수린)", src: `${process.env.PUBLIC_URL}/audio/sample3.mp3` },
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
          <PortfolioItem key={index} {...item} />
        ))}
      </div>
      <motion.div
        className="mb-12"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-5xl pt-6 font-title mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-primary-dark via-secondary to-accent">샘플 트랙</h2>
        <AudioPlayer tracks={audioTracks} />
      </motion.div>
    </div>
  );
};

export default Portfolio;