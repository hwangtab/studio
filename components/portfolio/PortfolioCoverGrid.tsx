import React from 'react';
import Image from 'next/image';
import { Badge } from '../ui/Badge';
import CoverPlayButton from '../audio/CoverPlayButton';
import { getExcerptForPortfolio, toGlobalTrack } from '../../data/audioExcerpts';
import type { PortfolioItem, PortfolioCategory } from '../../types/data';
import type { Locale } from '../../lib/i18n';

interface PortfolioCoverGridProps {
  locale: Locale;
  items: readonly PortfolioItem[];
  categories: readonly PortfolioCategory[];
  onSelect: (item: PortfolioItem) => void;
  viewProjectLabel: string;
}

/**
 * 포트폴리오 커버 그리드(라이너 노트 §3-6 c·§3-8). 목록 행(배지·크레딧 나열)은 상세로 보내고, 목록은 홈 커버
 * 그리드와 같은 문법 — 커버·제목·아티스트·연도·분류 배지 하나. 30초 발췌가 있는 커버(data/audioExcerpts.ts)에는
 * 재생 버튼이 붙는다. 카드는 버튼(모달을 연다 — 기존 handleCardClick); 재생 버튼은 그 형제라 중첩되지 않는다.
 */
const PortfolioCoverGrid = ({ locale, items, categories, onSelect, viewProjectLabel }: PortfolioCoverGridProps) => {
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4" role="list">
      {items.map((item) => {
        const excerpt = getExcerptForPortfolio(item.id);
        const track = excerpt ? toGlobalTrack(excerpt, locale, 'PortfolioGrid', `/${locale}/portfolio/${item.id}`) : null;
        return (
          <li key={item.id} className="relative">
            <button
              type="button"
              onClick={() => onSelect(item)}
              aria-label={`${viewProjectLabel}: ${item.title}`}
              className="group block w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
                  className="object-cover"
                />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100 line-clamp-2 break-keep">{item.title}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {item.artist}
                    {item.releaseDate ? <span className="tabular-nums"> · {item.releaseDate.slice(0, 4)}</span> : null}
                  </p>
                </div>
                <Badge tone="neutral" size="sm" className="shrink-0 mt-0.5">{categoryName(item.category)}</Badge>
              </div>
            </button>
            {track && (
              <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
                <CoverPlayButton track={track} className="pointer-events-auto absolute bottom-2 right-2" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default PortfolioCoverGrid;
