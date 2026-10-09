import React from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from '@/lib/lucide-icons';
import { useGlobalPlayer, type GlobalTrack } from '../audio/GlobalPlayerProvider';
import type { AudioTrack } from '../../types/data';
import type { Locale } from '../../lib/i18n';
import { BUTTON_PRESS } from '../ui/buttonPress';

interface PortfolioSampleTracksProps {
  locale: Locale;
  tracks: readonly AudioTrack[];
}

/**
 * 포트폴리오 샘플 트랙(라이너 노트 §3-6). 회전하는 LP판·볼륨·플레이리스트 패널(옛 components/AudioPlayer)을 걷고,
 * 글로벌 미니 플레이어로 트는 세 줄 — 페이지를 옮겨도 이어진다. 재생 전 0바이트(Provider 규칙).
 */
const PortfolioSampleTracks = ({ locale, tracks }: PortfolioSampleTracksProps) => {
  const { play, pause, isPlaying } = useGlobalPlayer();
  const { t } = useTranslation('common', { lng: locale });
  return (
    <ol className="divide-y divide-gray-200 dark:divide-gray-800 border-y border-gray-200 dark:border-gray-800">
      {tracks.map((track, i) => {
        const global: GlobalTrack = {
          id: track.id,
          src: track.src,
          title: `${track.artist} — ${track.title}`,
          subtitle: track.description,
          cover: track.albumArt,
          component: 'PortfolioTracks',
          locale,
        };
        const playing = isPlaying(track.id);
        return (
          <li key={track.id} className="flex items-center gap-4 py-4">
            <span aria-hidden="true" className="w-6 text-sm font-semibold tabular-nums text-gray-600 dark:text-gray-300">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
              <Image src={track.albumArt} alt="" fill sizes="56px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-title text-base font-bold text-gray-950 dark:text-white">{track.title}</p>
              <p className="truncate text-sm text-gray-600 dark:text-gray-300">{track.artist}</p>
            </div>
            <span className="hidden sm:block text-sm tabular-nums text-gray-500 dark:text-gray-400">{track.duration}</span>
            <button
              type="button"
              onClick={() => (playing ? pause() : void play(global))}
              aria-label={`${playing ? t('audioPlayer.pause', { defaultValue: '일시정지' }) : t('audioPlayer.play', { defaultValue: '재생' })}: ${track.artist} — ${track.title}`}
              aria-pressed={playing}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white hover:bg-primary-dark transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${BUTTON_PRESS}`}
            >
              {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} className="ml-0.5" aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default PortfolioSampleTracks;
