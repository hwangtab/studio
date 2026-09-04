import React from 'react';
import Link from 'next/link';
import { Music } from '@/lib/lucide-icons';

import ResponsiveImage from '../ResponsiveImage';
import type { PortfolioItem } from '../../types/data';
import type { Locale } from '../../lib/i18n';

interface PortfolioMiniCardProps {
  item: PortfolioItem;
  locale: Locale;
}

const CATEGORY_BADGE: Record<string, string> = {
  album: 'bg-pink-50 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  ep: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
  single: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  compilation: 'bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  commercial: 'bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
};

/**
 * 스토리 본문 안에 인라인으로 노출하는 가벼운 portfolio 카드.
 * ProjectRowCard와 달리 modal이 아닌 portfolio detail 페이지로 직접 링크해
 * SEO 내부 링크 그래프와 크롤 동선에 기여한다.
 */
const PortfolioMiniCard = ({ item, locale }: PortfolioMiniCardProps) => {
  const href = `/${locale}/portfolio/${item.id}`;
  const badgeClass = CATEGORY_BADGE[item.category] ?? 'bg-gray-50 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300';

  return (
    <Link
      href={href}
      prefetch={false}
      className="group block h-full rounded-lg overflow-hidden glass-card hover:-translate-y-0.5 transition-transform duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        <ResponsiveImage
          src={item.image}
          alt={`${item.title} — ${item.artist}`}
          pictureClassName="w-full h-full"
          className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-105"
          width={300}
          height={300}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
        />
      </div>
      <div className="p-4">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-2 ${badgeClass}`}>
          {item.category}
        </span>
        <h4 className="typo-card-subtitle line-clamp-2 mb-1 text-gray-900 dark:text-white">
          {item.title}
        </h4>
        <p className="typo-card-body text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
          <Music size={14} aria-hidden="true" className="flex-shrink-0" />
          <span className="truncate">{item.artist}</span>
        </p>
      </div>
    </Link>
  );
};

export default React.memo(PortfolioMiniCard);
