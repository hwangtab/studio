import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface VolumeControlsProps {
    volume: number;
    isMuted: boolean;
    onToggleMute: () => void;
    onChangeVolume: (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLDivElement>) => void;
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
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={onToggleMute}
                className="text-gray-400 hover:text-gray-900 dark:text-white/80 dark:hover:text-white transition-colors p-2"
                aria-label={isMuted ? t('audioPlayer.unmute') : t('audioPlayer.mute')}
            >
                {isMuted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </motion.button>
            <div className="w-20 h-2 bg-gray-200 dark:bg-white/20 rounded-full overflow-hidden hidden sm:block relative">
                <div
                    className="absolute top-0 left-0 h-full w-full bg-transparent rounded-full"
                    onClick={onChangeVolume}
                ></div>
                <div
                    className="absolute top-0 left-0 h-full bg-gray-800 dark:bg-white rounded-full"
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
                    aria-label="Volume"
                    className="w-full h-full appearance-none bg-transparent opacity-0 absolute cursor-pointer z-10"
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-800 dark:bg-white rounded-full shadow-md pointer-events-none"
                    style={{ left: `calc(${volume * 100}% - 6px)` }}
                ></div>
            </div>
        </div>
    );
};

export default VolumeControls;
