import React from 'react';
import { motion } from 'framer-motion';
import { useAudioPlayer } from './useAudioPlayer';
import TrackInfo from './TrackInfo';
import ProgressBar from './ProgressBar';
import VolumeControls from './VolumeControls';
import PlayerControls from './PlayerControls';
import type { AudioTrack } from '../../types/data';

interface AudioPlayerProps {
    tracks: AudioTrack[];
    layout?: 'grid' | 'stack';
}

const AudioPlayer = ({ tracks, layout = 'grid' }: AudioPlayerProps) => {
    const {
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,
        isExpanded,
        progressBarRef,
        playPause,
        nextTrack,
        prevTrack,
        changeRange,
        changeVolume,
        toggleMute,
        toggleExpand,
        formatTime,
        progress,
        track,
    } = useAudioPlayer(tracks);

    return (
        <motion.div
            className={`bg-gradient-to-br from-primary-dark via-secondary to-accent text-white rounded-2xl shadow-2xl overflow-hidden border border-white/10 transition-all duration-500 ${isExpanded ? 'p-8' : 'p-6'}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            layout
        >
            <TrackInfo
                track={track}
                trackNumber={currentTrack + 1}
                totalTracks={tracks.length}
                isPlaying={isPlaying}
                isExpanded={isExpanded}
                onPlayPause={playPause}
                onToggleExpand={toggleExpand}
                layout={layout}
            />

            <ProgressBar
                currentTime={currentTime}
                duration={duration}
                progress={progress}
                progressBarRef={progressBarRef}
                onChangeRange={changeRange}
                formatTime={formatTime}
            />

            <div className="flex flex-col sm:grid sm:grid-cols-[auto,1fr,auto] sm:items-center gap-4">
                <VolumeControls
                    volume={volume}
                    isMuted={isMuted}
                    onToggleMute={toggleMute}
                    onChangeVolume={changeVolume}
                />

                <PlayerControls
                    isPlaying={isPlaying}
                    onPlayPause={playPause}
                    onPrevTrack={prevTrack}
                    onNextTrack={nextTrack}
                />

                <div className="flex justify-center sm:justify-end w-full sm:w-24">
                    <motion.button
                        className="text-white/80 hover:text-white p-2 rounded-full md:hidden"
                        onClick={toggleExpand}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
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
            </div>
        </motion.div>
    );
};

export default AudioPlayer;
