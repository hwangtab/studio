import React from 'react';
import Link from 'next/link';
import { Music } from '@/lib/lucide-icons';

import ResponsiveImage from '../ResponsiveImage';
import { Badge } from './Badge';
import type { PortfolioItem } from '../../types/data';
import type { Locale } from '../../lib/i18n';

interface PortfolioMiniCardProps {
  item: PortfolioItem;
  locale: Locale;
}


/**
 * 스토리 본문 안에 인라인으로 노출하는 가벼운 portfolio 카드.
 * ProjectRowCard와 달리 modal이 아닌 portfolio detail 페이지로 직접 링크해
 * SEO 내부 링크 그래프와 크롤 동선에 기여한다.
 */
const PortfolioMiniCard = ({ item, locale }: PortfolioMiniCardProps) => {
  const href = `/${locale}/portfolio/${item.id}`;

  return (
    <Link
      href={href}
      prefetch={false}
      // 리프트 모션은 BaseCard가 소유한다(§4) — 인라인 카드의 CSS translate 복제는 걷었다. 이미지 줌만 남긴다.
      className="group block h-full rounded-xl overflow-hidden glass-card touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
        <ResponsiveImage
          src={item.image}
          alt={`${item.title} — ${item.artist}`}
          pictureClassName="w-full h-full"
          className="w-full h-full object-cover"
          width={300}
          height={300}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
        />
      </div>
      <div className="p-4">
        {/* 카테고리별 색(핑크·에메랄드…)은 다섯 분류를 외워야 뜻이 생기는 장식이라 중립 배지로 통일한다. */}
        <Badge tone="neutral" className="mb-2 uppercase tracking-wider">
          {item.category}
        </Badge>
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
