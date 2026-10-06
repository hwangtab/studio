import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from '@/lib/lucide-icons';
import { useGlobalPlayer, type GlobalTrack } from './GlobalPlayerProvider';

interface CoverPlayButtonProps {
  track: GlobalTrack;
  /** 커버 컨테이너(relative) 안에서의 위치. 기본은 오른쪽 아래. */
  className?: string;
}

/**
 * 커버 위 재생 버튼(라이너 노트 §3-6 c). 홈 커버 그리드·포트폴리오 그리드에서 발췌가 있는 커버에만 붙는다.
 *
 * 링크(<a>) 안에 버튼을 넣으면 HTML이 깨지므로(인터랙티브 안 인터랙티브) 이 버튼은 링크의 **형제**로, 커버
 * 컨테이너 위에 absolute로 놓는다 — 호출부는 컨테이너를 `relative`로 둔다. 44px 터치 타깃, 포커스 링.
 */
const CoverPlayButton = ({ track, className = 'absolute bottom-2 right-2' }: CoverPlayButtonProps) => {
  const { play, pause, isPlaying } = useGlobalPlayer();
  const { t } = useTranslation('common', { lng: track.locale });
  const playing = isPlaying(track.id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (playing) pause();
        else void play(track);
      }}
      aria-label={`${playing ? t('audioPlayer.pause', { defaultValue: '일시정지' }) : t('audioPlayer.global.listen', { defaultValue: '30초 듣기' })}: ${track.title}`}
      aria-pressed={playing}
      className={`${className} z-10 grid h-11 w-11 place-items-center rounded-full bg-gray-950/80 text-white shadow-md backdrop-blur-sm transition-colors duration-fast hover:bg-primary-lighter hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950/60`}
    >
      {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} className="ml-0.5" aria-hidden="true" />}
    </button>
  );
};

export default CoverPlayButton;
