import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { ChevronDown } from '@/lib/lucide-icons';
import { DUR, EASE_STANDARD } from '../../utils/animationUtils';

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

    // 경로가 바뀌면 닫는다. Header가 페이지 전환으로 remount되지 않아, 뒤로가기처럼
    // 링크 클릭이 아닌 이동에서는 열린 상태가 그대로 남는다(MobileNav와 같은 원인).
    // 여기는 포커스 트랩이 없고 absolute 배치라 피해는 작지만, 새 페이지에 이전 메뉴가
    // 떠 있는 것은 마찬가지다.
    useEffect(() => {
        setIsOpen(false);
    }, [currentPath]);

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
        } else if (e.key === 'Tab') {
            setIsOpen(false);
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
                className={`flex items-center gap-1 px-2 xl:px-3 py-2 rounded-md typo-nav-link text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${isActive
                    ? !isTransparent
                        ? 'text-primary dark:text-accent-light font-bold'
                        : 'text-white font-bold bg-white/20'
                    : !isTransparent
                        ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-accent-light'
                        : 'text-white hover:bg-white/10 hover:text-white'
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
                    transition={{ duration: DUR.fast, ease: EASE_STANDARD }}
                >
                    <ChevronDown size={14} aria-hidden="true" />
                </m.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <m.div
                        id={menuId}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: DUR.fast, ease: EASE_STANDARD }}
                        className="absolute left-0 mt-1 w-48 rounded-xl glass-menu overflow-hidden z-50 origin-top-left"
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
                                        aria-current={isItemActive ? 'page' : undefined}
                                        onClick={() => {
                                            setIsOpen(false);
                                            onNavigate();
                                        }}
                                        onKeyDown={(e) => handleItemKeyDown(e, index)}
                                        className={`flex items-center min-h-[44px] px-4 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:text-primary dark:focus-visible:text-primary-lighter ${isItemActive
                                            ? 'bg-primary/5 text-primary dark:text-accent-light font-medium'
                                            : 'text-gray-700 dark:text-gray-200 hover:bg-white/45 dark:hover:bg-white/10'
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
