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
