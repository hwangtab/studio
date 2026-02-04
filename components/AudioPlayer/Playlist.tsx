import React from 'react';
import { motion } from 'framer-motion';
import { Play, BarChart2 } from 'lucide-react';
import type { AudioTrack } from '../../types/data';

interface PlaylistProps {
    tracks: readonly AudioTrack[];
    currentTrackIndex: number;
    isPlaying: boolean;
    onSelectTrack: (index: number) => void;
}

const Playlist = ({ tracks, currentTrackIndex, isPlaying, onSelectTrack }: PlaylistProps) => {
    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-gray-500 dark:text-white/60 text-xs font-bold uppercase tracking-wider mb-4 px-2">
                Playlist ({tracks.length})
            </h3>
            <div className="space-y-2">
                {tracks.map((track, index) => {
                    const isActive = currentTrackIndex === index;

                    return (
                        <motion.div
                            key={track.id}
                            initial={false}
                            animate={{
                                backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(0, 0, 0, 0)',
                            }}
                            whileHover={{ backgroundColor: 'rgba(var(--primary-rgb), 0.05)' }}
                            className={`group flex items-center p-3 rounded-lg cursor-pointer transition-colors border border-transparent ${isActive ? 'border-primary/30' : 'hover:border-gray-200 dark:hover:border-white/5'
                                }`}
                            onClick={() => onSelectTrack(index)}
                        >
                            <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 mr-4 shadow-sm">
                                <img
                                    src={track.albumArt}
                                    alt={track.title}
                                    className={`w-full h-full object-cover transition-all duration-300 ${isActive && isPlaying ? 'scale-110' : ''}`}
                                />
                                {isActive && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        {isPlaying ? (
                                            <div className="flex space-x-[2px] items-end h-3">
                                                <motion.div
                                                    animate={{ height: [4, 12, 6, 12, 4] }}
                                                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                                                    className="w-[2px] bg-primary rounded-full"
                                                />
                                                <motion.div
                                                    animate={{ height: [8, 4, 12, 5, 8] }}
                                                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                                    className="w-[2px] bg-primary rounded-full"
                                                />
                                                <motion.div
                                                    animate={{ height: [5, 10, 5, 10, 5] }}
                                                    transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                                                    className="w-[2px] bg-primary rounded-full"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-2 h-2 bg-primary rounded-full" />
                                        )}
                                    </div>
                                )}
                                {!isActive && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Play size={12} className="text-white fill-current" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                    {track.title}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                                    {track.artist}
                                </p>
                            </div>

                            <div className="text-xs text-gray-400 dark:text-white/40 font-mono ml-2">
                                {track.duration}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default Playlist;
