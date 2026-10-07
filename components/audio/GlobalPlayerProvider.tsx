import React from 'react';
import dynamic from 'next/dynamic';
import { announcePlay, onOtherPlay } from '../../lib/audio/audioBus';
import { trackMicroEvent } from '../../utils/analytics';

/**
 * 글로벌 미니 플레이어의 상태(라이너 노트 §3-6, docs/design-liner-notes-plan-2026-10.md).
 *
 * `_app`에서 Layout 바깥을 감싼다 — Pages Router는 라우트가 바뀌어도 `_app`이 살아 있으므로, 여기 둔 `<audio>`는
 * 페이지를 옮겨도 끊기지 않는다. 소리를 내는 자리는 셋(홈 커버 그리드·LP 발췌 줄·포트폴리오 샘플 트랙)이고 전부
 * `useGlobalPlayer().play(track)` 하나로 들어온다. 도크(GlobalPlayerDock)는 첫 재생 때에야 청크를 받는다.
 *
 * 규칙:
 * - **재생 전에는 한 바이트도 받지 않는다.** `<audio>`는 첫 play()에서야 만들고 `preload="none"`이다
 *   (components/audio/MixComparePlayer.tsx와 같은 원칙 — /ko/portfolio LCP 21s 사고의 교훈).
 * - 한 번에 하나만 운다. 믹싱 비교·포트폴리오 플레이어가 재생을 시작하면 버스(lib/audio/audioBus)로 알려 오고
 *   여기서 멈춘다. 반대도 같다.
 * - 재생 아이콘은 버튼이 아니라 오디오의 실제 상태(playing/pause 이벤트)를 따라간다 — 블루투스 해제·통화·미디어 키가
 *   버튼을 거치지 않는다.
 * - 계측은 트랙당 세션에 한 번 `micro_audio_play`(component = 어느 자리, cta_id = 트랙 id). 관심 신호일 뿐 리드가 아니다.
 */
export interface GlobalTrack {
  /** 트랙 id — data/audioExcerpts.ts·data/portfolio/tracks.ts의 id. 계측 cta_id로도 쓴다. */
  id: string;
  src: string;
  title: string;
  /** 한 줄 크레딧 — "스튜디오 놀 기획·녹음·믹싱" 같은, 여기서 무엇을 맡았는지. */
  subtitle?: string;
  /** 커버 이미지(로컬 또는 next.config remotePatterns 안의 원격). */
  cover?: string;
  /** 커버·제목을 누르면 가는 곳(포트폴리오 상세 등). */
  href?: string;
  /** 어느 자리에서 눌렀는지 — GA4 component. */
  component: string;
  locale?: string;
}

export type GlobalPlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface GlobalPlayerContextValue {
  track: GlobalTrack | null;
  status: GlobalPlayerStatus;
  currentTime: number;
  duration: number;
  /** 트랙을 바꾸거나(새 src) 같은 트랙이면 이어서 재생한다. */
  play: (track: GlobalTrack) => Promise<void>;
  pause: () => void;
  /** 현재 트랙 기준 재생/일시정지. 트랙이 없으면 아무것도 하지 않는다. */
  toggle: () => void;
  seek: (seconds: number) => void;
  /** 도크를 닫는다 — 소리를 멈추고 트랙을 비운다. */
  close: () => void;
  /** 이 트랙이 지금 울리고 있는가(커버·발췌 줄의 아이콘 상태용). */
  isPlaying: (trackId: string) => boolean;
}

const GlobalPlayerContext = React.createContext<GlobalPlayerContextValue | null>(null);

const GlobalPlayerDock = dynamic(() => import('./GlobalPlayerDock'), { ssr: false });

