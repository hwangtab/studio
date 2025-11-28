import React from 'react';
import { motion } from 'framer-motion';
import { FaPlay, FaPause, FaBackward, FaForward } from 'react-icons/fa';

const PlayerControls = ({ isPlaying, onPlayPause, onPrevTrack, onNextTrack }) => {
    return (
        <div className="flex items-center justify-center space-x-4">
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPrevTrack}
                className="text-white/80 hover:text-white transition-colors p-2"
                aria-label="이전 트랙"
            >
                <FaBackward className="text-xl" />
            </motion.button>

            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onPlayPause}
                className="bg-gradient-to-r from-primary to-secondary text-white p-5 rounded-full shadow-lg hover:shadow-xl transition-all"
                aria-label={isPlaying ? "일시정지" : "재생"}
            >
                {isPlaying ? <FaPause className="text-2xl" /> : <FaPlay className="text-2xl ml-1" />}
            </motion.button>

            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNextTrack}
                className="text-white/80 hover:text-white transition-colors p-2"
                aria-label="다음 트랙"
            >
                <FaForward className="text-xl" />
            </motion.button>
        </div>
    );
};

export default PlayerControls;
