import React from 'react';
import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from './useAudioPlayer';
import TrackInfo from './TrackInfo';
import ProgressBar from './ProgressBar';
import VolumeControls from './VolumeControls';
import PlayerControls from './PlayerControls';
import Playlist from './Playlist';
import type { AudioTrack } from '../../types/data';
import { FADE_IN_UP } from '../../utils/animationUtils';
import { defaultLocale, type Locale } from '../../lib/i18n';


interface AudioPlayerProps {
    tracks: readonly AudioTrack[];
    locale?: Locale;
}

const AudioPlayer = ({ tracks, locale = defaultLocale }: AudioPlayerProps) => {
    const audioPlayerMotionProps = FADE_IN_UP;
    const { t } = useTranslation('common', { lng: locale });

    const {
        currentTrack,
        isPlaying,
        duration,
        currentTime,
        volume,
        isMuted,
        progressBarRef,
        playPause,
        nextTrack,
        prevTrack,
        selectTrack,
        changeRange,
        startSeeking,
        endSeeking,
        changeVolume,
        toggleMute,
        formatTime,
        progress,
        track,
    } = useAudioPlayer(tracks);

    // 데스크탑에서는 항상 확장된 뷰처럼 보이게 하되, 모바일에서는 토글 지원
    // 하지만 이번 디자인은 플레이리스트를 옆에 붙이는 형태이므로
    // 모바일에서는 플레이리스트를 하단에 배치하거나 탭으로 처리하는 것이 좋음.
    // 여기서는 반응형 그리드 레이아웃을 사용.

    return (
        <m.div
            className="bg-white dark:bg-[#121212] overflow-hidden rounded-3xl shadow-xl dark:shadow-2xl border border-gray-200 dark:border-white/5 relative"
            {...audioPlayerMotionProps}
        >
            {/* Background Atmosphere (Dark Mode Only) */}
            <div className="hidden dark:block absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-50%] left-[-20%] w-[70%] h-[70%] rounded-full bg-primary/20 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-secondary/20 blur-[100px]" />
            </div>

            <div className="relative z-10 grid lg:grid-cols-[1.2fr,1fr] gap-0">
                {/* Left Side: Player Main */}
                {/* backdrop-blur 제거(2026-07-20): 이 패널 뒤는 자체 atmosphere 그라디언트뿐
                    이라 블러가 시각 변화 없이 400px급 GPU 레이어만 만든다. blur 예산은
                    fixed/sticky 레이어 전용 — TrackInfo의 앨범아트 위 배지만 유지. */}
                <div className="p-8 lg:p-10 flex flex-col justify-between min-h-[400px] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-white/5">
                    <div className="flex-1 flex flex-col justify-center">
                        <TrackInfo
                            track={track}
                            trackNumber={currentTrack + 1}
                            totalTracks={tracks.length}
                            isPlaying={isPlaying}
                            onPlayPause={playPause}
                            locale={locale}
                        />
                    </div>

                    <div className="mt-8">
                        <ProgressBar
                            currentTime={currentTime}
                            duration={duration}
                            progress={progress}
                            progressBarRef={progressBarRef}
                            onChangeRange={changeRange}
                            onSeekStart={startSeeking}
                            onSeekEnd={endSeeking}
                            formatTime={formatTime}
                            ariaLabel={t('audioPlayer.playbackProgress')}
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-6">
                            <PlayerControls
                                isPlaying={isPlaying}
                                onPlayPause={playPause}
                                onPrevTrack={prevTrack}
                                onNextTrack={nextTrack}
                                locale={locale}
                            />

                            <VolumeControls
                                volume={volume}
                                isMuted={isMuted}
                                onToggleMute={toggleMute}
                                onChangeVolume={changeVolume}
                                locale={locale}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Side: Playlist */}
                <div className="bg-gray-50 dark:bg-black/20 p-6 lg:p-8 h-full min-h-[400px] flex flex-col border-l border-gray-100 dark:border-white/5">
                    <Playlist
                        tracks={tracks}
                        currentTrackIndex={currentTrack}
                        isPlaying={isPlaying}
                        onSelectTrack={selectTrack}
                        locale={locale}
                    />
                </div>
            </div>
        </m.div>
    );
};

export default AudioPlayer;
