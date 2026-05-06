import { Breadcrumb, FAQItem, ReviewItem } from '../types/data';
import { type Locale } from '../lib/i18n';
import { getSiteConfig, socialProfiles } from '../data/siteConfig';
import { getReviews } from '../data/reviews';

const OFFER_CATALOG_NAMES: Record<Locale, string> = {
  ko: '스튜디오 서비스', en: 'Studio Services', zh: '工作室服务',
  es: 'Servicios del Estudio', vi: 'Dịch vụ Studio', th: 'บริการสตูดิโอ', uz: 'Studiya xizmatlari',
};
const RECORDING_OFFER_NAMES: Record<Locale, string> = {
  ko: '레코딩 서비스', en: 'Recording Service', zh: '录音服务',
  es: 'Servicio de Grabación', vi: 'Dịch vụ thu âm', th: 'บริการบันทึกเสียง', uz: 'Yozuv xizmati',
};
const MIXING_OFFER_NAMES: Record<Locale, string> = {
  ko: '믹싱 & 마스터링', en: 'Mixing & Mastering', zh: '混音与母带',
  es: 'Mezcla y Masterización', vi: 'Mixing & Mastering', th: 'มิกซ์ & มาสเตอริ่ง', uz: 'Miks & Mastering',
};
const PRODUCTION_OFFER_NAMES: Record<Locale, string> = {
  ko: '음반 기획', en: 'Album Production', zh: '唱片策划',
  es: 'Producción de Álbum', vi: 'Sản xuất album', th: 'การผลิตอัลบั้ม', uz: 'Albom prodakshn',
};
const PRACTICE_OFFER_NAMES: Record<Locale, string> = {
  ko: '음악연습실 입주 프로그램', en: 'Premium Practice Room Residency', zh: '高级练习室入驻计划',
  es: 'Programa de Residencia de Sala Premium', vi: 'Chương trình thuê phòng tập cao cấp',
  th: 'โปรแกรมเช่าห้องซ้อมระดับพรีเมียม', uz: "Premium mashg'ulot xonasi dasturi",
};
const ITEM_LIST_NAMES: Record<Locale, string> = {
  ko: '포트폴리오', en: 'Portfolio', zh: '作品集',
  es: 'Portafolio', vi: 'Danh mục tác phẩm', th: 'ผลงาน', uz: 'Portfolio',
};

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
  const mixingOfferName = MIXING_OFFER_NAMES[locale];
  const productionOfferName = PRODUCTION_OFFER_NAMES[locale];
  const practiceOfferName = PRACTICE_OFFER_NAMES[locale];

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
            contactType: 'Booking & Inquiry',
            telephone: `+82-${config.contact.phone.replace(/^0/, '')}`,
            email: config.contact.email,
            url: localeContactUrl,
            availableLanguage: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'],
          },
        ],
        legalName: 'Studio NOL',
        sameAs: sameAsLinks,
        foundingDate: '2024-01-01',
        numberOfEmployees: { '@type': 'QuantitativeValue', value: 5 },
        description: config.description,
        slogan: 'Realizing artists\' musical vision through sound',
        knowsLanguage: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'],
        knowsAbout: [
          'Music Recording', 'Audio Mixing', 'Audio Mastering', 'Music Production',
          'Vocal Recording', 'Voice Acting Recording', 'Wedding Song Recording',
          'Music Lesson', 'Practice Room', 'Home Recording',
          locale === 'ko' ? '녹음 제작' : 'Sound Engineering',
          locale === 'ko' ? '음반 기획' : 'Album Production',
        ],
      },
      {
        '@type': ['LocalBusiness', 'EntertainmentBusiness'],
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
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '10:00',
            closes: '18:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Saturday'],
            opens: '12:00',
            closes: '18:00',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Sunday'],
            opens: '00:00',
            closes: '00:00',
          },
        ],
        acceptsReservations: `${siteUrl}/${locale}/contact`,
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
        ].filter(Boolean),
        sameAs: [
          config.contact.naverMapUrl,
          config.contact.kakaoUrl,
          'https://maps.google.com/?q=37.614353,126.925887',
          socialProfiles.instagram,
          socialProfiles.threads,
        ].filter(Boolean),
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
              price: 200000,
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
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: recordingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 200000,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: mixingOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 350000,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: productionOfferName },
          },
          {
            '@type': 'Offer',
            priceCurrency: 'KRW',
            price: 360000,
            url: `${siteUrl}/${locale}/practice-room`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: practiceOfferName },
          },
        ],
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
  locale: Locale = 'ko',
  articleType: 'Article' | 'BlogPosting' = 'Article',
  articleSection?: string,
  articleKeywords?: string[],
  wordCount?: number,
  imageWidth?: number,
  imageHeight?: number
) => {
  if (!articlePublishedTime) return null;
  const config = getSiteConfig(locale);
  const schemaLanguage = getSchemaLanguage(locale);
  const organizationId = `${siteUrl}/#organization`;
  const websiteId = `${siteUrl}/#website`;

  return {
    '@context': 'https://schema.org',
    '@type': articleType,
    '@id': `${normalizedCanonical}#article`,
    headline: title,
    datePublished: articlePublishedTime,
    dateModified: articleModifiedTime || articlePublishedTime,
    ...(articleSection && { articleSection }),
    ...(articleKeywords && articleKeywords.length > 0 && { keywords: articleKeywords.join(', ') }),
    ...(wordCount && wordCount > 0 && { wordCount }),
    author: {
      '@type': 'Person',
      name: articleAuthor || config.name,
    },
    publisher: {
      '@type': 'Organization',
      '@id': organizationId,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo512.png`,
        width: 512,
        height: 512,
      },
    },
    image: [{
      '@type': 'ImageObject',
      url: absoluteOgImage,
      ...(typeof imageWidth === 'number' && imageWidth > 0 && { width: imageWidth }),
      ...(typeof imageHeight === 'number' && imageHeight > 0 && { height: imageHeight }),
      representativeOfPage: true,
    }],
    description: description,
    inLanguage: schemaLanguage,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '[itemprop="headline"]', '[itemprop="description"]'],
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${normalizedCanonical}#webpage`,
    },
    isPartOf: {
      '@id': websiteId,
    },
  };
};

