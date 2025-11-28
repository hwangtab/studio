import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const BaseCard = ({
    children,
    className = '',
    href,
    onClick,
    delay = 0,
    variant = 'default', // default, highlight, outline
    hoverEffect = true,
}) => {
    const baseStyles = "relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden transition-all duration-300";

    const variants = {
        default: "shadow-md border border-gray-100 dark:border-gray-700",
        highlight: "shadow-lg border border-primary/20 dark:border-primary-light/20 ring-1 ring-primary/10 dark:ring-primary-light/10",
        outline: "border border-gray-200 dark:border-gray-700 bg-transparent",
    };

    const hoverStyles = hoverEffect ? "hover:shadow-xl hover:-translate-y-1" : "";

    const CardContent = (
        <motion.div
            className={`${baseStyles} ${variants[variant]} ${hoverStyles} ${className}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay }}
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

export default React.memo(BaseCard, (prevProps, nextProps) => {
    // Custom comparison: only re-render if these key props change
    return (
        prevProps.href === nextProps.href &&
        prevProps.variant === nextProps.variant &&
        prevProps.className === nextProps.className &&
        prevProps.children === nextProps.children &&
        prevProps.onClick === nextProps.onClick &&
        prevProps.delay === nextProps.delay &&
        prevProps.hoverEffect === nextProps.hoverEffect
    );
});
