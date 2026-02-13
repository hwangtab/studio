import React from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { Disc } from 'lucide-react';
import ResponsiveImage from '../ResponsiveImage';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';
import { useIsIOSSafari } from '../../utils/deviceUtils';

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
    onPlayPause: () => void;
    locale?: Locale;
}

const TrackInfo = ({ track, trackNumber, isPlaying, locale = defaultLocale }: TrackInfoProps) => {
    const { t } = useTranslation('common', { lng: locale });
    const shouldReduceMotion = useReducedMotion();
    const isIOSSafari = useIsIOSSafari();
    const shouldAnimateNowPlaying = isPlaying && !shouldReduceMotion && !isIOSSafari;
    const trackNumberLabel = trackNumber < 10 ? `0${trackNumber}` : String(trackNumber);
    return (
        <div className="flex flex-col items-center text-center">
            {/* Album Art with localized glow and rotation effect */}
            <m.div
                className="relative mb-8 group"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 transition-transform transition-colors duration-1000 ${isPlaying ? 'bg-primary scale-110' : 'bg-white/10 scale-90'
                    }`} />

                <div
                    className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-2xl border-4 border-black/50 ring-1 ring-white/10 ${shouldAnimateNowPlaying ? 'animate-spin-slow' : ''}`}
                    style={{ animationPlayState: shouldAnimateNowPlaying ? 'running' : 'paused' }}
                >
                    <ResponsiveImage
                        src={track.albumArt}
                        alt={t('audioPlayer.albumArtAlt', { title: track.title })}
                        pictureClassName="block w-full h-full"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        sizes="(max-width: 640px) 256px, 320px"
                        fill={true}
                        width={320}
                        height={320}
                    />

                    {/* Vinyl Center Hole */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-[#121212] rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center">
                            <div className="w-2 h-2 bg-gray-800 dark:bg-black rounded-full" />
                        </div>
                    </div>

                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent opacity-50 pointer-events-none" />
                </div>

                {/* Status Indicator Badge */}
                <div className="absolute bottom-0 right-4 bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2 shadow-lg z-10">
                    <div className="flex gap-[2px] items-end h-3">
                        {[...Array(3)].map((_, i) => (
                            <m.div
                                key={i}
                                animate={shouldAnimateNowPlaying ? { height: [4, 12, 4] } : { height: 4 }}
                                transition={shouldAnimateNowPlaying ? {
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                } : { duration: 0.2 }}
                                className={`w-1 rounded-full ${isPlaying ? 'bg-primary' : 'bg-gray-500'}`}
                            />
                        ))}
                    </div>
                    <span className="text-[10px] font-bold text-white/90 tracking-wider">
                        {isPlaying ? t('audioPlayer.playing') : t('audioPlayer.paused')}
                    </span>
                </div>
            </m.div>

            {/* Title & Artist */}
            <div className="w-full">
                <m.h3
                    className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight"
                    layout
                >
                    {track.title}
                </m.h3>
                <m.p
                    className="text-lg text-primary font-medium mb-6"
                    layout
                >
                    {track.artist}
                </m.p>

                <div className="flex items-center justify-center gap-2 text-xs font-mono text-gray-500 dark:text-white/40 uppercase tracking-widest border border-gray-200 dark:border-white/5 rounded-full py-1.5 px-4 mx-auto w-fit bg-gray-50 dark:bg-white/5">
                    <Disc size={12} aria-hidden="true" />
                    <span>{t('audioPlayer.highFidelity')}</span>
                    <span className="w-1 h-1 bg-gray-300 dark:bg-white/20 rounded-full mx-1" />
                    <span>{t('audioPlayer.trackLabel', { number: trackNumberLabel })}</span>
                </div>
            </div>
        </div>
    );
};

export default TrackInfo;
