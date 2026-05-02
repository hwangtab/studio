export const FADE_IN_UP = {
  initial: { opacity: 0, y: 20 },
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
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

export const PAGE_SUBTITLE_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.2 }
};

export const PAGE_CONTENT_ANIMATION = {
  initial: { opacity: 0 },
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
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};
export const TEXT_REVEAL = {
  initial: { y: "100%", opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: [0.33, 1, 0.68, 1] }
};

export const SCROLL_REVEAL = {
  initial: { opacity: 0, y: 30 },
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const }
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
  distance = 20,
  duration = 0.5,
  delay = 0,
}: EnterAnimationOptions = {}) => ({
  initial: { opacity: 0, [axis]: distance },
  animate: { opacity: 1, [axis]: 0 },
  transition: { duration, delay },
});

export const createFadeInAnimation = ({
  duration = 0.8,
  delay = 0,
}: FadeInAnimationOptions = {}) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration, delay },
});

export const createInViewEnterAnimation = ({
  axis = 'y',
  distance = 20,
  delay,
  duration,
  once = true,
  margin,
}: InViewEnterAnimationOptions = {}) => {
  const transition: { delay?: number; duration?: number } = {};
  if (typeof delay === 'number') transition.delay = delay;
  if (typeof duration === 'number') transition.duration = duration;

  const base = {
    initial: { opacity: 0, [axis]: distance },
    whileInView: { opacity: 1, [axis]: 0 },
    viewport: margin ? { once, margin } : { once },
  };
  return Object.keys(transition).length > 0 ? { ...base, transition } : base;
};
