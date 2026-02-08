import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { m } from 'framer-motion';
import { FADE_IN_UP, HOVER_Y, SHADOW_HOVER } from '../../utils/animationUtils';

interface BaseCardProps {
    children: React.ReactNode;
    className?: string;
    href?: string;
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    target?: string;
    rel?: string;
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
    target,
    rel,
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

    const isInteractive = Boolean(onClick || href);
    const interactiveStyles = isInteractive
        ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        : "";
    const cardClassName = cn(baseStyles, variants[variant], interactiveStyles, className);
    const isExternal = Boolean(href && /^(https?:|mailto:|tel:)/.test(href));

    if (href) {
        const resolvedRel = target === '_blank' ? (rel ?? 'noopener noreferrer') : rel;
        const anchorProps = {
            className: cardClassName,
            onClick,
            target,
            rel: resolvedRel,
        };

        if (isExternal) {
            return (
                <m.a href={href} {...animationProps} {...anchorProps}>
                    {children}
                </m.a>
            );
        }

        return (
            <Link href={href} legacyBehavior passHref>
                <m.a {...animationProps} {...anchorProps}>
                    {children}
                </m.a>
            </Link>
        );
    }

    if (onClick) {
        return (
            <m.button
                type="button"
                className={cardClassName}
                {...animationProps}
                onClick={onClick}
            >
                {children}
            </m.button>
        );
    }

    return (
        <m.div
            className={cardClassName}
            {...animationProps}
        >
            {children}
        </m.div>
    );
});

BaseCard.displayName = 'BaseCard';

export default BaseCard;