export const generateBreadcrumbSchema = (breadcrumbs: Breadcrumb[] | null, siteUrl: string, canonicalUrl?: string) => {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    ...(canonicalUrl && { '@id': `${canonicalUrl}#breadcrumb` }),
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
    offers: {
      '@type': 'Offer',
      priceCurrency: 'KRW',
      price: 350000,
      availability: 'https://schema.org/InStock',
      url: normalizedCanonical,
    },
    availableLanguage: [schemaLanguage],
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      courseWorkload: 'PT1H',
      inLanguage: schemaLanguage,
      instructor: {
        '@type': 'Person',
        name: isKo ? '스튜디오 놀 엔지니어' : 'Studio NOL Engineer',
        worksFor: { '@type': 'Organization', '@id': organizationId },
      },
      location: {
        '@type': 'Place',
        name: 'Studio NOL',
        address: {
          '@type': 'PostalAddress',
          streetAddress: isKo ? '연신내역 도보 5분' : '5 min walk from Yeonsinnae Station',
          addressLocality: isKo ? '은평구' : 'Eunpyeong-gu',
          addressRegion: isKo ? '서울특별시' : 'Seoul',
          addressCountry: 'KR',
        },
      },
    },
  };
};


export const generatePracticeRoomMonthlyRentSchema = (
  pageUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 6);

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#practice-room-monthly-rent`,
    name: '음악연습실 월세 입주 — 스튜디오 놀',
    serviceType: '음악연습실 월세 입주',
    description:
      '서울 은평구 연신내역 도보 5분 거리 24시간 음악연습실 월세 입주 프로그램. 보증금 없음, 최소 1개월, 개별 도어록·냉난방·방음 설계 포함.',
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${config.url}/#studio`,
      name: config.name,
      url: config.url,
    },
    areaServed: [
      { '@type': 'City', name: '서울특별시' },
      { '@type': 'AdministrativeArea', name: '은평구' },
    ],
    offers: {
      '@type': 'Offer',
      name: '음악연습실 월세 입주 (개인 연습실)',
      price: 360000,
      priceCurrency: 'KRW',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: 360000,
        priceCurrency: 'KRW',
        unitCode: 'MON',
        unitText: '월',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'MON',
        },
      },
      availability: 'https://schema.org/InStock',
      priceValidUntil: priceValidUntil.toISOString().split('T')[0],
      url: pageUrl,
      eligibleRegion: { '@type': 'Country', name: 'KR' },
      seller: {
        '@type': 'LocalBusiness',
        '@id': `${config.url}/#studio`,
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
    image: `${config.url}/thumbnail.jpg`,
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

export const generateWebPageSchema = (
  title: string,
  description: string,
  siteUrl: string,
  canonicalUrl: string,
  locale: Locale = 'ko',
  articleId?: string,
  hasBreadcrumb?: boolean,
  primaryImageUrl?: string,
  webPageType?: string
) => {
  const schemaLanguage = getSchemaLanguage(locale);

  return {
    '@context': 'https://schema.org',
    '@type': webPageType || 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: title,
    description: description,
    inLanguage: schemaLanguage,
    isPartOf: { '@id': `${siteUrl}/#website` },
    about: { '@id': `${siteUrl}/#studio` },
    ...(primaryImageUrl && {
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: primaryImageUrl,
      },
    }),
    ...(hasBreadcrumb && { breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` } }),
    ...(articleId && { mainEntity: { '@id': articleId } }),
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
    alternateName: 'Studio NOL',
    url: siteUrl,
    description: config.description,
    inLanguage: schemaLanguage,
    availableLanguage: ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'].map(lang => ({
      '@type': 'Language',
      name: lang,
    })),
    publisher: {
      '@id': `${siteUrl}/#organization`,
    },
    about: {
      '@id': `${siteUrl}/#studio`,
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
  duration?: string;
  /** 3–5 paragraph production notes (partial locale-map). When present, enables indexing. */
  productionNotes?: Partial<Record<Locale, string>>;
  /** Credit block: engineer, musicians, gear */
  credits?: {
    engineer?: string;
    musicians?: string[];
    gear?: string[];
  };
  /** Record label */
  label?: string;
  /** Track list with optional duration */
  trackList?: { no: number; title: string; duration?: string }[];
}

export const generateMusicRecordingSchema = (
  item: MusicRecordingInput,
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);

  // Build workExample from trackList if available
  const workExample = item.trackList && item.trackList.length > 0
    ? item.trackList.map(track => ({
        '@type': 'MusicRecording' as const,
        name: track.title,
        duration: track.duration,
      }))
    : undefined;

  // Build performer from credits
  const performer = item.credits
    ? {
        '@type': 'MusicGroup' as const,
        name: item.artist,
        hasMember: item.credits.musicians
          ? item.credits.musicians.map(name => ({ '@type': 'MusicGroup' as const, name }))
          : undefined,
      }
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    ...(item.url && { '@id': `${item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`}#recording` }),
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
    ...(item.url && {
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`}#webpage`,
      },
    }),
    ...(item.datePublished && { datePublished: item.datePublished }),
    ...(item.genre && { genre: item.genre }),
    ...(item.duration && { duration: item.duration }),
    ...(item.label && { license: `${siteUrl}/#${item.label}` }),
    ...(item.productionNotes?.[locale] && { description: item.productionNotes[locale] }),
    ...(item.credits && {
      contributor: item.credits.engineer
        ? { '@type': 'Organization', name: item.credits.engineer }
        : undefined,
    }),
    ...(item.credits?.gear && item.credits.gear.length > 0 && {
      instrument: item.credits.gear.map((name) => ({
        '@type': 'MusicalInstrument' as const,
        name,
      })),
    }),
    ...(workExample && { workExample }),
    ...(performer && { performer }),
  };
};

export interface VideoInput {
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl?: string;
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
    ...(video.embedUrl && { embedUrl: video.embedUrl }),
    ...(video.duration && { duration: video.duration }),
    publisher: {
      '@type': 'Organization',
      name: config.name,
      logo: {
        '@type': 'ImageObject',
        url: `${config.url}/logo512.png`,
      },
    },
  };
};


