import { Breadcrumb, FAQItem, ReviewItem } from '../types/data';

export const generateDefaultSchema = (
  siteUrl: string,
  absoluteOgImage: string,
  description: string,
  reviewItems: ReviewItem[] | null
) => {
  return {
    '@context': 'https://schema.org',
    '@type': ['MusicRecordingStudio', 'LocalBusiness', 'Organization'],
    name: '스튜디오 놀',
    alternateName: 'Studio Nol',
    url: siteUrl,
    logo: `${siteUrl}/logo512.png`,
    image: absoluteOgImage,
    description,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '대조동 84-3 3층(동명여고 바로 옆)',
      addressLocality: '은평구',
      addressRegion: '서울특별시',
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
          datePublished: item.datePublished || new Date().toISOString().split('T')[0],
        })),
      }
      : {}),
    sameAs: ['https://open.kakao.com/me/nol'],
    serviceType: ['레코딩', '믹싱', '마스터링', '음반 기획', '음원 유통', '음악 프로덕션'],
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
      ],
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: '예약 및 상담',
        telephone: '+82-507-1384-3144',
        url: 'https://open.kakao.com/o/sAWXdN5g',
        availableLanguage: ['ko'],
      },
    ],
    offers: [
      {
        '@type': 'Offer',
        name: '프리미엄 연습실 입주 프로그램',
        description: '월 40만 원으로 방음 연습실과 입주 고객 전용 혜택을 제공합니다.',
        priceCurrency: 'KRW',
        price: 400000,
        url: 'https://open.kakao.com/o/sAWXdN5g',
        availability: 'https://schema.org/InStock',
        eligibleCustomerType: 'https://schema.org/BusinessCustomer',
        itemOffered: {
          '@type': 'Service',
          name: 'Studio Nol Residency Benefits',
          serviceType: [
            '녹음실 할인',
            '음원 유통',
            '보도자료 작성',
            '버스킹 장비 대여',
            '전문가 피드백',
            '크라우드 펀딩 컨설팅',
            '예술지원사업 정보',
            '공구 대여',
          ],
          provider: '스튜디오 놀',
          areaServed: '서울특별시',
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: 10000,
            highPrice: 200000,
            offerCount: 8,
          },
          amenityFeature: [
            {
              '@type': 'LocationFeatureSpecification',
              name: 'Premium Recording Chain',
              value: 'Neumann U87AI, Vintech X73i, Tegeler tube compressor, Prism Sound Lyra 2, Proac/EVE monitoring',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '무료 음원 유통',
              value: '오디오가이를 통한 글로벌 플랫폼 송출, 순이익 70% 아티스트 배분',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '홍보 지원',
              value: '전문 보도자료 작성, 뉴스아트 및 주요 매체 배포, 아티스트 프로필 작성',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '버스킹 장비',
              value: 'Roland CUBE Street EX2 2대, 마이크/케이블/스탠드, 180W 파워뱅크, 이동용 캐리어',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '전문가 피드백',
              value: 'A&R 관점 컨설팅과 장르별 믹싱/마스터링 방향 제안',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '크라우드 펀딩 컨설팅',
              value: '플랫폼 추천, 목표 금액, 리워드 구성, 스토리텔링 및 마케팅 전략 자문',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '예술지원사업 정보',
              value: 'KOCCA, 예술위, 서울문화재단 지원사업 맞춤 추천 및 서류 준비 조언',
            },
            {
              '@type': 'LocationFeatureSpecification',
              name: '공구 무료 대여',
              value: '전동드릴, 니퍼, 펜치, 드라이버 등 장비 설치/수리용 공구 제공',
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
  articleAuthor?: string
) => {
  if (!articlePublishedTime) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    datePublished: articlePublishedTime,
    dateModified: articleModifiedTime || articlePublishedTime,
    author: {
      '@type': 'Person',
      name: articleAuthor || '스튜디오 놀',
    },
    publisher: {
      '@type': 'Organization',
      name: '스튜디오 놀',
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
  normalizedCanonical: string
) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description: description,
    provider: {
      '@type': 'Organization',
      name: '스튜디오 놀',
      sameAs: siteUrl,
    },
    image: absoluteOgImage,
    url: normalizedCanonical,
  };
};

