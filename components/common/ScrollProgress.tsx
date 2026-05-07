import React from 'react';

interface ScrollProgressProps {
    disabled?: boolean;
}

// CSS-only scroll-driven animation (animation-timeline: scroll). PSI 데스크톱에서
// 'Forced reflow 9079ms' 주범이던 framer-motion useScroll + useSpring 조합 제거.
// 매 스크롤 frame마다 scrollHeight/clientHeight query + transform mutation으로 발생하던
// layout thrashing 0. modern Chrome 115+/Safari 26+/Edge 115+ 지원, 미지원 브라우저
// (Firefox 등)는 fallback CSS가 default scaleX 0으로 보이지 않아 graceful degradation.
const ScrollProgressBar: React.FC = () => (
    <div
        aria-hidden="true"
        className="scroll-progress-bar fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent z-[60] origin-left"
    />
);

export const ScrollProgress: React.FC<ScrollProgressProps> = ({ disabled = false }) => {
    if (disabled) {
        return null;
    }

    return (
        <ScrollProgressBar />
    );
};

export default ScrollProgress;
