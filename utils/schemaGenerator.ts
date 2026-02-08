import { Breadcrumb, FAQItem, ReviewItem } from '../types/data';
import { type Locale } from '../lib/i18n';

export const generateDefaultSchema = (
  siteUrl: string,
  absoluteOgImage: string,
  description: string,
  reviewItems: ReviewItem[] | null,
  locale: Locale = 'ko'
) => {
  const isKo = locale === 'ko';

  const translations = {
    name: isKo ? '스튜디오 놀' : 'Studio NOL',
    locality: isKo ? '은평구' : 'Eunpyeong-gu',
    region: isKo ? '서울특별시' : 'Seoul',
    street: isKo ? '대조동 84-3 3층(동명여고 바로 옆)' : '3rd Floor, 84-3 Daejo-dong (Next to Dongmyeong Girls High School)',
    contactType: isKo ? '예약 및 상담' : 'Booking & Inquiry',
    residencyTitle: isKo ? '프리미엄 연습실 입주 프로그램' : 'Premium Practice Room Residency Program',
    residencyDesc: isKo
      ? '월 40만 원으로 방음 연습실과 입주 고객 전용 혜택을 제공합니다.'
      : 'Soundproof practice rooms and exclusive benefits starting for 400,000 KRW/month.',
    recordingService: isKo ? '레코딩 서비스' : 'Recording Service',
    mixingMastering: isKo ? '믹싱 & 마스터링' : 'Mixing & Mastering',
    productionPlanning: isKo ? '음반 기획' : 'Music Planning',
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: translations.name,
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${siteUrl}/logo/logo.png`,
          width: 3350,
          height: 862,
        },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: translations.contactType,
            telephone: '+82-2-764-3114',
            url: 'https://open.kakao.com/me/nol',
            availableLanguage: ['ko', 'en'],
          },
        ],
        sameAs: ['https://open.kakao.com/me/nol', 'https://naver.me/5gFZhS3X'],
        slogan: isKo ? '아티스트의 음악적 비전을 소리로 실현' : 'Realizing artists\' musical vision through sound',
        knowsLanguage: ['ko', 'en'],
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${siteUrl}/#studio`,
        name: translations.name,
        image: absoluteOgImage,
        url: siteUrl,
        description: description,
        priceRange: '$$',
        address: {
          '@type': 'PostalAddress',
          streetAddress: translations.street,
          addressLocality: translations.locality,
          addressRegion: translations.region,
          postalCode: '03424',
          addressCountry: 'KR',
        },
        telephone: '+82-2-764-3114',
        email: 'contact@kosmart.org',
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
        hasMap: 'https://naver.me/5gFZhS3X',
        paymentAccepted: 'Cash, Credit Card, Bank Transfer, KakaoPay',
        currenciesAccepted: 'KRW',

        parentOrganization: {
          '@id': `${siteUrl}/#organization`,
        },
        ...(reviewItems && reviewItems.length > 0
          ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: (
                reviewItems.reduce((acc, item) => acc + item.rating, 0) / reviewItems.length
              ).toFixed(1),
              reviewCount: reviewItems.length,
              bestRating: '5',
              worstRating: '1',
            },
            review: reviewItems.map((item) => ({
              '@type': 'Review',
              author: {
                '@type': 'Person',
                name: item.author,
              },
              reviewRating: {
                '@type': 'Rating',
                ratingValue: item.rating,
                bestRating: '5',
                worstRating: '1',
              },
              reviewBody: item.content,
              ...(item.datePublished ? { datePublished: item.datePublished } : {}),
            })),
          }
          : {}),
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: isKo ? '스튜디오 서비스' : 'Studio Services',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: translations.recordingService,
                description: isKo ? '프로페셔널 레코딩 서비스' : 'Professional recording services',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: translations.mixingMastering,
                description: isKo ? '전문 믹싱 및 마스터링 서비스' : 'Professional mixing and mastering services',
              },
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: translations.productionPlanning,
                description: isKo ? '음반 제작 전 과정 기획 및 지원' : 'Full-cycle music production planning and support',
              },
            },
            {
              '@type': 'Offer',
              name: translations.residencyTitle,
              description: translations.residencyDesc,
              priceCurrency: 'KRW',
              price: 400000,
              url: 'https://open.kakao.com/o/sAWXdN5g',
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Service',
                name: isKo ? '프리미엄 연습실 입주 프로그램' : 'Premium Practice Room Residency Program',
                description: isKo
                  ? '녹음실 할인, 음원 유통, 보도자료 작성, 버스킹 장비 대여, 전문가 피드백, 크라우드 펀딩 컨설팅, 예술지원사업 정보, 공구 대여'
                  : 'Recording Studio Discounts, Music Distribution, Press Release Writing, Busking Equipment Rental, Expert Feedback, Crowdfunding Consulting, Grant Information, Tool Rental',
                provider: {
                  '@type': 'Organization',
                  '@id': `${siteUrl}/#organization`,
                },
                areaServed: {
                  '@type': 'AdministrativeArea',
                  name: translations.region,
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
  const isKo = locale === 'ko';

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    datePublished: articlePublishedTime,
    dateModified: articleModifiedTime || articlePublishedTime,
    author: {
      '@type': 'Person',
      name: articleAuthor || (isKo ? '스튜디오 놀' : 'Studio NOL'),
    },
    publisher: {
      '@type': 'Organization',
      name: isKo ? '스튜디오 놀' : 'Studio NOL',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo512.png`,
      },
    },
    image: absoluteOgImage,
    description: description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': normalizedCanonical,
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

export const generateFaqSchema = (faqItems: FAQItem[] | null) => {
  if (!faqItems || faqItems.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
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

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description: description,
    provider: {
      '@type': 'Organization',
      name: isKo ? '스튜디오 놀' : 'Studio NOL',
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
  const isKo = locale === 'ko';
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
      name: isKo ? '스튜디오 놀' : 'Studio NOL',
      '@id': 'https://studionol.co.kr/#organization',
    },
    itemOffered: {
      '@type': 'Service',
      name: service.name,
      provider: {
        '@type': 'LocalBusiness',
        name: isKo ? '스튜디오 놀' : 'Studio NOL',
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

  const isKo = locale === 'ko';
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 6);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: catalogName,
    brand: {
      '@type': 'Brand',
      name: isKo ? '스튜디오 놀' : 'Studio NOL',
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
  const isKo = locale === 'ko';

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: isKo ? '스튜디오 놀' : 'Studio NOL',
    alternateName: 'Studio Nol',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${locale}/stories?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
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

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
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
  const isKo = locale === 'ko';

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
      name: isKo ? '스튜디오 놀' : 'Studio NOL',
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

export const generateVideoSchema = (video: VideoInput) => {
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
      name: 'Studio NOL',
      logo: {
        '@type': 'ImageObject',
        url: 'https://studionol.co.kr/logo512.png',
      },
    },
  };
};

