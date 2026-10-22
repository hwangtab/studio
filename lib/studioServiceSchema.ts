import type { Locale } from './i18n';
import { getSchemaLanguage } from '../utils/schema';
import { buildPriceSpecification, getOfferPriceValidUntil } from '../utils/schema/shared';

interface BuildStudioServiceSchemaOptions {
  locale: Locale;
  siteName: string;
  siteUrl: string;
  pageUrl: string;
  name: string;
  description: string;
  serviceType: string;
  /**
   * Offer는 둘 다 있을 때만 내보낸다. 작곡·편곡처럼 상담 뒤 곡 단위로 견적하는 서비스는
   * 가격이 없다 — 가격 없는 Offer나 0원 가격을 내보내면 Google이 잘못된 가격 정보로 본다.
   */
  offerName?: string;
  offerPrice?: number;
  pricingHash?: string;
  /**
   * 파일을 주고받아 끝나는 서비스(믹싱·마스터링·작곡·편곡·홍보·펀딩 설계)는 서비스 지역을 은평구로
   * 묶지 않는다 — 같은 페이지가 "전국·해외 어디서든"이라고 말하는데 구조화 데이터만 동네 한정이면
   * AI 답변이 원격 의뢰를 못 받는 곳으로 읽는다. location(작업하는 곳)은 그대로 둔다.
   */
  remote?: boolean;
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
  remote = false,
}: BuildStudioServiceSchemaOptions) => ({
  '@type': 'Service',
  name,
  description,
  inLanguage: getSchemaLanguage(locale),
  serviceType,
  ...(remote
    ? {
        areaServed: [
          { '@type': 'Country', name: locale === 'ko' ? '대한민국' : 'South Korea' },
          { '@type': 'Place', name: locale === 'ko' ? '전 세계(원격)' : 'Worldwide (remote)' },
        ],
        availableChannel: {
          '@type': 'ServiceChannel',
          name: locale === 'ko' ? '온라인 파일 전달' : 'Online file delivery',
          serviceUrl: pageUrl,
        },
      }
    : {
        areaServed: {
          '@type': 'City',
          name: locale === 'ko' ? '서울특별시 은평구' : 'Eunpyeong-gu, Seoul',
        },
      }),
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
  ...(offerName !== undefined && offerPrice !== undefined
    ? {
        offers: {
          '@type': 'Offer',
          name: offerName,
          priceCurrency: 'KRW',
          price: offerPrice,
          priceSpecification: buildPriceSpecification(offerPrice),
          // 다른 Offer(lesson·practice-room·pricing)는 전부 getOfferPriceValidUntil()을 쓰는데
          // 이 Service Offer만 빠져 있었다. 없으면 Google이 가격을 만료 처리한다.
          priceValidUntil: getOfferPriceValidUntil(),
          availability: 'https://schema.org/InStock',
          url: `${siteUrl}/${locale}/pricing#${pricingHash}`,
        },
      }
    : {}),
});

export const buildSchemaGraph = (...items: Record<string, unknown>[]) => ({
  '@context': 'https://schema.org',
  '@graph': items,
});
