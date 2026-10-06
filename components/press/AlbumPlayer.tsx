import { useCallback, useEffect, useRef } from 'react';

import { Pause, Play, SkipBack, SkipForward } from '../../lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';
import { useAlbumPlayer } from './AlbumPlayerContext';
import type { PlayerTrack } from './AlbumPlayerContext';

export interface AlbumPlayerLabels {
  nowPlaying: string;
  play: string;
  pause: string;
  prev: string;
  next: string;
  position: string;
  disc: (n: number) => string;
  failed: string;
  loading: string;
  playTrack: (title: string) => string;
  instrumental: string;
}

export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** 막대 높이(0~1). 조용한 구간도 보이게 바닥을 두고 큰 소리는 완만하게 누른다(FundingAudioPlayer와 같다). */
const barHeight = (value: number): number => 0.08 + 0.92 * Math.pow(Math.min(1, Math.max(0, value)), 0.9);

const SPECTRUM_BARS = 64;

/** 곡의 음량 곡선에서 지금 위치의 값(0~1). 분석기가 없는 기기의 스펙트럼을 이 값으로 움직인다. */
const loudnessAt = (track: PlayerTrack, seconds: number): number => {
  const p = track.peaks;
  if (!p.length) return 0;
  const x = Math.min(p.length - 1, Math.max(0, (seconds / track.durationSeconds) * p.length));
  const i = Math.floor(x);
  const f = x - i;
  return p[i] * (1 - f) + (p[Math.min(p.length - 1, i + 1)] ?? p[i]) * f;
};

function drawSpectrum(canvas: HTMLCanvasElement, values: Float32Array) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(canvas).color;
  const gap = w < 480 ? 2 : 3;
  const bars = values.length;
  const barW = Math.max(1.5, (w - gap * (bars - 1)) / bars);
  const mid = h / 2;
  for (let i = 0; i < bars; i += 1) {
    const v = values[i];
    const bh = Math.max(2, Math.pow(v, 1.25) * h * 0.96);
    const x = i * (barW + gap);
    const r = Math.min(barW / 2, bh / 2);
    ctx.globalAlpha = 0.25 + 0.75 * v;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, mid - bh / 2, barW, bh, r);
    else ctx.rect(x, mid - bh / 2, barW, bh);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 재생 중 스펙트럼. 분석기가 있으면 실제 주파수, 없으면 음량 곡선으로 흉내 낸 막대. */
