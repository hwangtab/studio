import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Pause, Play, X } from '@/lib/lucide-icons';
import { useGlobalPlayer } from './GlobalPlayerProvider';

/**
 * 글로벌 미니 플레이어의 화면(라이너 노트 §3-6). 상태는 GlobalPlayerProvider가 갖고, 이 파일은 그리기만 한다.
 *
 * - 데스크톱: 왼쪽 아래 도킹 카드(오른쪽 아래는 카카오 FAB·맨 위로 행이 쓴다 — components/Layout.tsx).
 * - 모바일: 바닥 전폭 바. 전폭 하단 고정 바가 이미 있는 화면(스토리 상세 StickyBottomCTA, 펀딩·공연 상세
 *   MobileStickyCta, 펀딩 결제·예약 마법사)에서는 모바일 바를 숨긴다 — 두 바가 겹치면 둘 다 못 쓴다.
 * - 파형은 장식이다(트랙 id로 고정된 20개 막대). 진행분만 브랜드 밝은색. 막대 띠를 누르면 그 위치로 간다.
 * - 재질은 잉크(gray-950) 단색 — 글래스 blur 예산(상시 고정 레이어 ≤2)을 쓰지 않는다.
 */
const BAR_COUNT = 20;
// 휴대폰 하단 고정 바(KakaoFab bar)가 있는 화면에서는 그 높이(--mobile-cta-h)만큼 위로 비켜 앉는다.
const MOBILE_HIDDEN_ROUTES = new Set([
  '/[locale]/stories/[id]',
  '/[locale]/funding/[slug]',
  '/[locale]/funding/[slug]/pledge',
  '/[locale]/shows/[slug]',
  '/[locale]/booking/[service]',
]);

/** 트랙 id에서 결정적으로 뽑은 막대 높이(8~28px). 실제 파형이 아니라 모티프다. */
const barsFor = (seed: string): number[] => {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    out.push(8 + ((h >>> 0) % 21));
  }
  return out;
};

const fmt = (s: number): string => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const GlobalPlayerDock = () => {
  const { track, status, currentTime, duration, toggle, seek, close } = useGlobalPlayer();
  const router = useRouter();
  const { t } = useTranslation('common', { lng: track?.locale });
  const bars = React.useMemo(() => barsFor(track?.id ?? ''), [track?.id]);
  if (!track) return null;

  const playing = status === 'playing' || status === 'loading';
  const progress = duration > 0 ? currentTime / duration : 0;
  const mobileHidden = MOBILE_HIDDEN_ROUTES.has(router.pathname) || router.pathname.startsWith('/admin');
  const onBars = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };
  const onBarsKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!duration) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); seek(Math.min(duration, currentTime + 5)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); seek(Math.max(0, currentTime - 5)); }
  };

  const titleNode = track.href ? (
    <Link href={track.href} prefetch={false} className="truncate hover:underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950">
      {track.title}
    </Link>
  ) : (
    <span className="truncate">{track.title}</span>
  );

  return (
    <section
      aria-label={t('audioPlayer.global.region', { defaultValue: '지금 재생 중' })}
      className={`fixed z-40 bg-gray-950 text-white border border-white/10 shadow-xl
        inset-x-0 bottom-[var(--mobile-cta-h,0px)] rounded-none border-x-0 border-b-0 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]
        lg:inset-x-auto lg:left-6 lg:bottom-6 lg:w-[380px] lg:rounded-2xl lg:border lg:px-3 lg:py-3
        ${mobileHidden ? 'hidden lg:block' : ''}`}
    >
      <div className="flex items-center gap-3">
        {track.cover ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-800">
            <Image src={track.cover} alt="" fill sizes="48px" className="object-cover" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t('audioPlayer.pause', { defaultValue: '일시정지' }) : t('audioPlayer.play', { defaultValue: '재생' })}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-lighter text-gray-950 hover:bg-white transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
        >
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} className="ml-0.5" aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{titleNode}</p>
          {track.subtitle && <p className="truncate text-xs text-white/70 leading-tight mt-0.5">{track.subtitle}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onBars}
              onKeyDown={onBarsKey}
              aria-label={t('audioPlayer.playbackProgress', { defaultValue: '재생 진행률' })}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              role="slider"
              className="flex h-7 flex-1 items-center gap-[2px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            >
              {bars.map((h, i) => (
                <i
                  key={i}
                  aria-hidden="true"
                  style={{ height: h }}
                  className={`block w-[3px] rounded-[2px] ${i / BAR_COUNT < progress ? 'bg-primary-lighter' : 'bg-white/30'}`}
                />
              ))}
            </button>
            <span className="shrink-0 text-xs tabular-nums text-white/70">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t('audioPlayer.global.close', { defaultValue: '플레이어 닫기' })}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {status === 'error' && (
        <p role="alert" className="mt-2 text-xs text-red-300">{t('audioPlayer.global.error', { defaultValue: '재생할 수 없어요. 잠시 뒤 다시 눌러 주세요.' })}</p>
      )}
    </section>
  );
};

export default GlobalPlayerDock;
