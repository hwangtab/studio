import React from 'react';
import Image from 'next/image';
import { m } from 'framer-motion';
import { Play } from '@/lib/lucide-icons';
import type { AudioTrack } from '../../types/data';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';
// TrackInfo가 소유한 모션 억제 감지 훅·정적 높이를 공유(AudioPlayer 모듈 내 단일 출처).
import { useMotionSuppressed, EQUALIZER_STATIC_HEIGHTS } from './TrackInfo';

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
    // 터치기기·OS reduce 시 재생 중 이퀄라이저 바를 정적으로(무한 height 애니메이션 억제).
    const motionSuppressed = useMotionSuppressed();
    return (
        <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
            <h3 className="text-gray-500 dark:text-white/60 text-xs font-bold uppercase tracking-wider mb-4 px-2">
                {t('audioPlayer.playlist')} ({tracks.length})
            </h3>
            <div className="space-y-2">
                {tracks.map((track, index) => {
                    const isActive = currentTrackIndex === index;

                    return (
                        <m.button
                            key={track.id}
                            initial={false}
                            animate={{
                                backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(0, 0, 0, 0)',
                            }}
                            whileHover={{
                                backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--primary-rgb), 0.05)'
                            }}
                            type="button"
                            className={`group w-full text-left flex items-center p-3 min-h-[44px] rounded-lg cursor-pointer transition-[border-color] duration-300 border border-transparent touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${isActive ? 'border-primary/30' : 'hover:border-gray-200 dark:hover:border-white/5'
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
                                    // sizes 없이 width/height만 있으면 next/image가 DPR 기반(1x/2x) 후보만
                                    // 만들어 sizes를 무시한다. 40px 표시엔 원래도 64w(1x)가 선택되지만
                                    // (imageSizes 32→64 간극상 40px가 32보다 커서 64w가 최소 충족값 —
                                    // config 변경 없인 더 못 낮춤), sizes 명시로 2x/3x 후보가 96/128w로
                                    // 정확히 매핑되어 고DPR 기기 화질이 개선된다. 40px 썸네일은 화질
                                    // 저하가 육안으로 보이지 않아 quality도 60(next.config qualities에
                                    // 이미 포함된 값)으로 낮춰 다운로드 용량을 추가로 줄인다.
                                    sizes="40px"
                                    quality={60}
                                    className={`w-full h-full object-cover transition-transform duration-300 ${isActive && isPlaying ? 'scale-110' : ''}`}
                                />
                                {isActive && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        {isPlaying ? (
                                            <div className="flex space-x-[2px] items-end h-3">
                                                <m.div
                                                    animate={motionSuppressed ? { height: EQUALIZER_STATIC_HEIGHTS[0] } : { height: [4, 12, 6, 12, 4] }}
                                                    transition={motionSuppressed ? { duration: 0 } : { repeat: Infinity, duration: 1.2, ease: "linear" }}
                                                    className="w-[2px] bg-primary rounded-full"
                                                />
                                                <m.div
                                                    animate={motionSuppressed ? { height: EQUALIZER_STATIC_HEIGHTS[1] } : { height: [8, 4, 12, 5, 8] }}
                                                    transition={motionSuppressed ? { duration: 0 } : { repeat: Infinity, duration: 1.5, ease: "linear" }}
                                                    className="w-[2px] bg-primary rounded-full"
                                                />
                                                <m.div
                                                    animate={motionSuppressed ? { height: EQUALIZER_STATIC_HEIGHTS[2] } : { height: [5, 10, 5, 10, 5] }}
                                                    transition={motionSuppressed ? { duration: 0 } : { repeat: Infinity, duration: 1.0, ease: "linear" }}
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
                                        <Play size={12} className="text-white fill-current" aria-hidden="true" />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-gray-900 dark:text-white'}`} title={track.title}>
                                    {track.title}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-white/50 truncate" title={track.artist}>
                                    {track.artist}
                                </p>
                            </div>

                            <div className="text-xs text-gray-600 dark:text-white/60 font-mono ml-2">
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
