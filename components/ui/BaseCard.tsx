import { cn } from '../../lib/utils';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface BaseCardProps {
    children: React.ReactNode;
    className?: string;
    href?: string;
    onClick?: (e: React.MouseEvent) => void;
    delay?: number;
    variant?: 'default' | 'highlight' | 'outline';
    hoverEffect?: boolean;
    enableAnimation?: boolean;
}

const BaseCard = ({
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
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        whileHover: hoverEffect ? { y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" } : {},
        viewport: { once: true, margin: "0px 0px -50px 0px" },
        transition: { duration: 0.4, delay }
    } : {
        whileHover: hoverEffect ? { y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" } : {},
        transition: { duration: 0.2 } // Faster transition for hover only
    };

    const CardContent = (
        <motion.div
            className={cn(baseStyles, variants[variant], className)}
            {...animationProps}
            onClick={onClick}
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
};

export default BaseCard;
