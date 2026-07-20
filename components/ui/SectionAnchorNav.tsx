import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface AnchorItem {
  id: string;
  label: string;
}

interface SectionAnchorNavProps {
  items: AnchorItem[];
  /** 접근성 라벨 — 섹션 목차임을 스크린리더에 알림 */
  ariaLabel: string;
  className?: string;
}

// fixed 헤더(64px) + 여유. 앵커 이동·스크롤스파이 판정 기준선.
const SCROLL_OFFSET_PX = 96;

/**
 * 긴 페이지용 sticky 앵커 목차(pill bar).
 *
 * - 가로 스크롤 컨테이너로 모바일에서 항목이 많아도 한 줄 유지.
 * - IntersectionObserver 기반 scroll-spy로 현재 섹션 pill을 활성화.
 * - prefers-reduced-motion 시 smooth 스크롤 대신 즉시 이동.
 * - 각 대상 섹션에는 scroll-margin-top(scroll-mt-24 등)이 필요하다.
 */
export const SectionAnchorNav = ({ items, ariaLabel, className }: SectionAnchorNavProps) => {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    // 헤더 높이만큼 상단 여백을 제외한 밴드 안에 들어온 섹션 중 가장 위를 활성으로.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id;
          if (id !== activeRef.current) setActiveId(id);
        }
      },
      { rootMargin: `-${SCROLL_OFFSET_PX}px 0px -55% 0px`, threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) return; // href 앵커 기본 동작에 맡김
      event.preventDefault();
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      setActiveId(id);
      // 딥링크·뒤로가기 보존. 스크롤은 위에서 이미 처리했으므로 replaceState로 점프 방지.
      if (typeof history !== 'undefined') {
        history.replaceState(null, '', `#${id}`);
      }
    },
    []
  );

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className={`sticky top-16 z-30 glass-bar border-b border-gray-200/70 dark:border-gray-800/70 ${className ?? ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <li key={item.id} className="flex-shrink-0">
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`inline-flex items-center min-h-[40px] px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 ${isActive
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary/10 hover:text-primary dark:hover:text-accent'
                    }`}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default SectionAnchorNav;
