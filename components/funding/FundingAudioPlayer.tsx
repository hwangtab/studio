import { useCallback, useEffect, useRef, useState } from 'react';

import { Pause, Play } from '../../lib/lucide-icons';
import ResponsiveImage from '../ResponsiveImage';

interface AudioClip {
  src: string;
  title: string;
  artist: string;
  /** 표지 한 장(정사각). 그림을 바꾸면 파일명도 바꾼다 — /images/**는 immutable 캐시다. */
  cover: string;
  coverAlt: string;
  durationSeconds: number;
  /** 구간별 RMS를 상위 2% 지점이 1이 되게 맞춘 값. 만든 방법은 아래 SABBAHA 항목 옆에 적어 둔다. */
  peaks: readonly number[];
  /** 한 줄 설명(예: 어느 구간인가). 없으면 안 그린다. */
  note?: string;
}

/**
 * `%%funding-audio:<id>%%`로 불러오는 미리듣기 플레이어.
 *
 * 마크다운 본문은 raw HTML을 못 써서 `<audio>`를 직접 못 넣는다(FundingGallery와 같은 이유).
 * 음원은 **발췌본**이다 — 전곡은 후원 리워드이므로 여기엔 맛보기만 올린다.
 * 음원을 바꾸면 파일명(날짜)도 바꿀 것 — /audio/**도 오래 캐시된다.
 */
const CLIPS: Record<string, AudioClip> = {
  // 《SLUNG》 1번 〈Kalpa〉(10:27)의 0:05~0:55. 마스터(48k/24bit WAV)를 ffmpeg로 자르고
  // 앞 0.25초·뒤 1.5초 페이드를 걸어 192k mp3로 인코딩했다(음량은 마스터 그대로).
  // 파형: 같은 mp3를 8kHz 모노로 풀어 100구간 RMS → 상위 2% 지점을 1로 정규화.
  'sabbaha-kalpa': {
    src: '/audio/funding/sabbaha-kalpa-20261006.mp3',
    title: 'Kalpa',
    artist: '사바하 — 《SLUNG》 1번 트랙',
    cover: '/images/funding/sabbaha-slung/album-front-20260928.webp',
    coverAlt: '《SLUNG》 앞표지',
    durationSeconds: 50,
    note: '앨범을 여는 곡 〈Kalpa〉(10분 27초)의 앞 50초',
    peaks: [0.172,0.101,0.26,0.176,0.218,0.387,0.466,0.525,0.69,0.792,0.856,0.902,0.866,0.904,0.945,0.936,0.969,0.962,1,0.966,0.961,0.919,0.891,0.859,0.921,0.949,0.85,0.967,0.903,0.99,0.997,0.875,0.926,0.845,0.833,0.878,0.854,0.839,0.832,0.815,0.824,0.842,0.873,0.897,0.879,0.884,0.756,0.828,0.898,0.905,0.889,0.862,0.915,0.891,0.94,0.928,0.878,0.89,0.92,0.922,0.916,0.919,0.925,0.948,0.973,0.886,0.841,0.892,0.874,0.906,0.866,0.885,0.903,0.893,0.9,0.886,0.89,0.894,0.863,0.873,0.858,0.891,0.821,0.882,0.841,0.922,0.921,0.845,0.84,0.956,0.836,1,0.887,0.891,0.869,0.831,0.796,0.637,0.423,0.167],
  },
};

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 막대 높이(0~1). 조용한 구간도 보이게 바닥을 두고 큰 소리는 완만하게 누른다. */
const barHeight = (value: number): number => 0.1 + 0.9 * Math.pow(Math.min(1, Math.max(0, value)), 0.8);

const SPECTRUM_BARS = 56;

/**
 * 재생 중 스펙트럼 막대를 그린다. `AnalyserNode`는 같은 출처 음원(`/audio/**`)에만 쓸 수 있다 —
 * 다른 출처면 CORS 때문에 분석값이 0으로 나온다.
 */
