import type { Locale } from './i18n';
import { getSchemaLanguage } from '../utils/schema';
import { getOfferPriceValidUntil } from '../utils/schema/shared';

interface BuildStudioServiceSchemaOptions {
  locale: Locale;
  siteName: string;
  siteUrl: string;
  pageUrl: string;
  name: string;
  description: string;
  serviceType: string;
  offerName: string;
  offerPrice: number;
  pricingHash?: string;
}

export const buildStudioServiceSchema = ({
  locale,
  siteName,
  siteUrl,
  pageUrl,
  name,
  description,
  serviceType,
  offerName,
  offerPrice,
  pricingHash = 'special-packages',
}: BuildStudioServiceSchemaOptions) => ({
  '@type': 'Service',
  name,
  description,
  inLanguage: getSchemaLanguage(locale),
  serviceType,
  areaServed: {
    '@type': 'City',
    name: locale === 'ko' ? '서울특별시 은평구' : 'Eunpyeong-gu, Seoul',
  },
  location: {
    '@type': 'Place',
    name: siteName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
      addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
      postalCode: '03424',
      addressCountry: 'KR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.614353,
      longitude: 126.925887,
    },
  },
  provider: {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: siteName,
    url: siteUrl,
  },
  url: pageUrl,
  offers: {
    '@type': 'Offer',
    name: offerName,
    priceCurrency: 'KRW',
    price: offerPrice,
    // 다른 Offer(lesson·practice-room·pricing)는 전부 getOfferPriceValidUntil()을 쓰는데
    // 이 Service Offer만 빠져 있었다. 없으면 Google이 가격을 만료 처리한다.
    priceValidUntil: getOfferPriceValidUntil(),
    availability: 'https://schema.org/InStock',
    url: `${siteUrl}/${locale}/pricing#${pricingHash}`,
  },
});

export const buildSchemaGraph = (...items: Record<string, unknown>[]) => ({
  '@context': 'https://schema.org',
  '@graph': items,
});
