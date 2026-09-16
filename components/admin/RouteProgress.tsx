import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * 관리자 화면의 라우트 전환 표시.
 *
 * 관리자 페이지는 전부 getServerSideProps라 링크를 누르면 서버 왕복이 한 번 일어난다.
 * 그동안 Pages Router는 화면을 전혀 바꾸지 않는다 — 200ms든 2초든 "눌렀는데 아무 일도
 * 안 일어나는" 시간으로 보인다. 실제 속도를 줄이지는 못하지만, 기다리는 중이라는 사실은
 * 알려 준다. 이 화면이 느리게 느껴지던 몫의 상당 부분이 그 침묵이었다.
 *
 * **지연 후에만 나타난다.** 관리자 화면 안에서의 전환은 실측 55~67ms라, 지연 없이 띄우면
 * 대부분의 클릭에서 막대가 깜빡하고 사라진다 — 없는 것보다 산만하다. 느린 전환에서만
 * 보이게 해서 "평소엔 조용하고 기다릴 때만 뜨는" 신호로 만든다.
 */
const START_DELAY_MS = 150;
/** 100%에 닿은 막대를 잠깐 두는 시간. 곧바로 지우면 완료를 본 적이 없게 된다. */
const FINISH_HOLD_MS = 200;

type Phase = 'idle' | 'running' | 'finishing';

const BAR_CLASS: Record<Phase, string> = {
  // 초기화는 즉시 — transition을 걸어 두면 100%에서 0으로 줄어드는 것이 보인다.
  idle: 'w-0 opacity-0',
  // 끝을 모르는 대기라 2/3까지만 천천히 간다. 서버 응답이 오면 finishing이 100%로 마무리한다.
  running: 'w-2/3 opacity-100 transition-[width] duration-[2000ms] ease-out',
  finishing: 'w-full opacity-100 transition-[width] duration-150 ease-out',
};

export default function RouteProgress() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    // 막대를 실제로 띄웠는지. 지연 안에 끝난 전환은 완료 애니메이션도 보여선 안 된다.
    let shown = false;

    const start = () => {
      clearTimeout(hideTimer);
      hideTimer = undefined;
      showTimer = setTimeout(() => {
        shown = true;
        setPhase('running');
      }, START_DELAY_MS);
    };

    const end = () => {
      clearTimeout(showTimer);
      showTimer = undefined;
      if (!shown) {
        // 지연 안에 끝났다 — 띄운 적이 없으므로 조용히 접는다.
        setPhase('idle');
        return;
      }
      setPhase('finishing');
      hideTimer = setTimeout(() => {
        shown = false;
        setPhase('idle');
      }, FINISH_HOLD_MS);
    };

    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', end);
    // 실패해도 막대는 걷어야 한다 — 남겨 두면 영원히 로딩 중인 화면이 된다.
    router.events.on('routeChangeError', end);

    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', end);
      router.events.off('routeChangeError', end);
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [router.events]);

  return (
    <div className="fixed inset-x-0 top-0 z-[70] h-0.5 pointer-events-none" aria-live="polite" role="status">
      <div className={`h-full bg-primary ${BAR_CLASS[phase]}`} />
      {phase !== 'idle' && <span className="sr-only">페이지를 불러오는 중입니다</span>}
    </div>
  );
}
