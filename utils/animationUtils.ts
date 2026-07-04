// iOS Safari 잔존 깜빡 fix(2026-05-11):
// - 모든 motion 패턴의 initial prop을 false로 통일 — SSR HTML에 opacity:0/y:20 같은
//   정적 motion 값이 박히지 않아 첫 paint부터 정확. hydration 시 jump-cut frame jank 0.
// - 단점: viewport 진입 fade-in/slide-in 효과 사라짐 (즉시 표시). 안정성 우선 trade-off.
// - desktop에서도 동일 적용 — initial=false는 framer-motion이 SSR HTML 그대로 둠.

// ─────────────────────────────────────────────────────────────────────────
// 리듬 토큰 SSOT (2026-07 도입) — hover/tap·transition의 duration·easing 단일 출처.
// 컴포넌트/페이지에서 duration 숫자(0.3, 0.25 등)를 재정의하지 말 것. 아래 토큰만 import.
// framer(초)와 Tailwind CSS(ms) 이름 동기화 (tailwind.config.ts theme.extend와 쌍):
//   DUR.fast (0.2s)  ↔  duration-fast  (200ms)  — 색·소형 피드백 (현재 다수파: duration-200)
//   DUR.base (0.3s)  ↔  duration-base  (300ms)  — 표준 hover·scale (현재 다수파: duration-300)
//   DUR.slow (0.7s)  ↔  duration-slow  (700ms)  — 썸네일 zoom (현재 다수파: duration-700 7곳)
// easing 표준 1종: EASE_STANDARD = cubic-bezier(0.4,0,0.2,1) = Tailwind ease-in-out DEFAULT
//   ↔ Tailwind `ease-standard`. (기존 duration-200/300/700·ease-* 기본 클래스도 그대로 유효
//   — extend는 병합이라 하위호환.)
// ─────────────────────────────────────────────────────────────────────────

/** 표준 easing (framer bezier). Tailwind `ease-standard`/`ease-in-out`과 동일 값. */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;

/** duration 토큰(초, framer용). Tailwind `duration-fast|base|slow`(ms)와 이름 동기화. */
export const DUR = { fast: 0.2, base: 0.3, slow: 0.7 } as const;

/** 표준 transition(base duration + 표준 easing). hover/tap에 그대로 spread해 재정의 방지. */
export const TRANSITION_STANDARD = { duration: DUR.base, ease: EASE_STANDARD };

export const FADE_IN_UP = {
  initial: false as const,
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "0px 0px -50px 0px" },
  transition: { duration: 0.4 }
};

// 카드 lift = 값 + 리듬 묶음. whileHover에 CARD_HOVER 하나만 넣으면 duration 재정의 불필요.
// 그림자까지 원하면 whileHover={{ ...CARD_HOVER, ...SHADOW_HOVER }}.
export const CARD_HOVER = { y: -4, transition: TRANSITION_STANDARD };

// 아래 3개는 값만 있는 하위호환 export(기존 소비처 유지). 표준 리듬을 붙이려면
// TRANSITION_STANDARD를 함께 spread: whileHover={{ ...HOVER_SCALE, transition: TRANSITION_STANDARD }}
export const HOVER_Y = { y: -4 };

export const HOVER_SCALE = { scale: 1.05 };

export const TAP_SCALE = { scale: 0.95 };

export const SHADOW_HOVER = {
  boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
};

export const VIEWPORT_ONCE = { once: true };

export const PAGE_TITLE_ANIMATION = {
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

export const PAGE_SUBTITLE_ANIMATION = {
  initial: false as const,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.2 }
};

export const PAGE_CONTENT_ANIMATION = {
  initial: false as const,
  whileInView: { opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.8, delay: 0.4 }
};

// SCROLL_REVEAL은 variants 패턴(SectionHeading 등에서 variants prop으로 사용)이라
// initial 키가 객체 형태여야. 효과 비활성을 위해 initial 값을 whileInView와 동일하게 두면
// motion 시뮬레이션 없음 + 첫 paint부터 정확한 값.
export const SCROLL_REVEAL = {
  initial: { opacity: 1, y: 0 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0 }
  }
};

interface EnterAnimationOptions {
  axis?: 'x' | 'y';
  distance?: number;
  duration?: number;
  delay?: number;
}

interface FadeInAnimationOptions {
  duration?: number;
  delay?: number;
}

interface InViewEnterAnimationOptions {
  axis?: 'x' | 'y';
  distance?: number;
  delay?: number;
  duration?: number;
  once?: boolean;
  margin?: string;
}

export const createEnterAnimation = ({
  axis = 'y',
  distance: _distance = 20,
  duration = 0.5,
  delay = 0,
}: EnterAnimationOptions = {}) => ({
  initial: false as const,
  animate: { opacity: 1, [axis]: 0 },
  transition: { duration, delay },
});

export const createFadeInAnimation = ({
  duration = 0.8,
  delay = 0,
}: FadeInAnimationOptions = {}) => ({
  initial: false as const,
  animate: { opacity: 1 },
  transition: { duration, delay },
});

export const createInViewEnterAnimation = ({
  axis = 'y',
  distance: _distance = 20,
  delay,
  duration,
  once = true,
  margin,
}: InViewEnterAnimationOptions = {}) => {
  const transition: { delay?: number; duration?: number } = {};
  if (typeof delay === 'number') transition.delay = delay;
  if (typeof duration === 'number') transition.duration = duration;

  return {
    initial: false as const,
    whileInView: { opacity: 1, [axis]: 0 },
    viewport: margin ? { once, margin } : { once },
    transition,
  };
};
