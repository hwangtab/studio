import React from 'react';
import { m } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface VolumeControlsProps {
    volume: number;
    isMuted: boolean;
    onToggleMute: () => void;
    onChangeVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
    locale?: Locale;
}

const VolumeControls = ({
    volume,
    isMuted,
    onToggleMute,
    onChangeVolume,
    locale = defaultLocale,
}: VolumeControlsProps) => {
    const { t } = useTranslation('common', { lng: locale });
    return (
        <div className="flex items-center justify-center sm:justify-start space-x-2">
            <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleMute}
                className="text-ink-muted-40 hover:text-ink dark:text-white/80 dark:hover:text-white transition-colors p-2 min-h-[44px] min-w-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep"
                aria-label={isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')}
            >
                {isMuted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </m.button>
            <div className="w-20 h-2 bg-ink/[0.1] dark:bg-white/20 rounded-full overflow-hidden hidden sm:block relative group">
                <div
                    className="absolute top-0 left-0 h-full bg-ink dark:bg-white rounded-full"
                    style={{ width: `${volume * 100}%` }}
                ></div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={onChangeVolume}
                    aria-label={t('audioPlayer.volume')}
                    className="w-full h-full appearance-none bg-transparent opacity-0 absolute cursor-pointer z-10 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 rounded-full"
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-ink dark:bg-white rounded-full shadow-md pointer-events-none opacity-80 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    style={{ left: `calc(${volume * 100}% - 6px)` }}
                ></div>
            </div>
        </div>
    );
};

export default VolumeControls;
