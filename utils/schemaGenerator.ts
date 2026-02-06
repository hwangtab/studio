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
    serviceTypes: isKo
      ? ['레코딩', '믹싱', '마스터링', '음반 기획', '음원 유통', '음악 프로덕션']
      : ['Recording', 'Mixing', 'Mastering', 'Music Planning', 'Music Distribution', 'Music Production'],
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
    '@type': ['MusicRecordingStudio', 'LocalBusiness', 'Organization'],
    name: translations.name,
    alternateName: 'Studio Nol',
    url: siteUrl,
    logo: `${siteUrl}/logo512.png`,
    image: absoluteOgImage,
    description,
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
    sameAs: ['https://open.kakao.com/me/nol', 'https://naver.me/5gFZhS3X'],
    serviceType: translations.serviceTypes,
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
      ],
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
    offers: [
      {
        '@type': 'Offer',
        name: translations.residencyTitle,
        description: translations.residencyDesc,
        priceCurrency: 'KRW',
        price: 400000,
        url: 'https://open.kakao.com/o/sAWXdN5g',
        availability: 'https://schema.org/InStock',
        eligibleCustomerType: 'https://schema.org/BusinessCustomer',
        itemOffered: {
          '@type': 'Service',
          name: 'Studio Nol Residency Benefits',
          serviceType: isKo ? [
            '녹음실 할인',
            '음원 유통',
            '보도자료 작성',
            '버스킹 장비 대여',
            '전문가 피드백',
            '크라우드 펀딩 컨설팅',
            '예술지원사업 정보',
            '공구 대여',
          ] : [
            'Recording Studio Discounts',
            'Music Distribution',
            'Press Release Writing',
            'Busking Equipment Rental',
            'Expert Feedback',
            'Crowdfunding Consulting',
            'Grant Information',
            'Tool Rental',
          ],
          provider: translations.name,
          areaServed: translations.region,
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: 10000,
            highPrice: 200000,
            offerCount: 8,
          },
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
  };
};

