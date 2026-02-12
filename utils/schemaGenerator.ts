import { Breadcrumb, FAQItem } from '../types/data';
import { type Locale } from '../lib/i18n';
import { getSiteConfig } from '../data/siteConfig';

const schemaLanguageByLocale: Record<Locale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
  zh: 'zh-CN',
  es: 'es-ES',
  vi: 'vi-VN',
  th: 'th-TH',
  uz: 'uz-UZ',
};

export const getSchemaLanguage = (locale: Locale): string => schemaLanguageByLocale[locale] || schemaLanguageByLocale.ko;

export const generateDefaultSchema = (
  siteUrl: string
) => {
  const config = getSiteConfig('ko');
  const localeContactUrl = `${siteUrl}/ko/contact`;
  const sameAsLinks = [config.contact.kakaoUrl, config.contact.naverMapUrl];

  const organizationId = `${siteUrl}/#organization`;
  const studioId = `${siteUrl}/#studio`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'Studio NOL',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}${config.logo}`,
          width: 3350,
          height: 862,
        },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'Booking & Inquiry',
            telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
            url: localeContactUrl,
            availableLanguage: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'],
          },
        ],
        sameAs: sameAsLinks,
        slogan: 'Realizing artists\' musical vision through sound',
        knowsLanguage: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'],
      },
      {
        '@type': 'LocalBusiness',
        '@id': studioId,
        name: 'Studio NOL',
        image: `${siteUrl}/thumbnail.jpg`,
        url: siteUrl,
        description: '연신내 녹음실, 연습실, 믹싱, 마스터링, 음반 제작 스튜디오',
        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '서울특별시 은평구 대조동 84-3 3층(동명여고 바로 옆)',
          addressLocality: '은평구',
          addressRegion: '서울특별시',
          postalCode: '03424',
          addressCountry: 'KR',
        },
        telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
        email: config.contact.email,
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '10:00',
            closes: '18:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: 'Saturday',
            opens: '12:00',
            closes: '18:00',
          },
        ],
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '37.614353',
          longitude: '126.925887',
        },
        areaServed: {
          '@type': 'GeoCircle',
          geoMidpoint: {
            '@type': 'GeoCoordinates',
            latitude: '37.614353',
            longitude: '126.925887',
          },
          geoRadius: '50000',
        },
        hasMap: config.contact.naverMapUrl,
        paymentAccepted: 'Cash, Credit Card, Bank Transfer, KakaoPay',
        currenciesAccepted: 'KRW',

        parentOrganization: {
          '@id': organizationId,
        },
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: '스튜디오 서비스',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: '레코딩 서비스',
                description: '프로페셔널 레코딩 서비스',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: '믹싱 & 마스터링',
                description: '전문 믹싱 및 마스터링 서비스',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: '음반 기획',
                description: '음반 제작 전 과정 기획 및 지원',
              },
            },
            {
              '@type': 'Offer',
              name: '프리미엄 연습실 입주 프로그램',
              description: '월 40만 원으로 방음 연습실과 입주 고객 전용 혜택을 제공합니다.',
              priceCurrency: 'KRW',
              price: 400000,
              url: localeContactUrl,
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: '프리미엄 연습실 입주 프로그램',
                description: '녹음실 할인, 음원 유통, 보도자료 작성, 버스킹 장비 대여, 전문가 피드백, 크라우드 펀딩 컨설팅, 예술지원사업 정보, 공구 대여',
                provider: {
                  '@type': 'Organization',
                  '@id': organizationId,
                },
                areaServed: {
                  '@type': 'AdministrativeArea',
                  name: '서울특별시',
                },
              },
            },
          ],
        },
      },
    ],
  };
};

export const generateArticleSchema = (
  title: string,
  description: string,
  siteUrl: string,
  absoluteOgImage: string,
  normalizedCanonical: string,
  articlePublishedTime?: string,
  articleModifiedTime?: string,
  articleAuthor?: string,
  locale: Locale = 'ko'
) => {
  if (!articlePublishedTime) return null;
  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);
  const organizationId = `${siteUrl}/#organization`;
  const websiteId = `${siteUrl}/#website`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${normalizedCanonical}#article`,
    headline: title,
    datePublished: articlePublishedTime,
    dateModified: articleModifiedTime || articlePublishedTime,
    author: {
      '@type': 'Person',
      name: articleAuthor || config.name,
    },
    publisher: {
      '@type': 'Organization',
      '@id': organizationId,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}${config.logo}`,
      },
    },
    image: absoluteOgImage,
    description: description,
    inLanguage: schemaLanguage,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': normalizedCanonical,
    },
    isPartOf: {
      '@id': websiteId,
    },
  };
};

export const generateBreadcrumbSchema = (breadcrumbs: Breadcrumb[] | null, siteUrl: string) => {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${siteUrl}${crumb.path}`,
    })),
  };
};

