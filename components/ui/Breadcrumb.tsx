import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Breadcrumb as BreadcrumbItem } from '../../types/data';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="breadcrumb" className={cn('text-caption text-ink-muted-60 dark:text-on-dark-soft', className)}>
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className="flex items-center">
              {index > 0 && (
                <ChevronRight size={14} className="mx-2 flex-shrink-0 text-ink-muted-40" aria-hidden="true" />
              )}
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-medium text-ink dark:text-on-dark truncate max-w-[200px] sm:max-w-xs"
                >
                  {item.name}
                </span>
              ) : (
                // prefetch={false}: 모든 페이지 상단에 노출되는 nav. 거의 항상
                // viewport에 들어와 자동 prefetch 트리거 → 부모 listing 페이지의
                // SSG JSON이 매번 끌려와 비효율. hover/focus 시 prefetch는 유지.
                <Link
                  href={item.path}
                  prefetch={false}
                  className="text-ink-muted-60 hover:text-ink dark:hover:text-on-dark transition-colors"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
