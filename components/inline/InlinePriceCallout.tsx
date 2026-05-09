import React from 'react';
import Link from 'next/link';
import { ArrowRight, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getPricingData } from '../../data/pricing';
import { getSiteConfig } from '../../data/siteConfig';
import { buyerIntentHubs } from '../../data/buyerIntentHubs';
import type { Locale } from '../../lib/i18n';

interface InlinePriceCalloutProps {
  id: string;
  locale: Locale;
}

/**
 * 본문 안 가격 패키지 카드. %%price:<pricingId>%% short-code로 트리거.
 * pricing.ts의 specialPackages·recordingOffers·mixingOffers·additionalServices·masteringOffers를
 * 모두 검색한다. 매칭 실패 시 null 반환 — 본문에 흔적 남기지 않는다.
 */
const InlinePriceCallout = ({ id, locale }: InlinePriceCalloutProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const pricingData = React.useMemo(() => getPricingData(locale), [locale]);
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  const pkg = React.useMemo(() => {
    // 1. pricing.ts pools에서 lookup
    const pools = [
      pricingData.specialPackages,
      pricingData.recordingOffers,
      pricingData.mixingOffers,
      pricingData.masteringOffers,
      pricingData.additionalServices,
    ];
    for (const pool of pools) {
      const found = pool.find((p) => p.id === id);
      if (found) return found;
    }

    // 2. hub pricingFallback에서 lookup (lesson-monthly 같은 hub 전용 id)
    const hubFallback = Object.values(buyerIntentHubs)
      .map((h) => h.pricingFallback)
      .find((f): f is NonNullable<typeof f> => Boolean(f) && f!.id === id);
    if (hubFallback) {
      // hub fallback 카드를 pricing pool 항목과 동일한 shape으로 변환
      return {
        id: hubFallback.id,
        title: hubFallback.title,
        priceDisplay: hubFallback.priceDisplay,
        priceValue: 0,  // hub fallback은 priceValue 없음
        unit: hubFallback.unit ?? '',
        description: hubFallback.description,
        features: [...hubFallback.features],
        ...(hubFallback.recommended && { recommended: hubFallback.recommended }),
      };
    }

    return null;
  }, [pricingData, id]);

  if (!pkg) return null;

  return (
    <aside
      data-inline-callout="price"
      aria-label={t('stories.inline.priceLabel', { defaultValue: '추천 패키지' })}
      className="my-8 rounded-xl border border-primary/30 bg-primary/5 p-6"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center p-2 rounded-full bg-primary/15" aria-hidden="true">
          <Tag className="text-primary" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="typo-card-subtitle text-gray-900 dark:text-white mb-1">
            {pkg.title}
          </h4>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-primary dark:text-primary-light">
              {pkg.priceDisplay}
            </span>
            {'unit' in pkg && pkg.unit && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{pkg.unit}</span>
            )}
          </div>
        </div>
      </div>
      <p className="typo-card-body text-sm text-gray-700 dark:text-gray-300 mb-4">
        {pkg.description}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/pricing`}
          prefetch={false}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline min-h-[44px] touch-manipulation"
        >
          {t('nav.pricing')} <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.kakaoCta', { defaultValue: '카카오톡으로 문의' })}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
};

export default React.memo(InlinePriceCallout);