export const generateFaqSchema = (faqItems: FAQItem[] | null, locale: Locale = 'ko') => {
  if (!faqItems || faqItems.length === 0) return null;
  const schemaLanguage = getSchemaLanguage(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: schemaLanguage,
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
};

export const generateCourseSchema = (
  title: string,
  description: string,
  siteUrl: string,
  absoluteOgImage: string,
  normalizedCanonical: string,
  locale: Locale = 'ko'
) => {
  const isKo = locale === 'ko';
  const schemaLanguage = getSchemaLanguage(locale);
  const organizationId = `${siteUrl}/#organization`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${normalizedCanonical}#course`,
    name: title,
    description: description,
    inLanguage: schemaLanguage,
    provider: {
      '@type': 'Organization',
      '@id': organizationId,
      sameAs: siteUrl,
    },
    image: absoluteOgImage,
    url: normalizedCanonical,
    educationalLevel: isKo ? '초급부터 고급까지' : 'Beginner to Advanced',
    teaches: isKo
      ? ['음악 프로덕션', '보컬 레코딩', '믹싱 기초']
      : ['Music Production', 'Vocal Recording', 'Mixing Basics'],
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      instructor: {
        '@type': 'Person',
        name: isKo ? '스튜디오 놀 엔지니어' : 'Studio NOL Engineer',
      },
    },
  };
};

export interface ServiceOfferInput {
  name: string;
  description: string;
  priceValue: number;
  unit?: string;
  url: string;
}

export const generateServiceOfferSchema = (
  service: ServiceOfferInput,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 6);

  return {
    '@type': 'Offer',
    name: service.name,
    description: service.description,
    priceCurrency: 'KRW',
    price: service.priceValue,
    priceValidUntil: priceValidUntil.toISOString().split('T')[0],
    availability: 'https://schema.org/InStock',
    url: service.url,
    ...(service.unit && { unitText: service.unit }),
    seller: {
      '@type': 'LocalBusiness',
      name: config.name,
      '@id': `${config.url}/#organization`,
    },
    itemOffered: {
      '@type': 'Service',
      name: service.name,
      provider: {
        '@type': 'LocalBusiness',
        name: config.name,
      },
    },
  };
};

export interface AggregateOfferInput {
  name: string;
  priceValue: number;
}

export const generateAggregateOfferSchema = (
  catalogName: string,
  offers: AggregateOfferInput[],
  locale: Locale = 'ko'
) => {
  const prices = offers.map((o) => o.priceValue).filter((p) => p > 0);
  if (prices.length === 0) return null;

  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 6);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${config.url}/#pricing-catalog`,
    name: catalogName,
    inLanguage: schemaLanguage,
    brand: {
      '@type': 'Organization',
      '@id': `${config.url}/#organization`,
      name: config.name,
    },
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      priceCurrency: 'KRW',
      offerCount: offers.length,
      priceValidUntil: priceValidUntil.toISOString().split('T')[0],
      availability: 'https://schema.org/InStock',
      offers: offers.map((offer) => ({
        '@type': 'Offer',
        name: offer.name,
        price: offer.priceValue,
        priceCurrency: 'KRW',
      })),
    },
  };
};

export const generateWebSiteSchema = (siteUrl: string, locale: Locale = 'ko') => {
  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: config.name,
    alternateName: 'Studio Nol',
    url: siteUrl,
    inLanguage: schemaLanguage,
    publisher: {
      '@id': `${siteUrl}/#organization`,
    },
  };
};

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

export const generateHowToSchema = (
  name: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string,
  locale: Locale = 'ko'
) => {
  const isKo = locale === 'ko';
  const schemaLanguage = getSchemaLanguage(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    inLanguage: schemaLanguage,
    ...(totalTime && { totalTime }),
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
    tool: {
      '@type': 'HowToTool',
      name: isKo ? '전문 녹음 장비' : 'Professional Recording Equipment',
    },
  };
};

export interface MusicRecordingInput {
  title: string;
  artist: string;
  image?: string;
  url?: string;
  datePublished?: string;
  genre?: string;
}

export const generateMusicRecordingSchema = (
  item: MusicRecordingInput,
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: item.title,
    byArtist: {
      '@type': 'MusicGroup',
      name: item.artist,
    },
    recordingOf: {
      '@type': 'MusicComposition',
      name: item.title,
    },
    producer: {
      '@type': 'Organization',
      name: config.name,
      url: siteUrl,
    },
    ...(item.image && { image: item.image }),
    ...(item.url && { url: item.url }),
    ...(item.datePublished && { datePublished: item.datePublished }),
    ...(item.genre && { genre: item.genre }),
  };
};

export interface VideoInput {
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  uploadDate: string;
  duration?: string;
}

export const generateVideoSchema = (video: VideoInput, locale: Locale = 'ko') => {
  const config = getSiteConfig(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    contentUrl: video.contentUrl,
    uploadDate: video.uploadDate,
    ...(video.duration && { duration: video.duration }),
    publisher: {
      '@type': 'Organization',
      name: config.name,
      logo: {
        '@type': 'ImageObject',
        url: `${config.url}${config.logo}`,
      },
    },
  };
};
