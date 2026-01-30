import React from 'react';
import { motion } from 'framer-motion';
import { Headphones } from 'lucide-react';
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

const TrackInfo = ({ track, trackNumber, totalTracks, isPlaying, isExpanded, onPlayPause, onToggleExpand, layout }: TrackInfoProps) => {
    const isStack = layout === 'stack';

    return (
        <div className={`flex flex-col ${isStack ? '' : 'md:flex-row'} items-center mb-6`}>
            <motion.div
                className={`relative rounded-xl shadow-lg overflow-hidden mb-6 ${isStack ? '' : 'md:mb-0 md:mr-8'} transition-all duration-300 ${isExpanded ? 'w-48 h-48' : 'w-36 h-36'}`}
                layout
            >
                <ResponsiveImage
                    src={track.albumArt}
                    alt={`${track.title} 앨범 아트`}
                    pictureClassName="block w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    loading="lazy"
                    sizes="160px"
                    fill={true}
                    width={160}
                    height={160}
                />
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
                <div
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={onPlayPause}
                >
                    <div className="bg-white/20 backdrop-blur-md p-4 rounded-full will-change-transform [transform:translateZ(0)] [-webkit-transform:translateZ(0)]">
                        {isPlaying ? (
                            <svg className="text-white text-2xl" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg className="text-white text-2xl ml-1" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </div>
                </div>
            </motion.div>

            <div className="text-center md:text-left flex-1">
                <motion.h3 className="typo-card-title text-white mb-2" layout>
                    {track.title}
                </motion.h3>
                <motion.div className="flex items-center justify-center md:justify-start mb-4 text-white/80" layout>
                    <Headphones className="mr-2 text-white" size={18} />
                    <span>트랙 {trackNumber} / {totalTracks}</span>
                </motion.div>

                {isExpanded && (
                    <motion.div
                        className="typo-card-body text-white/80 mb-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <p>스튜디오 놀에서 녹음 및 믹싱한 트랙입니다.</p>
                        <p className="mt-2">고품질 오디오로 즐겨보세요.</p>
                    </motion.div>
                )}
            </div>

            <motion.button
                className="text-white/80 hover:text-white p-2 rounded-full self-start hidden md:block"
                onClick={onToggleExpand}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                layout
                aria-label={isExpanded ? "플레이어 축소" : "플레이어 확장"}
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
    );
};

export default TrackInfo;
