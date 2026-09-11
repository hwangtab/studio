import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Tag } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getPricingData } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
import { buyerIntentHubs } from '../../data/buyerIntentHubs';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface InlinePriceCalloutProps {
  id: string;
  locale: Locale;
}

type PoolKey = 'recording' | 'mixing' | 'mastering' | 'special' | 'additional';

const CATEGORY_DEFAULTS: Record<PoolKey, string> = {
  recording: '보컬 녹음',
  mixing: '믹싱',
  mastering: '마스터링',
  special: '추천 패키지',
  additional: '부가 서비스',
};

/**
 * 본문 안 가격 패키지 카드. %%price:<pricingId>%% short-code로 트리거.
 * pricing.ts의 5개 pool 및 hub pricingFallback을 모두 검색한다.
 * 매칭 실패 시 null 반환 — 본문에 흔적 남기지 않는다.
 */
const InlinePriceCallout = ({ id, locale }: InlinePriceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const pricingData = React.useMemo(() => getPricingData(locale), [locale]);
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const resolved = React.useMemo(() => {
    const map: Array<[PoolKey, ReadonlyArray<{ id: string }>]> = [
      ['special', pricingData.specialPackages],
      ['recording', pricingData.recordingOffers],
      ['mixing', pricingData.mixingOffers],
      ['mastering', pricingData.masteringOffers],
      ['additional', pricingData.additionalServices],
    ];
    for (const [pool, list] of map) {
      const found = list.find((p) => p.id === id);
      if (found) return { pkg: found as Record<string, unknown>, pool };
    }

    const hubFallback = Object.values(buyerIntentHubs)
      .map((h) => h.pricingFallback)
      .find((f): f is NonNullable<typeof f> => Boolean(f) && f!.id === id);
    if (hubFallback) {
      return {
        pkg: {
          id: hubFallback.id,
          title: hubFallback.title,
          priceDisplay: hubFallback.priceDisplay,
          unit: hubFallback.unit ?? '',
          description: hubFallback.description,
          features: [...hubFallback.features],
        } as Record<string, unknown>,
        pool: null as PoolKey | null,
      };
    }

    return null;
  }, [pricingData, id]);

  if (!resolved) return null;
  const { pkg, pool } = resolved;

  const title = String(pkg.title ?? '');
  const priceDisplay = String(pkg.priceDisplay ?? '');
  const unit = typeof pkg.unit === 'string' ? pkg.unit : '';
  const description = String(pkg.description ?? '');
  const features = Array.isArray(pkg.features)
    ? (pkg.features as string[]).slice(0, 4)
    : [];

  const categoryLabel = pool
    ? t(`stories.inline.priceCategory.${pool}`, { defaultValue: CATEGORY_DEFAULTS[pool] })
    : t('stories.inline.priceLabel', { defaultValue: '추천 패키지' });

  return (
    <aside
      data-inline-callout="price"
      aria-label={categoryLabel}
      className="my-8 rounded-xl border border-primary/30 bg-primary/5 p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="inline-flex items-center justify-center p-1.5 rounded-full bg-primary/15"
          aria-hidden="true"
        >
          <Tag className="text-primary dark:text-primary-light" size={14} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-primary-light">
          {categoryLabel}
        </span>
      </div>

      <h4 className="typo-card-subtitle text-gray-900 dark:text-white mb-2">
        {title}
      </h4>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-extrabold text-primary dark:text-primary-light">
          {priceDisplay}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
        )}
      </div>

      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {description}
      </p>

      {features.length > 0 && (
        <ul className="space-y-1.5 mb-5">
          {features.map((f, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <CheckCircle2
                className="flex-shrink-0 mt-0.5 text-primary dark:text-primary-light"
                size={16}
                aria-hidden="true"
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackLeadEvent('lead_click_kakao', {
              locale,
              component: 'InlinePriceCallout',
              cta_id: 'inline_price_kakao',
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-kakao px-4 py-2.5 text-sm font-bold text-kakao-ink hover:bg-kakao-dark transition-colors min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink focus-visible:ring-offset-2"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
        <Link
          href={`/${locale}/pricing`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary dark:text-primary-light hover:underline min-h-[44px] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
        >
          {t('stories.inline.priceDetail', { defaultValue: '가격표 전체 보기' })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
};

export default React.memo(InlinePriceCallout);
