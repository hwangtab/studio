import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookMarked } from '@/lib/lucide-icons';

import type { Locale } from '../../lib/i18n';
import type { BuyerIntentHubSlug } from '../../data/buyerIntentHubs';

interface HubLinkCalloutProps {
  hubSlug: BuyerIntentHubSlug;
  locale: Locale;
  title: string;
  subtitle: string;
}

/**
 * Service LP에서 buyer-intent hub로 보내는 작은 콜아웃 배너.
 * service LP는 transactional 의도이고, 일부 사용자는 의사결정 정보가 더 필요한 단계.
 * hub 1페이지로 흡수해 가이드·가격·작품을 한 번에 볼 수 있도록 한다.
 */
const HubLinkCallout: React.FC<HubLinkCalloutProps> = ({ hubSlug, locale, title, subtitle }) => {
  // Hub은 ko만 SSG돼 있다. 한국어가 아닌 locale에서는 콜아웃을 노출하지 않는다 —
  // /ko/guides/...로 보내면 사용자가 의도치 않게 한국어 페이지로 빠지고, 다른 locale URL로
  // 보내면 404. 번역이 추가되면 본 가드를 풀고 hub data에 locale별 텍스트를 추가한다.
  if (locale !== 'ko') return null;

  const href = `/${locale}/guides/${hubSlug}`;
  return (
    <div className="my-12 mx-auto max-w-4xl px-4">
      <Link
        href={href}
        prefetch={false}
        className="group flex items-center gap-4 sm:gap-6 p-5 sm:p-6 rounded-xl border-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-colors duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <div className="flex-shrink-0 inline-flex items-center justify-center p-3 rounded-full bg-primary/15" aria-hidden="true">
          <BookMarked className="text-primary dark:text-primary-lighter" size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="typo-card-subtitle mb-1 text-gray-900 dark:text-white break-words">
            {title}
          </h3>
          <p className="typo-card-body text-sm text-gray-600 dark:text-gray-400 break-words">
            {subtitle}
          </p>
        </div>
        <ArrowRight
          size={20}
          aria-hidden="true"
          className="flex-shrink-0 text-primary dark:text-primary-lighter transition-transform duration-200 group-hover:translate-x-1"
        />
      </Link>
    </div>
  );
};

export default HubLinkCallout;
