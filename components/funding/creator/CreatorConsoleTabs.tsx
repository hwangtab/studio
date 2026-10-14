import Link from 'next/link';

import { cn } from '../../../lib/utils';

export type CreatorConsoleTab = 'funding' | 'shows' | 'shop' | 'payout';

const TABS: ReadonlyArray<{ key: CreatorConsoleTab; href: string; label: string }> = [
  { key: 'funding', href: '/ko/funding/creator', label: '펀딩 프로젝트' },
  { key: 'shows', href: '/ko/funding/creator/shows', label: '공연' },
  { key: 'shop', href: '/ko/funding/creator/shop', label: '상점' },
  { key: 'payout', href: '/ko/funding/creator/payout', label: '정산 정보' },
];

/**
 * 개설자 콘솔 상단 탭 — 펀딩 프로젝트 | 공연 | 상점 | 정산 정보. 현재 탭은 링크지만 `aria-current`로 표시한다.
 * 정산 정보 탭은 늘 보인다 — 열어도 되는 계정인지는 그 페이지가 판정한다(다른 탭마다 자격 조회를 넣지 않는다).
 */
export function CreatorConsoleTabs({ current }: { current: CreatorConsoleTab }) {
  return (
    <nav aria-label="콘솔" className="mb-8 flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          aria-current={t.key === current ? 'page' : undefined}
          className={cn(
            'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
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
