import React from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Pause, Play } from '@/lib/lucide-icons';
import { useGlobalPlayer } from './GlobalPlayerProvider';
import { getExcerptForService, toGlobalTrack, type ExcerptService } from '../../data/audioExcerpts';
import type { Locale } from '../../lib/i18n';

interface ServiceExcerptProps {
  locale: Locale;
  service: ExcerptService;
  /** GA4 component — 어느 LP의 발췌 줄인지. */
  component: string;
  className?: string;
}

/**
 * LP의 30초 발췌 한 줄(라이너 노트 §3-6 b). 절이 아니라 **기존 절 안의 블록**이다 — 절을 끼우면 아래 절들의
 * 배경 번갈음이 뒤집힌다(믹싱 비교 블록과 같은 규칙, CLAUDE.md). 그 서비스에 발췌가 없으면 아무것도 그리지 않는다.
 * 재생은 글로벌 플레이어로 — 페이지를 옮겨도 이어진다.
 */
const ServiceExcerpt = ({ locale, service, component, className = '' }: ServiceExcerptProps) => {
  const excerpt = getExcerptForService(service);
  const { play, pause, isPlaying } = useGlobalPlayer();
  const { t } = useTranslation('common', { lng: locale });
  if (!excerpt) return null;
  const track = toGlobalTrack(excerpt, locale, component);
  const playing = isPlaying(track.id);
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40 ${className}`}>
      {excerpt.cover && (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
          <Image src={excerpt.cover} alt="" fill sizes="56px" className="object-cover" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="typo-eyebrow !text-xs">{t('audioPlayer.global.excerptTitle', { defaultValue: '스튜디오 놀에서 녹음·믹싱한 30초' })}</p>
        <p className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">{track.title}</p>
        {track.subtitle && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{track.subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={() => (playing ? pause() : void play(track))}
        aria-label={`${playing ? t('audioPlayer.pause', { defaultValue: '일시정지' }) : t('audioPlayer.global.listen', { defaultValue: '30초 듣기' })}: ${track.title}`}
        aria-pressed={playing}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} className="ml-0.5" aria-hidden="true" />}
      </button>
    </div>
  );
};

export default ServiceExcerpt;
