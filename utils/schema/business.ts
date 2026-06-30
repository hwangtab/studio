import { ReviewItem } from '../../types/data';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles } from '../../data/siteConfig';
import { getReviews } from '../../data/reviews';
import {
  getOfferPriceValidUntil,
  getSchemaLanguage,
  MIXING_OFFER_NAMES,
  OFFER_CATALOG_NAMES,
  PRACTICE_OFFER_NAMES,
  PRODUCTION_OFFER_NAMES,
  RECORDING_OFFER_NAMES,
  VOCAL_PACKAGE_OFFER_NAMES,
} from './shared';

export const generateDefaultSchema = (
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);

  // LocalBusiness aggregateRating must reflect the business as a whole, so always
  // sourced from the canonical full review set — independent of any per-page filter.
  const reviewItems: ReviewItem[] = getReviews(locale);

  const localeContactUrl = `${siteUrl}/${locale}/contact`;
  const socialLinks = Object.values(socialProfiles).filter(url => url && url.trim() !== '');
  const sameAsLinks = [config.contact.kakaoUrl, config.contact.naverMapUrl, ...socialLinks].filter(url => typeof url === 'string' && url.trim() !== '');

  const organizationId = `${siteUrl}/#organization`;
  const studioId = `${siteUrl}/#studio`;

  const offerCatalogName = OFFER_CATALOG_NAMES[locale];
  const recordingOfferName = RECORDING_OFFER_NAMES[locale];
  const vocalPackageOfferName = VOCAL_PACKAGE_OFFER_NAMES[locale];
  const mixingOfferName = MIXING_OFFER_NAMES[locale];
  const productionOfferName = PRODUCTION_OFFER_NAMES[locale];
  const practiceOfferName = PRACTICE_OFFER_NAMES[locale];
  const priceValidUntil = getOfferPriceValidUntil();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: config.name,
        alternateName: 'Studio NOL',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo512.png`,
          width: 512,
          height: 512,
        },
        image: {
          '@type': 'ImageObject',
          url: `${siteUrl}/thumbnail.jpg`,
          width: 1440,
          height: 809,
        },
        email: config.contact.email,
        telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'reservations',
            telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
            email: config.contact.email,
            url: localeContactUrl,
            availableLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
          },
        ],
        legalName: 'Studio NOL',
        // Google Rich Results: Organization에 address 권장(누락 시 warning).
        // LocalBusiness(#studio)와 동일한 PostalAddress를 공유.
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.contact.address,
          addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
          addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        sameAs: sameAsLinks,
        foundingDate: '2024-01-01',
        numberOfEmployees: { '@type': 'QuantitativeValue', value: 5 },
        description: config.description,
        slogan: 'Realizing artists\' musical vision through sound',
        knowsLanguage: ['ko-KR', 'en-US', 'zh-CN', 'es-ES', 'vi-VN', 'th-TH', 'uz-UZ'],
        knowsAbout: [
          'Music Recording', 'Audio Mixing', 'Audio Mastering', 'Music Production',
          'Vocal Recording', 'Voice Acting Recording', 'Wedding Song Recording',
          'Music Lesson', 'Practice Room', 'Home Recording',
          locale === 'ko' ? '녹음 제작' : 'Sound Engineering',
          locale === 'ko' ? '음반 기획' : 'Album Production',
        ],
      },
      {
        // EntertainmentBusiness는 schema.org 계층상 LocalBusiness의 하위 타입.
        // multi-type(["LocalBusiness", "EntertainmentBusiness"])은 Google 검사기가
        // 두 entity로 중복 카운트하므로 단일 타입으로 통합. LocalBusiness rich result도
        // 하위 타입으로 그대로 인정됨.
        '@type': 'EntertainmentBusiness',
        additionalType: 'https://www.wikidata.org/wiki/Q746359',
        '@id': studioId,
        name: 'Studio NOL',
        image: {
          '@type': 'ImageObject',
          url: `${siteUrl}/thumbnail.jpg`,
          width: 1440,
          height: 809,
        },
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo512.png`,
          width: 512,
          height: 512,
        },
        url: siteUrl,
        description: config.description,

        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: config.contact.address,
          addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
          addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
        email: config.contact.email,
        // 월~일 매일 10:00–23:59 운영. Schema.org spec상 24:00 표기는 일부 validator가
        // 경고로 처리하므로 23:59가 가장 안전한 자정 표기. 음악 스튜디오 특성상 야간
        // 녹음·연습 수요를 반영해 평일·주말 단일 entry로 통합.
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: '10:00',
            closes: '23:59',
          },
        ],
        potentialAction: {
          '@type': 'ReserveAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/${locale}/contact`,
          },
          result: {
            '@type': 'Reservation',
            name: locale === 'ko' ? '스튜디오 예약' : 'Studio Reservation',
          },
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: 37.614353,
          longitude: 126.925887,
        },
        areaServed: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: 37.614353,
            longitude: 126.925887,
          },
          geoRadius: 50000,
        },
        hasMap: [
          config.contact.naverMapUrl,
          'https://maps.google.com/?q=37.614353,126.925887',
        ].filter((url): url is string => Boolean(url && url.trim())),
        sameAs: [
          config.contact.naverMapUrl,
          config.contact.kakaoUrl,
          'https://maps.google.com/?q=37.614353,126.925887',
          socialProfiles.instagram,
          socialProfiles.threads,
        ].filter((url): url is string => Boolean(url && url.trim())),
        paymentAccepted: 'Cash, Credit Card, Bank Transfer, KakaoPay',
        currenciesAccepted: 'KRW',

        ...(reviewItems && reviewItems.length > 0 && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: (reviewItems.reduce((sum, item) => sum + item.rating, 0) / reviewItems.length).toFixed(1),
            reviewCount: reviewItems.length,
            bestRating: 5,
            worstRating: 1
          },
          review: reviewItems.slice(0, 10).map((item) => ({
            '@type': 'Review',
            author: {
              '@type': 'Person',
              name: item.author,
            },
            reviewRating: {
              '@type': 'Rating',
              ratingValue: item.rating,
              bestRating: 5,
              worstRating: 1,
            },
            reviewBody: item.content,
            inLanguage: schemaLanguage,
            ...(item.datePublished && { datePublished: item.datePublished }),
          })),
        }),


        parentOrganization: {
          '@id': organizationId,
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: offerCatalogName,
          itemListElement: [
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: 100000,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: recordingOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: 250000,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: vocalPackageOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: 200000,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: mixingOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              priceCurrency: 'KRW',
              price: 350000,
              priceValidUntil,
              url: `${siteUrl}/${locale}/pricing`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: productionOfferName,
                provider: { '@type': 'Organization', '@id': organizationId },
              },
            },
            {
              '@type': 'Offer',
              name: practiceOfferName,
              priceCurrency: 'KRW',
              price: 360000,
              priceValidUntil,
              url: `${siteUrl}/${locale}/practice-room`,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: practiceOfferName,
                provider: {
                  '@type': 'Organization',
                  '@id': organizationId,
                },
              },
            },
          ],
        },
        makesOffer: [
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 100000,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: recordingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 250000,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: vocalPackageOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 200000,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: mixingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 350000,
            priceValidUntil,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: productionOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 360000,
            priceValidUntil,
            url: `${siteUrl}/${locale}/practice-room`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: practiceOfferName },
          },
        ],
      },
    ],
  };
};
