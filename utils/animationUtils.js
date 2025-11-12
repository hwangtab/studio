// 페이지 제목 및 애니메이션 관련 공통 설정

// 메인 페이지 제목 애니메이션 (h1)
export const PAGE_TITLE_ANIMATION = {
  initial: { opacity: 0, y: -30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

// 페이지 부제목/설명 애니메이션
export const PAGE_SUBTITLE_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.2, ease: "easeOut" }
};

// 카테고리 필터 등 추가 요소 애니메이션
export const PAGE_CONTENT_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.4, ease: "easeOut" }
};

// 히어로 섹션용 특별 애니메이션 (Home 페이지)
export const HERO_TITLE_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" }
};

export const HERO_SUBTITLE_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.2, ease: "easeOut" }
};

export const HERO_CTA_ANIMATION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay: 0.4, ease: "easeOut" }
};

// 카드 스태거 애니메이션용
export const STAGGER_CONTAINER = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3
    }
  }
};

export const STAGGER_ITEM = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};