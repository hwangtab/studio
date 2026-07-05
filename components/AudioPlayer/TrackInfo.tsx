import React, { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { Disc } from '@/lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
import { useTranslation } from 'react-i18next';
import { defaultLocale, type Locale } from '../../lib/i18n';

// 앱의 모션 억제 정책(pages/_app.tsx MotionConfig: 터치기기=always, +OS reduce)을
// CSS·height 애니메이션에도 반영하기 위한 감지 훅.
// framer의 reducedMotion='always'는 transform(x/y/scale/rotate)만 억제하므로,
// CSS transform:rotate(animate-spin-slow LP 회전)와 height 키프레임(이퀄라이저)은 억제를 받지 못해
// 모바일·reduce 환경에서도 계속 움직인다. (OS reduce) 또는 (터치기기)일 때 true를 반환해
// 해당 장식 애니메이션을 정적으로 전환한다. 재생/일시정지 기능 로직과는 무관하다.
// SSR·첫 paint 기본값은 억제(true) — _app.tsx의 SSR reducedMotion='always'와 정합해 hydration 불일치 방지.
export const useMotionSuppressed = (): boolean => {
    const [suppressed, setSuppressed] = useState(true);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const touchMq = window.matchMedia('(hover: none) and (pointer: coarse)');
        const update = () => setSuppressed(reduceMq.matches || touchMq.matches);
        update();
        reduceMq.addEventListener('change', update);
        touchMq.addEventListener('change', update);
        return () => {
            reduceMq.removeEventListener('change', update);
            touchMq.removeEventListener('change', update);
        };
    }, []);
    return suppressed;
};

// 모션 억제 상태에서 '재생 중' 이퀄라이저를 정적으로 표시할 높이(px).
// 오르내리는 애니메이션의 한 프레임을 얼려, 모션 없이도 재생 중임을 전달한다.
export const EQUALIZER_STATIC_HEIGHTS = [8, 12, 6] as const;


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
    const motionSuppressed = useMotionSuppressed();
    // 재생 중이더라도 모션 억제(터치기기·OS reduce) 시엔 LP 회전·이퀄라이저를 멈춘다.
    const shouldAnimateNowPlaying = isPlaying && !motionSuppressed;
    const albumMotionProps = { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { duration: 0.5 } };
    const trackNumberLabel = trackNumber < 10 ? `0${trackNumber}` : String(trackNumber);
    return (
        <div className="flex flex-col items-center text-center">
            {/* Album Art with localized glow and rotation effect */}
            <m.div
                className="relative mb-8 group"
                {...albumMotionProps}
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
                        // 부모(위 div)가 relative + 고정 크기(w-64/h-64, sm:w-80/h-80 = 256/320px)라
                        // fill이 맞는 구조. width/height(320)는 fill과 동시 지정 시 next/image가
                        // 무시하고 경고하는 조합이라 제거 — sizes 값(256/320px)이 이미 실제 원
                        // 크기와 정확히 일치해 그대로 유지.
                        sizes="(max-width: 640px) 256px, 320px"
                        fill={true}
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
                                // 재생+비억제: 오르내림. 재생+억제: 정적 staggered 높이. 정지: height 4.
                                animate={shouldAnimateNowPlaying ? { height: [4, 12, 4] } : { height: isPlaying ? EQUALIZER_STATIC_HEIGHTS[i] : 4 }}
                                transition={shouldAnimateNowPlaying ? {
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                } : { duration: motionSuppressed ? 0 : 0.2 }}
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
