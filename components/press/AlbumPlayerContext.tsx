import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * 감상실(앨범 한 장을 처음부터 끝까지 듣는 화면)의 재생 상태.
 *
 * components/funding/FundingAudioPlayer.tsx(곡 하나 미리듣기)를 앨범 단위로 넓힌 것이다. 원칙은 같다:
 * 재생 전에는 한 바이트도 받지 않고(preload="none"), 아이콘은 버튼이 아니라 오디오의 실제 상태를
 * 따라간다(블루투스 해제·미디어 키·통화 같은 외부 중단).
 *
 * 앨범이라 더해진 것:
 * - **두 오디오 요소를 번갈아 쓴다.** 곡이 끝나기 30초 전에 다음 곡을 다른 요소에 미리 받아 두고,
 *   끝나는 순간 그쪽을 튼다 — 〈喝〉(8초)에서 〈Warlock〉으로 넘어가듯 이어지는 곡 사이가 끊기지 않게.
 *   다음 요소가 자동 재생 정책에 막히면(사파리) 지금 요소에 다음 곡을 넣어 다시 튼다.
 * - **재생 주소는 만료된다**(비공개 저장소의 서명 주소, lib/press/audio.ts). 오류가 나면 새 주소를
 *   받아 같은 위치에서 잇는다.
 * - 스펙트럼 분석기(Web Audio)는 **마우스를 쓰는 기기에서만** 건다. iOS는 오디오를 Web Audio로
 *   돌리면 화면을 끄는 순간 소리가 멈춘다 — 98분짜리 앨범을 폰으로 듣는 사람에게 치명적이다.
 *   그런 기기에서는 미리 계산한 파형(곡의 음량 곡선)으로 막대를 움직인다.
 * - 잠금 화면·이어폰 버튼(Media Session), 이어 듣기(브라우저 저장소 — 없어도 동작한다).
 */

export interface PlayerTrack {
  id: string;
  number: number;
  disc: 1 | 2;
  title: string;
  durationSeconds: number;
  peaks: readonly number[];
}

