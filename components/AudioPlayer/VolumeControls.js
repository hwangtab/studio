import React from 'react';
import { motion } from 'framer-motion';
import { FaVolumeUp, FaVolumeMute } from 'react-icons/fa';

const VolumeControls = ({ volume, isMuted, onToggleMute, onChangeVolume }) => {
    return (
        <div className="flex items-center justify-center sm:justify-start space-x-2">
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleMute}
                className="text-white/80 hover:text-white transition-colors p-2"
                aria-label={isMuted ? "음소거 해제" : "음소거"}
            >
                {isMuted ? <FaVolumeMute className="text-xl" /> : <FaVolumeUp className="text-xl" />}
            </motion.button>
            <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden hidden sm:block relative">
                <div
                    className="absolute top-0 left-0 h-full w-full bg-transparent rounded-full"
                    onClick={onChangeVolume}
                ></div>
                <div
                    className="absolute top-0 left-0 h-full bg-white rounded-full"
                    style={{ width: `${volume * 100}%` }}
                    onClick={onChangeVolume}
                ></div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={onChangeVolume}
                    className="w-full h-full appearance-none bg-transparent opacity-0 absolute cursor-pointer z-10"
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
                    style={{ left: `calc(${volume * 100}% - 6px)` }}
                ></div>
            </div>
        </div>
    );
};

export default VolumeControls;
