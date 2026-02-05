import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FADE_IN_UP, HOVER_Y, SHADOW_HOVER } from '../../utils/animationUtils';

interface BaseCardProps {
    children: React.ReactNode;
    className?: string;
    href?: string;
    onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
    delay?: number;
    variant?: 'default' | 'highlight' | 'outline';
    hoverEffect?: boolean;
    enableAnimation?: boolean;
}

const BaseCard = React.memo(({
    children,
    className = '',
    href,
    onClick,
    delay = 0,
    variant = 'default',
    hoverEffect = true,
    enableAnimation = true,
}: BaseCardProps) => {
    const baseStyles = "relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden";


    const variants = {
        default: "shadow-md border border-gray-100 dark:border-gray-700",
        highlight: "shadow-lg border border-primary/20 dark:border-primary-light/20 ring-1 ring-primary/10 dark:ring-primary-light/10",
        outline: "border border-gray-200 dark:border-gray-700 bg-transparent",
    };

    const animationProps = enableAnimation ? {
        ...FADE_IN_UP,
        whileHover: hoverEffect ? { ...HOVER_Y, ...SHADOW_HOVER } : {},
        transition: { ...FADE_IN_UP.transition, delay }
    } : {
        whileHover: hoverEffect ? { ...HOVER_Y, ...SHADOW_HOVER } : {},
        transition: { duration: 0.2 } // Faster transition for hover only
    };

    const isInteractive = Boolean(onClick);
    const CardContent = (
        <motion.div
            className={cn(baseStyles, variants[variant], className)}
            {...animationProps}
            onClick={onClick}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            onKeyDown={(event) => {
                if (!onClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick(event);
                }
            }}
        >
            {children}
        </motion.div>
    );

    if (href) {
        return (
            <Link href={href} className="block h-full" onClick={(e) => onClick && onClick(e)}>
                {CardContent}
            </Link>
        );
    }

    return CardContent;
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
