import React, { useCallback } from 'react';
import { List } from '@/lib/lucide-icons';
import { extractMarkdownHeadings } from './extractHeadings';

interface TableOfContentsProps {
  content: string;
  /** "목차" 등 제목 라벨 */
  title: string;
  className?: string;
}

// 이 개수 미만이면 목차가 오히려 소음 → 렌더하지 않는다.
const MIN_HEADINGS = 3;

/**
 * 롱폼 마크다운 본문 상단에 놓는 접이식 목차(details/summary).
 *
 * - `##`(level 2)·`###`(level 3) 헤딩을 추출해 앵커 링크로 노출, 3rd는 들여쓰기.
 * - 헤딩이 3개 미만이면 렌더하지 않음.
 * - 클릭 시 prefers-reduced-motion을 존중하는 부드러운 스크롤 + 해시 갱신.
 * - 대상 헤딩에는 MarkdownRenderer가 scroll-margin-top을 부여한다.
 */
const TableOfContents = ({ content, title, className }: TableOfContentsProps) => {
  const headings = React.useMemo(() => extractMarkdownHeadings(content), [content]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    if (typeof history !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
  }, []);

  if (headings.length < MIN_HEADINGS) return null;

  return (
    <details
      open
      className={`mb-10 rounded-lg border border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-800/40 ${className ?? ''}`}
    >
      <summary className="flex items-center gap-2 cursor-pointer select-none px-5 py-3 font-bold text-gray-900 dark:text-white touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg">
        <List size={18} aria-hidden="true" className="text-primary" />
        {title}
      </summary>
      <nav aria-label={title} className="px-5 pb-4 pt-1">
        <ul className="space-y-1">
          {headings.map((heading, index) => (
            <li
              key={`${heading.id}-${index}`}
              className={heading.level >= 3 ? 'pl-4' : ''}
            >
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleClick(e, heading.id)}
                className={`block py-1.5 text-sm leading-snug rounded transition-colors hover:text-primary dark:hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${heading.level >= 3
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-gray-700 dark:text-gray-300 font-medium'
                  }`}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
};

export default TableOfContents;
