import React from 'react';
import { m, useScroll, useSpring } from 'framer-motion';

interface ScrollProgressProps {
    disabled?: boolean;
}

const ScrollProgressBar: React.FC = () => {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    return (
        <m.div
            className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-accent z-[60] origin-left"
            style={{ scaleX }}
        />
    );
};

export const ScrollProgress: React.FC<ScrollProgressProps> = ({ disabled = false }) => {
    if (disabled) {
        return null;
    }

    return (
        <ScrollProgressBar />
    );
};

export default ScrollProgress;
