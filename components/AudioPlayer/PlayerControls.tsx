import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface PlayerControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onPrevTrack: () => void;
    onNextTrack: () => void;
}

const PlayerControls = ({ isPlaying, onPlayPause, onPrevTrack, onNextTrack }: PlayerControlsProps) => {
    return (
        <div className="flex items-center justify-center gap-6">
            <motion.button
                whileHover={{ scale: 1.1, color: '#fff' }}
                whileTap={{ scale: 0.95 }}
                onClick={onPrevTrack}
                className="text-white/60 hover:text-white transition-all duration-300 p-2"
                aria-label="이전 트랙"
            >
                <SkipBack size={24} strokeWidth={2} />
            </motion.button>

            <motion.button
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(var(--primary-rgb), 0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayPause}
                className="group relative bg-white text-black rounded-full p-6 shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-300"
                aria-label={isPlaying ? "일시정지" : "재생"}
            >
                <div className="absolute inset-0 rounded-full border border-white/50 animate-ping-slow opacity-0 group-hover:opacity-100" />
                <div className="relative z-10 flex items-center justify-center">
                    {isPlaying ? (
                        <Pause size={28} fill="currentColor" className="ml-[1px]" />
                    ) : (
                        <Play size={28} fill="currentColor" className="ml-1" />
                    )}
                </div>
            </motion.button>

            <motion.button
                whileHover={{ scale: 1.1, color: '#fff' }}
                whileTap={{ scale: 0.95 }}
                onClick={onNextTrack}
                className="text-white/60 hover:text-white transition-all duration-300 p-2"
                aria-label="다음 트랙"
            >
                <SkipForward size={24} strokeWidth={2} />
            </motion.button>
        </div>
    );
};

export default PlayerControls;