export const GlobalPlayerProvider = ({ children }: { children: React.ReactNode }) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const trackRef = React.useRef<GlobalTrack | null>(null);
  const playedIds = React.useRef<Set<string>>(new Set());
  const [track, setTrack] = React.useState<GlobalTrack | null>(null);
  const [status, setStatus] = React.useState<GlobalPlayerStatus>('idle');
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  const ensureAudio = React.useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.preload = 'none';
    el.addEventListener('timeupdate', () => setCurrentTime(el.currentTime));
    el.addEventListener('durationchange', () => setDuration(Number.isFinite(el.duration) ? el.duration : 0));
    el.addEventListener('playing', () => setStatus('playing'));
    el.addEventListener('waiting', () => setStatus('loading'));
    el.addEventListener('pause', () => {
      // ended 뒤의 pause는 아래 ended 핸들러가 처리한다.
      if (!el.ended) setStatus('paused');
    });
    el.addEventListener('ended', () => {
      setStatus('paused');
      setCurrentTime(0);
    });
    el.addEventListener('error', () => setStatus('error'));
    audioRef.current = el;
    return el;
  }, []);

  // 다른 소스(믹싱 비교·포트폴리오 플레이어)가 울리면 멈춘다.
  React.useEffect(() => onOtherPlay('global', () => {
    const el = audioRef.current;
    if (el && !el.paused) el.pause();
  }), []);

  // 언마운트(사실상 없다 — _app)에서 정리.
  React.useEffect(() => () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
    }
  }, []);

  const play = React.useCallback(async (next: GlobalTrack) => {
    const el = ensureAudio();
    const sameTrack = trackRef.current?.id === next.id;
    if (!sameTrack) {
      trackRef.current = next;
      setTrack(next);
      setCurrentTime(0);
      setDuration(0);
      el.src = next.src;
      el.load();
    }
    setStatus('loading');
    announcePlay('global');
    try {
      await el.play();
    } catch {
      setStatus('error');
      return;
    }
    if (!playedIds.current.has(next.id)) {
      playedIds.current.add(next.id);
      trackMicroEvent('micro_audio_play', { locale: next.locale, component: next.component, cta_id: next.id });
    }
  }, [ensureAudio]);

  const pause = React.useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = React.useCallback(() => {
    const el = audioRef.current;
    const current = trackRef.current;
    if (!el || !current) return;
    if (el.paused) void play(current);
    else el.pause();
  }, [play]);

  const seek = React.useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : seconds;
    el.currentTime = Math.max(0, Math.min(seconds, max));
    setCurrentTime(el.currentTime);
  }, []);

  const close = React.useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    trackRef.current = null;
    setTrack(null);
    setStatus('idle');
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const isPlaying = React.useCallback(
    (trackId: string) => track?.id === trackId && (status === 'playing' || status === 'loading'),
    [track, status],
  );

  const value = React.useMemo<GlobalPlayerContextValue>(
    () => ({ track, status, currentTime, duration, play, pause, toggle, seek, close, isPlaying }),
    [track, status, currentTime, duration, play, pause, toggle, seek, close, isPlaying],
  );

  return (
    <GlobalPlayerContext.Provider value={value}>
      {children}
      {/* 도크 청크는 트랙이 생긴 뒤에야 받는다 — 재생 전 페이지에는 코드도 소리도 없다. */}
      {track && <GlobalPlayerDock />}
    </GlobalPlayerContext.Provider>
  );
};

/** Provider 밖(테스트·관리 화면)에서는 아무것도 하지 않는 빈 플레이어를 돌려준다 — 호출부가 분기할 필요 없게. */
const NOOP: GlobalPlayerContextValue = {
  track: null,
  status: 'idle',
  currentTime: 0,
  duration: 0,
  play: async () => undefined,
  pause: () => undefined,
  toggle: () => undefined,
  seek: () => undefined,
  close: () => undefined,
  isPlaying: () => false,
};

export const useGlobalPlayer = (): GlobalPlayerContextValue => React.useContext(GlobalPlayerContext) ?? NOOP;

export default GlobalPlayerProvider;
