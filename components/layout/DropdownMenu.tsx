import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface MenuItem {
    label: string;
    href: string;
}

interface DropdownMenuProps {
    label: string;
    items: MenuItem[];
    isTransparent: boolean;
    currentPath: string;
    onNavigate: () => void;

}

export const DropdownMenu = ({
    label,
    items,
    isTransparent,
    currentPath,
    onNavigate,
}: DropdownMenuProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const menuId = React.useId();


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
        const handleClickOutside = (e: MouseEvent) => {
            if (isOpen && containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(prev => !prev);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'ArrowDown' && isOpen) {
            e.preventDefault();
            itemRefs.current[0]?.focus();
        }
    };

    const handleItemKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Escape') {
            setIsOpen(false);
            triggerRef.current?.focus();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (index + 1) % items.length;
            itemRefs.current[nextIndex]?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (index - 1 + items.length) % items.length;
            itemRefs.current[prevIndex]?.focus();
        }
    };

    const isActive = items.some(item => currentPath === item.href);

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                ref={triggerRef}
                type="button"
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-[15px] font-medium text-sm transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-canvas-deep ${isActive
                    ? !isTransparent
                        ? 'text-link dark:text-link-on-dark font-bold'
                        : 'text-white font-bold bg-white/20'
                    : !isTransparent
                        ? 'text-ink-muted-80 dark:text-on-dark hover:opacity-70'
                        : 'text-white hover:opacity-70'
                    }`}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                aria-controls={menuId}
                onClick={() => setIsOpen((prev) => !prev)}
                onKeyDown={handleKeyDown}
            >
                {label}
                <m.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown size={14} aria-hidden="true" />
                </m.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        id={menuId}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute left-0 mt-1 w-48 rounded-card bg-canvas-soft dark:bg-surface-dark-elevated backdrop-blur-xl shadow-card border border-hairline dark:border-white/10 overflow-hidden z-50 origin-top-left"
                    >
                        <div className="py-2" role="menu" aria-orientation="vertical">
                            {items.map((item, index) => {
                                const isItemActive = currentPath === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        ref={el => { itemRefs.current[index] = el; }}
                                        role="menuitem"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onNavigate();
                                        }}
                                        onKeyDown={(e) => handleItemKeyDown(e, index)}
                                        className={`flex items-center min-h-[44px] px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-ink/[0.04] focus-visible:text-link ${isItemActive
                                            ? 'bg-ink/[0.06] text-link dark:text-link-on-dark font-medium'
                                            : 'text-ink-muted-80 dark:text-on-dark-soft hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
};
