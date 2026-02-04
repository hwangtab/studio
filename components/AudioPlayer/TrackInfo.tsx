import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Disc } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage';

interface Track {
    id: string;
    title: string;
    artist: string;
    src: string;
    albumArt: string;
    duration: string;
    featured: boolean;
    description: string;
}

interface TrackInfoProps {
    track: Track;
    trackNumber: number;
    totalTracks: number;
    isPlaying: boolean;
    isExpanded: boolean;
    onPlayPause: () => void;
    onToggleExpand: () => void;
    layout?: 'grid' | 'stack';
}

const TrackInfo = ({ track, trackNumber, totalTracks, isPlaying, onPlayPause }: TrackInfoProps) => {
    return (
        <div className="flex flex-col items-center text-center">
            {/* Album Art with localized glow and rotation effect */}
            <motion.div
                className="relative mb-8 group"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-1000 ${isPlaying ? 'bg-primary scale-110' : 'bg-white/10 scale-90'
                    }`} />

                <div
                    className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden shadow-2xl border-4 border-black/50 ring-1 ring-white/10 ${isPlaying ? 'animate-spin-slow' : ''}`}
                    style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                >
                    <ResponsiveImage
                        src={track.albumArt}
                        alt={`${track.title} 앨범 아트`}
                        pictureClassName="block w-full h-full"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        sizes="(max-width: 640px) 192px, 256px"
                        fill={true}
                        width={256}
                        height={256}
                    />

                    {/* Vinyl Center Hole */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-[#121212] rounded-full border border-white/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-black rounded-full" />
                        </div>
                    </div>

                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent opacity-50 pointer-events-none" />
                </div>

                {/* Status Indicator Badge */}
                <div className="absolute bottom-0 right-4 bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-10">
                    <div className="flex gap-[2px] items-end h-3">
                        {[...Array(3)].map((_, i) => (
                            <motion.div
                                key={i}
                                animate={isPlaying ? { height: [4, 12, 4] } : { height: 4 }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                }}
                                className={`w-1 rounded-full ${isPlaying ? 'bg-primary' : 'bg-gray-500'}`}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] font-bold text-white/90 tracking-wider">
                        {isPlaying ? 'PLAYING' : 'PAUSED'}
                    </span>
                </div>
            </motion.div>

            {/* Title & Artist */}
            <div className="w-full">
                <motion.h3
                    className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight"
                    layout
                >
                    {track.title}
                </motion.h3>
                <motion.p
                    className="text-lg text-primary font-medium mb-6"
                    layout
                >
                    {track.artist}
                </motion.p>

                <div className="flex items-center justify-center gap-2 text-xs font-mono text-white/40 uppercase tracking-widest border border-white/5 rounded-full py-1.5 px-4 mx-auto w-fit bg-white/5">
                    <Disc size={12} />
                    <span>High Fidelity Audio</span>
                    <span className="w-1 h-1 bg-white/20 rounded-full mx-1" />
                    <span>Track {trackNumber < 10 ? `0${trackNumber}` : trackNumber}</span>
                </div>
            </div>
        </div>
    );
};

export default TrackInfo;
