import React from 'react';
import { m, useScroll, useSpring } from 'framer-motion';

interface ScrollProgressProps {
    disabled?: boolean;
}

export const ScrollProgress: React.FC<ScrollProgressProps> = ({ disabled = false }) => {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    if (disabled) {
        return null;
    }

    return (
        <m.div
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent z-[60] origin-left"
            style={{ scaleX }}
        />
    );
};

export default ScrollProgress;