interface AlbumPlayerValue {
  tracks: readonly PlayerTrack[];
  index: number;
  playing: boolean;
  /** 받는 중(재생을 눌렀는데 아직 소리가 안 남). */
  loading: boolean;
  failed: boolean;
  time: number;
  /** 지금 곡의 실제 재생 위치(초). 렌더 없이 매 프레임 읽는 쪽(파형 채움·스펙트럼)이 쓴다. */
  readTime: () => number;
  /** 스펙트럼 막대 값(0~255)을 채운다. 분석기가 없으면 false. */
  readSpectrum: (into: Uint8Array<ArrayBuffer>) => boolean;
  spectrumBins: number;
  playTrack: (index: number, at?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
}

const AlbumPlayerContext = createContext<AlbumPlayerValue | null>(null);

export const useAlbumPlayer = (): AlbumPlayerValue => {
  const value = useContext(AlbumPlayerContext);
  if (!value) throw new Error('useAlbumPlayer는 AlbumPlayerProvider 안에서만 쓴다');
  return value;
};

/** 다음 곡을 미리 받기 시작하는 지점(남은 초). */
const PRELOAD_BEFORE_END = 30;
/** 서명 주소가 이만큼 남았으면 곡을 새로 열기 전에 새 주소를 받아 둔다. */
const URL_REFRESH_MARGIN_MS = 10 * 60 * 1000;
/** 이 시간보다 많이 들었으면 "이전"은 곡 처음으로, 아니면 앞 곡으로. */
const RESTART_THRESHOLD = 3;

interface ProviderProps {
  tracks: readonly PlayerTrack[];
  initialUrls: readonly string[];
  validUntil: number;
  /** 만료된 주소를 새로 받는 곳(GET → { urls, validUntil }). */
  audioEndpoint: string;
  /** 이어 듣기 저장 키. */
  storageKey: string;
  mediaSession: { artist: string; album: string; artwork: string };
  children: ReactNode;
}

export function AlbumPlayerProvider({ tracks, initialUrls, validUntil, audioEndpoint, storageKey, mediaSession, children }: ProviderProps) {
  const elsRef = useRef<[HTMLAudioElement, HTMLAudioElement] | null>(null);
  const activeRef = useRef(0);
  /** 요소마다 지금 어느 곡이 들어 있는가. */
  const loadedRef = useRef<[number | null, number | null]>([null, null]);
  const urlsRef = useRef<readonly string[]>(initialUrls);
  const validUntilRef = useRef(validUntil);
  const indexRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const resumeAtRef = useRef<number | null>(null);
  const recoveringRef = useRef(false);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [time, setTime] = useState(0);

  const activeEl = () => elsRef.current?.[activeRef.current] ?? null;

  const setTrackIndex = useCallback((i: number) => {
    indexRef.current = i;
    setIndex(i);
  }, []);

  const refreshUrls = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(audioEndpoint, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return false;
      const data = (await res.json()) as { urls?: string[]; validUntil?: number };
      if (!Array.isArray(data.urls) || data.urls.length !== tracks.length) return false;
      urlsRef.current = data.urls;
      validUntilRef.current = Number(data.validUntil) || Date.now();
      // 요소에 들어 있는 옛 주소는 그대로 둔다 — 이미 받는 중인 연결은 서명 검사를 다시 하지 않는다.
      return true;
    } catch {
      return false;
    }
  }, [audioEndpoint, tracks.length]);

  const loadInto = (elIndex: number, trackIndex: number) => {
    const el = elsRef.current?.[elIndex];
    if (!el) return;
    el.src = urlsRef.current[trackIndex];
    loadedRef.current[elIndex] = trackIndex;
  };

  /** 메타데이터가 오기 전에는 currentTime을 못 바꾼다. */
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

  /** 분석기는 사용자 제스처 안에서 만든다(사파리). 마우스 기기에서만 — 머리말 참조. */
  const ensureAnalyser = () => {
    const els = elsRef.current;
    if (!els || ctxRef.current) return;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      for (const el of els) ctx.createMediaElementSource(el).connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      // 분석기가 안 되면 스펙트럼만 포기하고 소리는 그대로 낸다.
    }
  };

  const startElement = (el: HTMLAudioElement): Promise<void> => {
    setFailed(false);
    if (el.paused) setLoading(true);
    void ctxRef.current?.resume().catch(() => undefined);
    return el.play();
  };

  const playTrack = useCallback((trackIndex: number, at?: number) => {
    const els = elsRef.current;
    if (!els || trackIndex < 0 || trackIndex >= tracks.length) return;
    ensureAnalyser();

    const begin = () => {
      const other = 1 - activeRef.current;
      const sameTrack = trackIndex === indexRef.current && loadedRef.current[activeRef.current] === trackIndex;
      if (!sameTrack && loadedRef.current[other] === trackIndex) {
        // 미리 받아 둔 쪽으로 넘어간다.
        const previous = els[activeRef.current];
        activeRef.current = other;
        previous.pause();
      } else if (!sameTrack) {
        els[1 - activeRef.current].pause();
        loadInto(activeRef.current, trackIndex);
      }
      const el = els[activeRef.current];
      if (at !== undefined) seekWhenReady(el, at);
      else if (!sameTrack) seekWhenReady(el, 0);
      setTrackIndex(trackIndex);
      setTime(at ?? (sameTrack ? el.currentTime : 0));
      startElement(el).catch((error: unknown) => {
        // 자동 재생 정책에 막힌 것은 사용자가 다시 누르면 된다. 그 밖의 실패는 error 이벤트가 처리한다.
        setLoading(false);
        if ((error as { name?: string })?.name === 'NotAllowedError') setPlaying(false);
      });
    };

    // 서명 주소가 곧 만료되면 새로 받고 시작한다(드물다 — 페이지를 몇 시간 열어 둔 경우).
    if (Date.now() > validUntilRef.current - URL_REFRESH_MARGIN_MS) {
      void refreshUrls().then(() => {
        loadedRef.current = [null, null];
        begin();
      });
      return;
    }
    begin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, refreshUrls, setTrackIndex]);

  const toggle = useCallback(() => {
    const el = activeEl();
    if (el && !el.paused) {
      el.pause();
      return;
    }
    const resumeAt = resumeAtRef.current;
    resumeAtRef.current = null;
    playTrack(indexRef.current, resumeAt ?? undefined);
  }, [playTrack]);

  const next = useCallback(() => {
    if (indexRef.current < tracks.length - 1) playTrack(indexRef.current + 1, 0);
  }, [playTrack, tracks.length]);

  const prev = useCallback(() => {
    const el = activeEl();
    if (el && el.currentTime > RESTART_THRESHOLD) {
      el.currentTime = 0;
      setTime(0);
      return;
    }
    if (indexRef.current > 0) playTrack(indexRef.current - 1, 0);
  }, [playTrack]);

  const seek = useCallback((seconds: number) => {
    const el = activeEl();
    setTime(seconds);
    if (!el) return;
    if (loadedRef.current[activeRef.current] !== indexRef.current) {
      // 아직 한 번도 열지 않은 곡(이어 듣기로 고른 곡 등) — 누르면 그 자리부터 튼다.
      resumeAtRef.current = seconds;
      return;
    }
    seekWhenReady(el, seconds);
  }, []);

  // 요소 두 개를 만들고 이벤트를 단다.
  useEffect(() => {
    const make = () => {
      const el = new Audio();
      el.preload = 'none';
      // 서명 주소는 다른 출처다. CORS로 받아야 분석기가 값을 읽는다(저장소가 ACAO *를 준다).
      el.crossOrigin = 'anonymous';
      return el;
    };
    const els: [HTMLAudioElement, HTMLAudioElement] = [make(), make()];
    elsRef.current = els;

    const cleanups: Array<() => void> = [];
    els.forEach((el, elIndex) => {
      const isActive = () => activeRef.current === elIndex;
      const on = (type: string, handler: () => void) => {
        el.addEventListener(type, handler);
        cleanups.push(() => el.removeEventListener(type, handler));
      };

      on('timeupdate', () => {
        if (!isActive()) return;
        setTime(el.currentTime);
        const current = indexRef.current;
        const nextIndex = current + 1;
        const other = 1 - elIndex;
        const remaining = (el.duration || tracks[current].durationSeconds) - el.currentTime;
        if (nextIndex < tracks.length && remaining < PRELOAD_BEFORE_END && loadedRef.current[other] !== nextIndex) {
          loadInto(other, nextIndex);
          els[other].preload = 'auto';
          els[other].load();
        }
      });
      on('playing', () => {
        if (!isActive()) return;
        setFailed(false);
        setLoading(false);
        setPlaying(true);
      });
      on('waiting', () => {
        if (isActive()) setLoading(true);
      });
      on('pause', () => {
        // 반대편을 멈춘 것(전환)과 끝까지 간 것은 걸러 낸다.
        if (!isActive() || el.ended) return;
        setPlaying(false);
        setLoading(false);
      });
      on('ended', () => {
        if (!isActive()) return;
        const nextIndex = indexRef.current + 1;
        if (nextIndex >= tracks.length) {
          setPlaying(false);
          setTrackIndex(0);
          setTime(0);
          return;
        }
        const other = 1 - elIndex;
        if (loadedRef.current[other] === nextIndex) {
          activeRef.current = other;
          els[other].currentTime = 0;
          setTrackIndex(nextIndex);
          setTime(0);
          startElement(els[other]).catch(() => {
            // 사파리: 한 번도 사용자가 틀지 않은 요소는 자동 재생이 막힌다. 방금 끝난 요소에 다음 곡을 넣는다.
            activeRef.current = elIndex;
            loadInto(elIndex, nextIndex);
            startElement(el).catch(() => { setLoading(false); setPlaying(false); });
          });
          return;
        }
        loadInto(elIndex, nextIndex);
        setTrackIndex(nextIndex);
        setTime(0);
        startElement(el).catch(() => { setLoading(false); setPlaying(false); });
      });
      on('error', () => {
        if (!el.getAttribute('src')) return;
        if (!isActive()) {
          // 미리 받던 쪽의 실패는 조용히 버린다 — 차례가 오면 다시 연다.
          loadedRef.current[elIndex] = null;
          return;
        }
        // 서명 주소가 만료됐을 수 있다. 한 번만 새로 받아 같은 자리에서 잇는다.
        if (recoveringRef.current) {
          recoveringRef.current = false;
          setLoading(false);
          setPlaying(false);
          setFailed(true);
          return;
        }
        recoveringRef.current = true;
        const at = el.currentTime;
        const trackIndex = indexRef.current;
        void refreshUrls().then((ok) => {
          if (!ok) {
            recoveringRef.current = false;
            setLoading(false);
            setPlaying(false);
            setFailed(true);
            return;
          }
          loadedRef.current = [null, null];
          loadInto(elIndex, trackIndex);
          seekWhenReady(el, at);
          startElement(el)
            .then(() => { recoveringRef.current = false; })
            .catch(() => { recoveringRef.current = false; setLoading(false); setPlaying(false); });
        });
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
      for (const el of els) {
        el.pause();
        el.removeAttribute('src');
        el.load();
      }
      elsRef.current = null;
      analyserRef.current = null;
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이어 듣기 — 지난번에 멈춘 곡과 위치를 되살린다(자동 재생은 하지 않는다).
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as { i?: number; t?: number } | null;
      if (saved && Number.isInteger(saved.i) && saved.i! >= 0 && saved.i! < tracks.length) {
        const t = Math.max(0, Math.min(Number(saved.t) || 0, tracks[saved.i!].durationSeconds - 1));
        setTrackIndex(saved.i!);
        setTime(t);
        resumeAtRef.current = t > 2 ? t : null;
      }
    } catch {
      // 저장소가 막혀 있으면 처음부터.
    }
  }, [storageKey, tracks, setTrackIndex]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ i: index, t: Math.floor(time) }));
    } catch {
      // 저장 실패는 무시한다.
    }
  }, [storageKey, index, time]);

  // 잠금 화면·이어폰 버튼.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const track = tracks[index];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: mediaSession.artist,
        album: mediaSession.album,
        artwork: [{ src: mediaSession.artwork, sizes: '1200x1200', type: 'image/webp' }],
      });
    } catch {
      // 지원하지 않는 브라우저.
    }
  }, [index, tracks, mediaSession]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => toggle()],
      ['pause', () => activeEl()?.pause()],
      ['previoustrack', () => prev()],
      ['nexttrack', () => next()],
      ['seekto', (d) => { if (typeof d.seekTime === 'number') seek(d.seekTime); }],
      ['seekbackward', (d) => { const el = activeEl(); if (el) seek(Math.max(0, el.currentTime - (d.seekOffset ?? 10))); }],
      ['seekforward', (d) => { const el = activeEl(); if (el) seek(el.currentTime + (d.seekOffset ?? 10)); }],
    ];
    for (const [action, handler] of handlers) {
      try { ms.setActionHandler(action, handler); } catch { /* 지원하지 않는 동작 */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { ms.setActionHandler(action, null); } catch { /* 무시 */ }
      }
    };
  }, [toggle, prev, next, seek]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  const readTime = useCallback(() => {
    const el = activeEl();
    if (el && loadedRef.current[activeRef.current] === indexRef.current) return el.currentTime;
    return resumeAtRef.current ?? 0;
  }, []);

  const readSpectrum = useCallback((into: Uint8Array<ArrayBuffer>) => {
    const analyser = analyserRef.current;
    if (!analyser) return false;
    analyser.getByteFrequencyData(into);
    return true;
  }, []);

  const value = useMemo<AlbumPlayerValue>(
    () => ({
      tracks, index, playing, loading, failed, time, readTime, readSpectrum, spectrumBins: 256,
      playTrack, toggle, next, prev, seek,
    }),
    [tracks, index, playing, loading, failed, time, readTime, readSpectrum, playTrack, toggle, next, prev, seek],
  );

  return <AlbumPlayerContext.Provider value={value}>{children}</AlbumPlayerContext.Provider>;
}
