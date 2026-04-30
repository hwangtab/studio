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
            className="fixed top-0 left-0 right-0 z-50 bg-hairline h-[3px]"
        >
            <m.div
                className="h-full bg-link origin-left"
                style={{ scaleX }}
            />
        </m.div>
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
