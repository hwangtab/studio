import React from 'react';
import Image from 'next/image';
import { m } from 'framer-motion';
import { Play } from 'lucide-react';
import type { AudioTrack } from '../../types/data';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

const EQ_BARS = [
  { animate: { height: [4, 12, 6, 12, 4] }, transition: { repeat: Infinity, duration: 1.2, ease: 'linear' as const } },
  { animate: { height: [8, 4, 12, 5, 8] },  transition: { repeat: Infinity, duration: 1.5, ease: 'linear' as const } },
  { animate: { height: [5, 10, 5, 10, 5] }, transition: { repeat: Infinity, duration: 1.0, ease: 'linear' as const } },
];

interface PlaylistProps {
    tracks: readonly AudioTrack[];
    currentTrackIndex: number;
    isPlaying: boolean;
    onSelectTrack: (index: number) => void;
    locale?: Locale;
}

const Playlist = ({
    tracks,
    currentTrackIndex,
    isPlaying,
    onSelectTrack,
    locale = defaultLocale,
}: PlaylistProps) => {
    const { t } = useTranslation('common', { lng: locale });
    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-ink-muted-60 dark:text-on-dark-soft text-xs font-bold uppercase tracking-wider mb-4 px-2">
                {t('audioPlayer.playlist')} ({tracks.length})
            </h3>
            <div className="space-y-2">
                {tracks.map((track, index) => {
                    const isActive = currentTrackIndex === index;

                    return (
                        <m.button
                            key={track.id}
                            initial={false}
                            type="button"
                            className={`group w-full text-left flex items-center p-3 min-h-[44px] rounded-lg cursor-pointer transition-[background-color,border-color] duration-300 border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep ${isActive ? 'bg-ink/[0.06] dark:bg-white/[0.06] border-hairline dark:border-white/10' : 'border-transparent hover:bg-ink/[0.04] dark:hover:bg-white/[0.04] hover:border-hairline dark:hover:border-white/10'
                                }`}
                            onClick={() => onSelectTrack(index)}
                            aria-pressed={isActive}
                        >
                            <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0 mr-4 shadow-sm">
                                <Image
                                    src={track.albumArt}
                                    alt={t('audioPlayer.albumArtAlt', { title: track.title })}
                                    width={40}
                                    height={40}
                                    className={`w-full h-full object-cover transition-transform duration-300 ${isActive && isPlaying ? 'scale-110' : ''}`}
                                />
                                {isActive && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        {isPlaying ? (
                                            <div className="flex space-x-[2px] items-end h-3">
                                                {EQ_BARS.map((bar, i) => (
                                                    <m.div
                                                        key={i}
                                                        animate={bar.animate}
                                                        transition={bar.transition}
                                                        className="w-[2px] bg-white rounded-full"
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="w-2 h-2 bg-white rounded-full" />
                                        )}
                                    </div>
                                )}
                                {!isActive && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Play size={12} className="text-white fill-current" aria-hidden="true" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-medium truncate ${isActive ? 'text-ink dark:text-on-dark font-semibold' : 'text-ink dark:text-on-dark'}`} title={track.title}>
                                    {track.title}
                                </h4>
                                <p className="text-xs text-ink-muted-60 dark:text-on-dark-soft truncate" title={track.artist}>
                                    {track.artist}
                                </p>
                            </div>

                            <div className="text-xs text-ink-muted-60 dark:text-on-dark-soft font-mono ml-2">
                                {track.duration}
                            </div>
                        </m.button>
                    );
                })}
            </div>
        </div>
    );
};

export default Playlist;
