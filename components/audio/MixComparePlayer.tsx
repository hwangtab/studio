import React from 'react';
import Link from 'next/link';
import { ArrowRight, Pause, Play } from '@/lib/lucide-icons';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { trackMicroEvent } from '../../utils/analytics';
import { announcePlay, onOtherPlay } from '../../lib/audio/audioBus';
import { MIX_COMPARE_SETS, type MixCompareCopy, type MixCompareVariant } from '../../data/mixCompare';

type Side = 'before' | 'after';
const SIDES: Side[] = ['before', 'after'];

interface MixComparePlayerProps {
  locale: string;
  copy: MixCompareCopy;
  portfolioHref: string;
  /** 전체 곡(홈) 또는 30초 발췌(발매·주문·믹싱 페이지). copy도 같은 variant로 만든 것을 넘긴다. */
  variant?: MixCompareVariant;
  /** 계측 component 값 — 어느 페이지에서 들었는지 가른다. */
  component?: string;
  /** 결제 화면처럼 떠나면 안 되는 자리에서는 끈다. */
  showPortfolioLink?: boolean;
}

const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** 파형 막대 높이(%). 조용한 구간도 막대가 보이도록 바닥을 두고, 큰 소리는 완만하게 눌러 그린다. */
const barHeight = (value: number): number => 8 + 92 * Math.pow(Math.min(1, Math.max(0, value)), 0.8);

const Bars = ({ values, className }: { values: readonly number[]; className: string }) => (
  // 좁은 화면에서는 막대를 하나 걸러 숨긴다 — 120개가 모두 그려지면 막대 폭이 1px도 안 돼 실선처럼 보인다.
  // 진행 표시는 같은 구조의 두 겹이라 둘 다 같은 막대를 숨겨 정렬이 유지된다.
  <div aria-hidden="true" className="absolute inset-0 flex items-center gap-[2px] max-md:[&>span:nth-child(even)]:hidden">
    {values.map((value, i) => (
      <span
        key={i}
        className={cn('flex-1 rounded-full transition-[height] duration-base motion-reduce:transition-none', className)}
        style={{ height: `${barHeight(value)}%` }}
      />
    ))}
  </div>
);

/**
 * 믹싱 전·후 비교 — 같은 곡의 두 음원을 같은 재생 위치에서 바꿔 들을 수 있다. 홈(전체 곡)과 발매·주문·
 * 믹싱 페이지(30초 발췌)가 같은 컴포넌트를 쓴다.
 *
 * - **자동 재생·미리 내려받기 없음.** 두 `Audio`는 `preload="none"`이고 재생을 누르기 전에는 한 바이트도
 *   받지 않는다(포트폴리오 LCP 사고와 같은 이유 — components/audio/GlobalPlayerProvider.tsx). 처음 재생하면
 *   반대편 음원을 미리 받아 전환 때 끊김을 줄인다.
 * - **전환은 재생 위치를 그대로 넘긴다.** 두 파일은 시간이 맞춰져 있다(scripts/build-mix-compare.mjs).
 *   새 소리가 실제로 시작하고 나서야 이전 소리를 멈춰 겹침은 있어도 빈 틈은 없게 한다.
 * - 진행 표시는 requestAnimationFrame에서 DOM을 직접 고친다 — 초당 60번 리렌더하지 않는다. 시간 글자만
 *   `timeupdate`로 state를 갱신한다.
 * - 키보드·스크린리더: 재생 위치는 투명한 `<input type="range">`가 파형 위에 겹쳐 있어 방향키·터치 드래그가
 *   기본 동작이다. 전환 결과는 `aria-live`로 읽어 준다.
 */