function drawSpectrum(canvas: HTMLCanvasElement, data: Uint8Array | null, time: number) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(canvas).color;

  const gap = 3;
  const barW = Math.max(2, (w - gap * (SPECTRUM_BARS - 1)) / SPECTRUM_BARS);
  const mid = h / 2;
  for (let i = 0; i < SPECTRUM_BARS; i += 1) {
    let v: number;
    if (data) {
      // 저음에 소리가 몰리므로 막대를 로그 간격으로 빈에 대응시킨다. 위쪽 1/3(공기감 대역)은 쓰지 않는다.
      const usable = Math.floor(data.length * 0.66);
      const lo = Math.floor(Math.pow(i / SPECTRUM_BARS, 2) * usable);
      const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / SPECTRUM_BARS, 2) * usable));
      let sum = 0;
      for (let k = lo; k < hi; k += 1) sum += data[k];
      v = sum / (hi - lo) / 255;
    } else {
      // 멈춰 있을 때는 낮은 물결만 — 움직임이 없는 사람(reduced motion)에게도 같다.
      v = 0.06 + 0.04 * Math.sin(i * 0.5 + time);
    }
    const bh = Math.max(2, Math.pow(v, 1.3) * h * 0.95);
    const x = i * (barW + gap);
    const r = Math.min(barW / 2, bh / 2);
    ctx.globalAlpha = data ? 0.35 + 0.65 * v : 0.35;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, mid - bh / 2, barW, bh, r);
    else ctx.rect(x, mid - bh / 2, barW, bh);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export default function FundingAudioPlayer({ id }: { id: string }) {
  const clip = CLIPS[id];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const reducedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);

  const duration = clip?.durationSeconds ?? 0;

  const paint = useCallback(
    (seconds: number) => {
      const ratio = duration ? Math.min(1, Math.max(0, seconds / duration)) : 0;
      if (fillRef.current) fillRef.current.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`;
      if (rangeRef.current) rangeRef.current.value = String(seconds);
    },
    [duration],
  );

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const buf = analyserRef.current ? new Uint8Array(analyserRef.current.frequencyBinCount) : null;
    const tick = (now: number) => {
      const el = audioRef.current;
      if (el) paint(el.currentTime);
      if (canvasRef.current) {
        if (analyserRef.current && buf && !reducedRef.current) {
          analyserRef.current.getByteFrequencyData(buf);
          drawSpectrum(canvasRef.current, buf, now / 1000);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [paint, stopLoop]);

  // 멈춘 상태의 스펙트럼(낮은 물결)은 한 번만 그린다.
  useEffect(() => {
    if (canvasRef.current) drawSpectrum(canvasRef.current, null, 0);
    if (typeof window.matchMedia === 'function') {
      reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  useEffect(() => {
    if (!clip) return undefined;
    // 재생 전에는 한 바이트도 받지 않는다(preload="none").
    const el = new Audio();
    el.preload = 'none';
    el.src = clip.src;
    el.addEventListener('timeupdate', () => setTime(el.currentTime));
    // 아이콘은 버튼이 아니라 오디오의 실제 상태를 따라간다(블루투스 해제·미디어 키 등 외부 중단).
    el.addEventListener('pause', () => {
      if (el.ended) return;
      stopLoop();
      setPlaying(false);
      setTime(el.currentTime);
      paint(el.currentTime);
      if (canvasRef.current) drawSpectrum(canvasRef.current, null, 0);
    });
    el.addEventListener('playing', () => {
      setFailed(false);
      setPlaying(true);
      if (rafRef.current === null) startLoop();
    });
    el.addEventListener('ended', () => {
      stopLoop();
      setPlaying(false);
      el.currentTime = 0;
      setTime(0);
      paint(0);
      if (canvasRef.current) drawSpectrum(canvasRef.current, null, 0);
    });
    el.addEventListener('error', () => {
      stopLoop();
      setPlaying(false);
      setFailed(true);
    });
    audioRef.current = el;
    return () => {
      stopLoop();
      el.pause();
      el.removeAttribute('src');
      el.load();
      audioRef.current = null;
      analyserRef.current = null;
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [clip, paint, startLoop, stopLoop]);

  if (!clip) return null;

  /** 처음 재생할 때에야 오디오 컨텍스트를 만든다 — 사용자 제스처 안에서 만들어야 Safari가 허용한다. */
  const ensureAnalyser = () => {
    const el = audioRef.current;
    if (!el || ctxRef.current) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // 분석기가 안 되면 스펙트럼만 포기하고 소리는 그대로 낸다.
    }
  };

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    ensureAnalyser();
    try {
      await ctxRef.current?.resume();
      await el.play();
    } catch {
      setFailed(true);
    }
  };

  const seekWhenReady = (el: HTMLAudioElement, seconds: number) => {
    if (el.readyState >= 1) {
      el.currentTime = seconds;
      return;
    }
    el.addEventListener('loadedmetadata', () => { el.currentTime = seconds; }, { once: true });
    if (el.preload === 'none') {
      el.preload = 'metadata';
      el.load();
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(e.target.value);
    if (audioRef.current) seekWhenReady(audioRef.current, seconds);
    setTime(seconds);
    paint(seconds);
  };

  const bars = (className: string) => (
    <div aria-hidden="true" className="absolute inset-0 flex items-center gap-[2px] max-md:[&>span:nth-child(even)]:hidden">
      {clip.peaks.map((value, i) => (
        <span key={i} className={`flex-1 rounded-full ${className}`} style={{ height: `${barHeight(value) * 100}%` }} />
      ))}
    </div>
  );

  return (
    <figure className="not-prose relative my-8 overflow-hidden rounded-3xl bg-gray-950 text-white shadow-lg ring-1 ring-white/10">
      {/* 표지를 크게 흐려 깔아 카드 색이 앨범에서 나오게 한다. 장식이라 alt는 비운다. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 [&_img]:scale-125 [&_img]:blur-3xl">
        <ResponsiveImage src={clip.cover} alt="" fill sizes="480px" className="object-cover" containerClassName="relative block h-full w-full" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-gray-950/30 via-gray-950/60 to-gray-950/90" />

      <div className="relative p-5 md:p-7">
        <div className="flex items-center gap-4 md:gap-5">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-white/15 md:h-24 md:w-24">
            <ResponsiveImage src={clip.cover} alt={clip.coverAlt} fill sizes="96px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">미리듣기</p>
            <p className="mt-1 truncate font-title text-2xl font-black leading-tight md:text-3xl">{clip.title}</p>
            <p className="mt-0.5 break-keep text-sm text-white/70">{clip.artist}</p>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="mt-5 block h-24 w-full text-primary-lighter md:h-28"
        />

        <div className="relative mt-3 h-12 rounded-lg focus-within:ring-2 focus-within:ring-white/70">
          {bars('bg-white/20')}
          <div ref={fillRef} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
            {bars('bg-primary-lighter')}
          </div>
          <input
            ref={rangeRef}
            type="range"
            min={0}
            max={duration}
            step={0.5}
            defaultValue={0}
            onChange={onSeek}
            aria-label={`${clip.title} 재생 위치`}
            aria-valuetext={`${formatTime(time)} / ${formatTime(duration)}`}
            className="absolute inset-0 h-full w-full cursor-pointer touch-pan-y opacity-0"
          />
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? `${clip.title} 일시정지` : `${clip.title} 재생`}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-gray-950 shadow-md transition-colors duration-fast hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" className="translate-x-px" />}
          </button>
          <p className="font-title text-lg font-semibold tabular-nums">
            {formatTime(time)}
            <span className="text-white/60"> / {formatTime(duration)}</span>
          </p>
        </div>

        {clip.note && <figcaption className="mt-3 break-keep text-sm text-white/60">{clip.note}</figcaption>}
        <p role="status" className={failed ? 'mt-3 text-sm text-red-300' : 'sr-only'}>
          {failed ? '음원을 재생하지 못했습니다. 잠시 뒤 다시 눌러 주세요.' : ''}
        </p>
      </div>
    </figure>
  );
}
