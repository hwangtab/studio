// iOS Safari 잔존 깜빡 fix(2026-05-11):
// - 모든 motion 패턴의 initial prop을 false로 통일 — SSR HTML에 opacity:0/y:20 같은
//   정적 motion 값이 박히지 않아 첫 paint부터 정확. hydration 시 jump-cut frame jank 0.
// - 단점: viewport 진입 fade-in/slide-in 효과 사라짐 (즉시 표시). 안정성 우선 trade-off.
// - desktop에서도 동일 적용 — initial=false는 framer-motion이 SSR HTML 그대로 둠.

export const FADE_IN_UP = {
  initial: false as const,
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "0px 0px -50px 0px" },
  transition: { duration: 0.4 }
};

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

export const STAGGER_CONTAINER = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const STAGGER_ITEM = {
  initial: false as const,
  animate: { opacity: 1, y: 0 }
};

export const TEXT_REVEAL = {
  initial: false as const,
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: [0.33, 1, 0.68, 1] }
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