export default function MixComparePlayer({
  locale,
  copy,
  portfolioHref,
  variant = 'full',
  component = 'HomeMixCompare',
  showPortfolioLink = true,
}: MixComparePlayerProps) {
  const { sources, durationSeconds, peaks } = MIX_COMPARE_SETS[variant];
  const [active, setActive] = React.useState<Side>('before');
  const [playing, setPlaying] = React.useState(false);
  const [time, setTime] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [announce, setAnnounce] = React.useState('');

  const audios = React.useRef<Partial<Record<Side, HTMLAudioElement>>>({});
  const activeRef = React.useRef<Side>('before');
  const playedOnce = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const clipRef = React.useRef<HTMLDivElement>(null);
  const rangeRef = React.useRef<HTMLInputElement>(null);

  const track = (ctaId: 'mix_compare_play' | 'mix_compare_switch', side: Side) =>
    trackMicroEvent('micro_mix_compare', { locale, component, cta_id: ctaId, side });

  /** 진행 표시(파형 채움·슬라이더)를 초 단위 위치로 옮긴다. React state를 거치지 않는다. */
  const paint = React.useCallback((seconds: number) => {
    const ratio = Math.min(1, Math.max(0, seconds / durationSeconds));
    if (clipRef.current) clipRef.current.style.clipPath = `inset(0 ${(1 - ratio) * 100}% 0 0)`;
    if (rangeRef.current) rangeRef.current.value = String(seconds);
  }, [durationSeconds]);

  const stopLoop = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const startLoop = React.useCallback(() => {
    stopLoop();
    const tick = () => {
      const el = audios.current[activeRef.current];
      if (el) paint(el.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [paint, stopLoop]);

  React.useEffect(() => {
    const created: HTMLAudioElement[] = [];
    SIDES.forEach((side) => {
      const el = new Audio();
      el.preload = 'none';
      el.src = sources[side];
      el.addEventListener('timeupdate', () => {
        if (activeRef.current === side) setTime(el.currentTime);
      });
      // 아이콘은 우리 버튼이 아니라 **오디오의 실제 상태**를 따라간다. 재생기기 변경·블루투스 해제·통화·
      // 미디어 키·다른 탭의 재생 같은 외부 중단은 버튼을 거치지 않고 `pause`만 보낸다(iOS는 홈 화면 제어센터도).
      // 전환 때 우리가 멈추는 반대편 음원의 pause는 activeRef가 이미 바뀌어 있어 여기서 걸러진다.
      el.addEventListener('pause', () => {
        if (activeRef.current !== side || el.ended) return; // 끝까지 간 경우는 ended가 처리한다
        stopLoop();
        setPlaying(false);
        setTime(el.currentTime);
        paint(el.currentTime);
      });
      // 외부에서 다시 재생됐을 때(미디어 키·제어센터) 아이콘과 진행 표시를 되살린다.
      el.addEventListener('playing', () => {
        if (activeRef.current !== side) return;
        setFailed(false);
        setPlaying(true);
        if (rafRef.current === null) startLoop();
      });
      el.addEventListener('ended', () => {
        if (activeRef.current !== side) return;
        stopLoop();
        setPlaying(false);
        SIDES.forEach((s) => {
          const other = audios.current[s];
          if (other) other.currentTime = 0;
        });
        setTime(0);
        paint(0);
      });
      el.addEventListener('error', () => {
        if (activeRef.current !== side) return;
        stopLoop();
        setPlaying(false);
        setAnnounce('');
        setFailed(true);
      });
      audios.current[side] = el;
      created.push(el);
    });
    return () => {
      stopLoop();
      created.forEach((el) => {
        el.pause();
        el.removeAttribute('src');
        el.load();
      });
      audios.current = {};
    };
  }, [paint, startLoop, stopLoop, sources]);

  // 다른 소스(글로벌 미니 플레이어·포트폴리오 플레이어)가 울리면 멈춘다 — 한 번에 하나만(lib/audio/audioBus).
  React.useEffect(() => onOtherPlay('mix-compare', () => {
    const el = audios.current[activeRef.current];
    if (el && !el.paused) {
      el.pause();
      stopLoop();
      setPlaying(false);
    }
  }), [stopLoop]);

  /** 메타데이터가 아직 없으면 준비되는 대로 위치를 옮긴다(iOS Safari는 그 전의 currentTime 설정을 무시한다). */
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

  const togglePlay = async () => {
    const el = audios.current[activeRef.current];
    if (!el) return;
    if (playing) {
      el.pause();
      stopLoop();
      setPlaying(false);
      return;
    }
    setFailed(false);
    announcePlay('mix-compare');
    try {
      await el.play();
    } catch {
      setFailed(true);
      return;
    }
    setPlaying(true);
    startLoop();
    if (!playedOnce.current) {
      playedOnce.current = true;
      track('mix_compare_play', activeRef.current);
      const otherSide: Side = activeRef.current === 'before' ? 'after' : 'before';
      const other = audios.current[otherSide];
      if (other) {
        other.preload = 'auto';
        other.load();
      }
    }
  };

  const choose = (next: Side) => {
    const current = activeRef.current;
    if (next === current) return;
    const from = audios.current[current];
    const to = audios.current[next];
    if (!from || !to) return;
    const position = from.currentTime;
    activeRef.current = next;
    setActive(next);
    setAnnounce(copy.switchedTo[next]);
    track('mix_compare_switch', next);
    seekWhenReady(to, position);
    if (!playing) return;
    setFailed(false);
    to.play().then(
      // 그 사이 사용자가 다시 되돌려 이 음원이 도로 활성이 됐다면 멈추지 않는다 — 빠른 A→B→A 전환에서
      // 첫 전환의 뒤늦은 pause가 방금 다시 켠 소리를 끄던 경쟁.
      () => { if (activeRef.current !== current) from.pause(); },
      () => {
        from.pause();
        stopLoop();
        setPlaying(false);
        setFailed(true);
      },
    );
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(e.target.value);
    const el = audios.current[activeRef.current];
    if (el) seekWhenReady(el, seconds);
    setTime(seconds);
    paint(seconds);
  };

  return (
    <div>
      <div role="group" aria-label={copy.group} className="grid grid-cols-2 gap-3 mb-6">
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            aria-pressed={active === side}
            onClick={() => choose(side)}
            className={cn(
              'min-h-[56px] rounded-xl border-2 px-3 py-3 text-base font-bold leading-snug break-keep transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
              active === side
                ? 'border-primary bg-primary text-white'
                : 'border-gray-300 bg-transparent text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5',
            )}
          >
            {copy[side]}
          </button>
        ))}
      </div>

      <div className="relative h-28 md:h-36 rounded-lg focus-within:ring-2 focus-within:ring-primary/70 dark:focus-within:ring-primary-lighter/70 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-gray-900">
        <Bars values={peaks[active]} className="bg-gray-300 dark:bg-gray-700" />
        <div ref={clipRef} className="absolute inset-0" style={{ clipPath: 'inset(0 100% 0 0)' }}>
          <Bars values={peaks[active]} className="bg-primary dark:bg-primary-lighter" />
        </div>
        <input
          ref={rangeRef}
          type="range"
          min={0}
          max={durationSeconds}
          step={0.5}
          defaultValue={0}
          onChange={onSeek}
          aria-label={copy.position}
          aria-valuetext={`${formatTime(time)} / ${formatTime(durationSeconds)}`}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 touch-pan-y"
        />
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Button
          type="button"
          variant="solid"
          shape="pill"
          size="icon"
          className="h-14 w-14 shrink-0"
          aria-label={playing ? copy.pause : copy.play}
          onClick={togglePlay}
        >
          {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" className="translate-x-px" />}
        </Button>
        <p className="font-title text-lg font-semibold tabular-nums text-gray-950 dark:text-white">
          {formatTime(time)}
          <span className="text-gray-500 dark:text-gray-400"> / {formatTime(durationSeconds)}</span>
        </p>
      </div>

      <p role="status" className={cn('mt-4 typo-card-body', failed ? 'text-red-700 dark:text-red-400' : 'sr-only')}>
        {failed ? copy.error : announce}
      </p>

      <div className="mt-8 border-t border-gray-200 dark:border-gray-800 pt-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="typo-card-body text-gray-600 dark:text-gray-300 break-keep">{copy.note}</p>
        </div>
        {showPortfolioLink && (
          <Link
            href={portfolioHref}
            prefetch={false}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary dark:text-primary-lighter hover:underline underline-offset-4 rounded-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
          >
            {copy.portfolio}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
