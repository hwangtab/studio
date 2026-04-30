import React from 'react';
import { m } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface PlayerControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onPrevTrack: () => void;
    onNextTrack: () => void;
    locale?: Locale;
}

const PlayerControls = ({
    isPlaying,
    onPlayPause,
    onPrevTrack,
    onNextTrack,
    locale = defaultLocale,
}: PlayerControlsProps) => {
    const { t } = useTranslation('common', { lng: locale });
    return (
        <div className="flex items-center justify-center gap-6">
            <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPrevTrack}
                className="text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 p-2 min-h-[44px] min-w-[44px] touch-manipulation hover:bg-ink/[0.06] dark:hover:bg-white/[0.06] rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep"
                aria-label={t('audioPlayer.prevTrack')}
            >
                <SkipBack size={24} strokeWidth={2} aria-hidden="true" />
            </m.button>

            <m.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayPause}
                className="group relative bg-ink text-white dark:bg-white dark:text-ink rounded-pill p-6 min-h-[56px] min-w-[56px] shadow-card-hover transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep"
                aria-label={isPlaying ? t('audioPlayer.pause') : t('audioPlayer.play')}
            >
                <div className="absolute inset-0 rounded-full border border-gray-900/50 dark:border-white/50 opacity-0 group-hover:opacity-100 animate-ping-slow" />
                <div className="relative z-10 flex items-center justify-center">
                    {isPlaying ? (
                        <Pause size={28} fill="currentColor" className="ml-[1px]" aria-hidden="true" />
                    ) : (
                        <Play size={28} fill="currentColor" className="ml-1" aria-hidden="true" />
                    )}
                </div>
            </m.button>

            <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onNextTrack}
                className="text-ink-muted-60 hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark transition-colors duration-300 p-2 min-h-[44px] min-w-[44px] touch-manipulation hover:bg-ink/[0.06] dark:hover:bg-white/[0.06] rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep"
                aria-label={t('audioPlayer.nextTrack')}
            >
                <SkipForward size={24} strokeWidth={2} aria-hidden="true" />
            </m.button>
        </div>
    );
};

export default PlayerControls;
