import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface MenuItem {
    label: string;
    href: string;
}

interface DropdownMenuProps {
    label: string;
    items: MenuItem[];
    isScrolled: boolean;
    hasHero: boolean;
    currentPath: string;
    onNavigate: () => void;
}

export const DropdownMenu = ({
    label,
    items,
    isScrolled,
    hasHero,
    currentPath,
    onNavigate
}: DropdownMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const isActive = items.some(item => currentPath === item.href);

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className={`flex items-center gap-1 px-3 py-2 rounded-md typo-nav-link text-sm transition-colors duration-300 focus:outline-none ${isActive
                        ? 'text-primary dark:text-accent font-bold'
                        : isScrolled || !hasHero
                            ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                            : 'text-white hover:bg-white/10'
                    }`}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {label}
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown size={14} />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 mt-1 w-48 rounded-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 origin-top-left"
                    >
                        <div className="py-2">
                            {items.map((item) => {
                                const isItemActive = currentPath === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => {
                                            setIsOpen(false);
                                            onNavigate();
                                        }}
                                        className={`block px-4 py-2.5 text-sm transition-colors ${isItemActive
                                                ? 'bg-primary/5 text-primary dark:text-accent font-medium'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