function Spectrum({ className }: { className: string }) {
  const { playing, readSpectrum, readTime, spectrumBins, tracks, index } = useAlbumPlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valuesRef = useRef(new Float32Array(SPECTRUM_BARS));
  const binsRef = useRef(new Uint8Array(spectrumBins));
  const seedRef = useRef(Array.from({ length: SPECTRUM_BARS }, (_, i) => 0.55 + 0.45 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1)));

  const paintIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const values = valuesRef.current;
    for (let i = 0; i < SPECTRUM_BARS; i += 1) values[i] = 0.05 + 0.03 * Math.sin(i * 0.45);
    drawSpectrum(canvas, values);
  }, []);

  useEffect(() => {
    paintIdle();
    const onResize = () => { if (!playing) paintIdle(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [paintIdle, playing]);

  useEffect(() => {
    if (!playing) {
      paintIdle();
      return undefined;
    }
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const values = valuesRef.current;
    const bins = binsRef.current;
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        if (!reduced && readSpectrum(bins)) {
          // 저음에 소리가 몰리므로 막대를 로그 간격으로 빈에 대응시킨다. 위쪽 1/3(공기감 대역)은 쓰지 않는다.
          const usable = Math.floor(bins.length * 0.66);
          for (let i = 0; i < SPECTRUM_BARS; i += 1) {
            const lo = Math.floor(Math.pow(i / SPECTRUM_BARS, 2) * usable);
            const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / SPECTRUM_BARS, 2) * usable));
            let sum = 0;
            for (let k = lo; k < hi; k += 1) sum += bins[k];
            values[i] = sum / (hi - lo) / 255;
          }
        } else {
          // 분석기가 없다(터치 기기·움직임 줄이기). 지금 위치의 음량으로 막대 전체 높이를 정하고,
          // 막대마다 정해 둔 비율과 느린 물결을 곱해 살아 있게만 한다.
          const level = loudnessAt(tracks[index], readTime());
          const t = reduced ? 0 : now / 1000;
          for (let i = 0; i < SPECTRUM_BARS; i += 1) {
            const tilt = 1 - (i / SPECTRUM_BARS) * 0.55;
            const wave = 0.75 + 0.25 * Math.sin(t * (1.6 + (i % 7) * 0.31) + i);
            const target = level * tilt * seedRef.current[i] * wave;
            values[i] += (target - values[i]) * 0.18;
          }
        }
        drawSpectrum(canvas, values);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, readSpectrum, readTime, tracks, index, paintIdle]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

/** 곡 파형 위에서 재생 위치를 고르는 막대. 채움은 매 프레임 직접 칠한다(렌더 없이). */
function Waveform({ labels }: { labels: AlbumPlayerLabels }) {
  const { tracks, index, time, playing, readTime, seek } = useAlbumPlayer();
  const track = tracks[index];
  const fillRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  const paint = useCallback((seconds: number) => {
    const ratio = track.durationSeconds ? Math.min(1, Math.max(0, seconds / track.durationSeconds)) : 0;
    if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`;
    if (rangeRef.current && !draggingRef.current) rangeRef.current.value = String(seconds);
  }, [track.durationSeconds]);

  useEffect(() => { paint(time); }, [paint, time, index]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    const tick = () => {
      paint(readTime());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, paint, readTime]);

  const bars = (className: string) => (
    <div aria-hidden="true" className="absolute inset-0 flex items-center gap-[2px] max-md:[&>span:nth-child(even)]:hidden">
      {track.peaks.map((value, i) => (
        <span key={i} className={`flex-1 rounded-full ${className}`} style={{ height: `${barHeight(value) * 100}%` }} />
      ))}
    </div>
  );

  return (
    <div className="relative h-14 rounded-lg focus-within:ring-2 focus-within:ring-white/70 md:h-16">
      {bars('bg-white/[0.16]')}
      <div ref={fillRef} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
        {bars('bg-white')}
      </div>
      <input
        key={track.id}
        ref={rangeRef}
        type="range"
        min={0}
        max={track.durationSeconds}
        step={1}
        defaultValue={0}
        onPointerDown={() => { draggingRef.current = true; }}
        onPointerUp={() => { draggingRef.current = false; }}
        onChange={(e) => {
          const seconds = Number(e.target.value);
          paint(seconds);
          seek(seconds);
        }}
        aria-label={`${track.title} ${labels.position}`}
        aria-valuetext={`${formatTime(time)} / ${formatTime(track.durationSeconds)}`}
        className="absolute inset-0 h-full w-full cursor-pointer touch-pan-y opacity-0"
      />
    </div>
  );
}

function PlayButton({ labels, size }: { labels: AlbumPlayerLabels; size: 'lg' | 'sm' }) {
  const { playing, loading, toggle, tracks, index } = useAlbumPlayer();
  const title = tracks[index].title;
  const big = size === 'lg';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${title} ${playing ? labels.pause : labels.play}`}
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-white text-black shadow-lg transition-[transform,background-color] duration-fast hover:bg-white/90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none ${big ? 'h-16 w-16' : 'h-11 w-11'}`}
    >
      {loading && playing === false && (
        <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-2 border-black/10 border-t-black/60 motion-reduce:animate-none" />
      )}
      {playing ? <Pause size={big ? 24 : 18} aria-hidden="true" /> : <Play size={big ? 24 : 18} aria-hidden="true" className="translate-x-px" />}
    </button>
  );
}

function StepButton({ dir, labels }: { dir: 'prev' | 'next'; labels: AlbumPlayerLabels }) {
  const { prev, next, index, tracks } = useAlbumPlayer();
  const disabled = dir === 'next' && index >= tracks.length - 1;
  const Icon = dir === 'prev' ? SkipBack : SkipForward;
  return (
    <button
      type="button"
      onClick={dir === 'prev' ? prev : next}
      disabled={disabled}
      aria-label={dir === 'prev' ? labels.prev : labels.next}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors duration-fast hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-black disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

/** 지금 재생 중인 곡의 큰 플레이어. */
export function PlayerDeck({
  labels, cover, coverAlt, artist, album, deckRef,
}: {
  labels: AlbumPlayerLabels;
  cover: string;
  coverAlt: string;
  artist: string;
  album: string;
  deckRef?: React.Ref<HTMLDivElement>;
}) {
  const { tracks, index, time, failed, loading, playing } = useAlbumPlayer();
  const track = tracks[index];
  return (
    <div ref={deckRef} className="relative overflow-hidden rounded-[28px] bg-neutral-950 text-white shadow-2xl ring-1 ring-white/10">
      {/* 표지를 크게 흐려 깔아 카드 결이 앨범에서 나오게 한다(FundingAudioPlayer와 같은 방식). 장식이라 alt는 비운다. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 [&_img]:scale-150 [&_img]:blur-3xl">
        <ResponsiveImage src={cover} alt="" fill sizes="640px" className="object-cover" containerClassName="relative block h-full w-full" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black/90" />

      <div className="relative grid gap-6 p-5 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8 md:p-8">
        <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 md:w-full">
          <ResponsiveImage src={cover} alt={coverAlt} fill sizes="(min-width: 768px) 240px, 192px" className="object-cover" priority />
        </div>

        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <p className="press-eyebrow text-xs font-semibold uppercase tracking-[0.25em] text-white/55">
              {labels.nowPlaying} · {labels.disc(track.disc)} · {String(track.number).padStart(2, '0')} / {tracks.length}
            </p>
            <p className="press-display mt-2 break-keep text-3xl leading-tight md:text-4xl" aria-live="polite">
              {track.title}
            </p>
            <p className="mt-1 text-sm text-white/65">{artist} — {album}</p>
          </div>

          <Spectrum className="mt-5 block h-20 w-full text-white md:h-24" />
        </div>
      </div>

      <div className="relative px-5 pb-6 md:px-8 md:pb-8">
        <Waveform labels={labels} />
        <div className="mt-4 flex items-center gap-2 md:gap-3">
          <StepButton dir="prev" labels={labels} />
          <PlayButton labels={labels} size="lg" />
          <StepButton dir="next" labels={labels} />
          <p className="ml-auto font-title text-base tabular-nums md:text-lg">
            {formatTime(time)}
            <span className="text-white/50"> / {formatTime(track.durationSeconds)}</span>
          </p>
        </div>
        <p role="status" className={failed ? 'mt-3 text-sm text-red-300' : loading && !playing ? 'mt-3 text-sm text-white/55' : 'sr-only'}>
          {failed ? labels.failed : loading && !playing ? labels.loading : ''}
        </p>
      </div>
    </div>
  );
}

/** 움직이는 막대 세 개 — 지금 재생 중인 줄 표시. */
function NowPlayingBars({ active }: { active: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-3.5 items-end gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-white ${active ? 'animate-press-eq motion-reduce:animate-none' : ''}`}
          style={{ height: active ? undefined : '40%', animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  );
}

/** CD별 수록곡. 줄을 누르면 그 곡부터 튼다. */
export function Tracklist({ labels, instrumentalIds }: { labels: AlbumPlayerLabels; instrumentalIds: ReadonlySet<string> }) {
  const { tracks, index, playing, time, playTrack, toggle } = useAlbumPlayer();
  const discs = [1, 2] as const;
  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-10">
      {discs.map((disc) => {
        const rows = tracks.filter((t) => t.disc === disc);
        const total = rows.reduce((sum, t) => sum + t.durationSeconds, 0);
        return (
          <section key={disc} aria-label={labels.disc(disc)}>
            <div className="flex items-baseline justify-between border-b border-white/15 pb-2">
              <h3 className="press-display text-xl tracking-wide">{labels.disc(disc)}</h3>
              <span className="text-sm tabular-nums text-white/50">{formatTime(total)}</span>
            </div>
            <ol className="mt-1">
              {rows.map((t) => {
                const i = tracks.indexOf(t);
                const current = i === index;
                const ratio = current ? Math.min(1, time / t.durationSeconds) : 0;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => (current ? toggle() : playTrack(i, 0))}
                      aria-current={current ? 'true' : undefined}
                      aria-label={labels.playTrack(t.title)}
                      className={`group relative flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors duration-fast hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-black ${current ? 'bg-white/[0.07]' : ''}`}
                    >
                      <span className="flex w-7 shrink-0 justify-center text-sm tabular-nums text-white/45">
                        {current ? <NowPlayingBars active={playing} /> : (
                          <>
                            <span className="group-hover:hidden">{String(t.number).padStart(2, '0')}</span>
                            <Play size={14} aria-hidden="true" className="hidden text-white group-hover:block" />
                          </>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block break-keep ${current ? 'text-white' : 'text-white/85'}`}>{t.title}</span>
                        {instrumentalIds.has(t.id) && <span className="block text-xs text-white/40">{labels.instrumental}</span>}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-white/50">{formatTime(t.durationSeconds)}</span>
                      {current && (
                        <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-px bg-white/10">
                          <span className="block h-full bg-white/70" style={{ width: `${ratio * 100}%` }} />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/** 큰 플레이어가 화면 밖으로 나가면 아래에 붙는 작은 막대. 글을 읽으며 들을 수 있게. */
export function MiniBar({ labels, cover, visible }: { labels: AlbumPlayerLabels; cover: string; visible: boolean }) {
  const { tracks, index, time, playing } = useAlbumPlayer();
  const track = tracks[index];
  const started = playing || time > 0;
  const shown = visible && started;
  return (
    <div
      aria-hidden={!shown}
      className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-base motion-reduce:transition-none ${shown ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative border-t border-white/10 bg-black/90 text-white backdrop-blur-md">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-white/10">
          <span className="block h-full bg-white" style={{ width: `${Math.min(1, time / track.durationSeconds) * 100}%` }} />
        </span>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/15">
            <ResponsiveImage src={cover} alt="" fill sizes="40px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{String(track.number).padStart(2, '0')}. {track.title}</p>
            <p className="text-xs tabular-nums text-white/50">{formatTime(time)} / {formatTime(track.durationSeconds)}</p>
          </div>
          <span className={shown ? 'contents' : 'hidden'}>
            <StepButton dir="prev" labels={labels} />
            <PlayButton labels={labels} size="sm" />
            <StepButton dir="next" labels={labels} />
          </span>
        </div>
      </div>
    </div>
  );
}