export interface ItemListInput {
  id: string;
  name: string;
  url: string;
  image?: string;
  description?: string;
}

export const generateItemListSchema = (
  items: ItemListInput[],
  siteUrl: string,
  locale: Locale = 'ko',
  listName?: string
) => {
  const resolvedListName = listName || ITEM_LIST_NAMES[locale];

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: resolvedListName,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url.startsWith('http') ? item.url : `${siteUrl}${item.url}`,
      ...(item.image && { image: item.image.startsWith('http') ? item.image : `${siteUrl}${item.image}` }),
      ...(item.description && { description: item.description }),
    })),
  };
};

export interface AudioObjectInput {
  name: string;
  contentUrl: string;
  encodingFormat?: string;
  description?: string;
  artist?: string;
  genre?: string;
  duration?: string;
}

export const generateAudioObjectSchema = (
  tracks: AudioObjectInput[],
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);

  return tracks.map((track) => ({
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: track.name,
    url: track.contentUrl.startsWith('http') ? track.contentUrl : `${siteUrl}${track.contentUrl}`,
    encodingFormat: track.encodingFormat || 'audio/mpeg',
    ...(track.description && { description: track.description }),
    ...(track.genre && { genre: track.genre }),
    ...(track.artist && {
      byArtist: {
        '@type': 'MusicGroup',
        name: track.artist,
      },
    }),
    recordingOf: {
      '@type': 'MusicComposition',
      name: track.name,
    },
    publisher: {
      '@type': 'Organization',
      name: config.name,
      url: siteUrl,
    },
    ...(track.duration && { duration: track.duration }),
  }));
};

export interface ServiceInput {
  name: string;
  description: string;
  url?: string;
}

export const generateServiceListSchema = (
  services: ServiceInput[],
  siteUrl: string,
  locale: Locale = 'ko'
) => {
  const config = getSiteConfig(locale);
  const organizationId = `${siteUrl}/#organization`;

  const SERVICE_LIST_NAMES: Record<Locale, string> = {
    ko: '서비스 목록', en: 'Service List', zh: '服务列表',
    es: 'Lista de Servicios', vi: 'Danh sách dịch vụ', th: 'รายการบริการ', uz: 'Xizmatlar ro\'yxati',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: SERVICE_LIST_NAMES[locale],
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.name,
        description: service.description,
        ...(service.url && { url: service.url.startsWith('http') ? service.url : `${siteUrl}${service.url}` }),
        provider: {
          '@type': 'Organization',
          '@id': organizationId,
          name: config.name,
        },
      },
    })),
  };
};
