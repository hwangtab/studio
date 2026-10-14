import Link from 'next/link';

import { cn } from '../../../lib/utils';

export type CreatorConsoleTab = 'funding' | 'shop';

const TABS: ReadonlyArray<{ key: CreatorConsoleTab; href: string; label: string }> = [
  { key: 'funding', href: '/ko/funding/creator', label: '펀딩 프로젝트' },
  { key: 'shop', href: '/ko/funding/creator/shop', label: '상점' },
];

/** 개설자 콘솔 상단 탭 — 펀딩 프로젝트 | 상점. 현재 탭은 링크지만 `aria-current`로 표시한다. */
export function CreatorConsoleTabs({ current }: { current: CreatorConsoleTab }) {
  return (
    <nav aria-label="콘솔" className="mb-8 flex gap-2 border-b border-gray-200 dark:border-gray-700">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          aria-current={t.key === current ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            t.key === current
              ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
