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
const VOCAL_PACKAGE_OFFER_NAMES: Record<Locale, string> = {
  ko: '보컬 녹음 1프로 (1곡 패키지)', en: 'Vocal Recording 1-Song Package', zh: '人声录音1首套餐',
  es: 'Paquete de Grabación Vocal (1 canción)', vi: 'Gói thu âm vocal (1 bài)',
  th: 'แพ็กเกจอัดเสียงร้อง (1 เพลง)', uz: "Vokal yozish paketi (1 qo'shiq)",
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
  const vocalPackageOfferName = VOCAL_PACKAGE_OFFER_NAMES[locale];
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
        // 일요일은 entry를 제거해 "closed" 의미를 정확히 표현. 일부 schema validator가
        // opens=closes="00:00"을 24시간 영업으로 오해해서 잘못된 OpeningHours를 surface.
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
            price: 250000,
            url: `${siteUrl}/${locale}/pricing`,
            availability: 'https://schema.org/InStock',
            itemOffered: { '@type': 'Service', name: vocalPackageOfferName },
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

  // Author E-E-A-T 보강: 사이트 본인 명의(스튜디오 놀)인 경우 brand authority 신호로
  // sameAs(SNS)·worksFor(Organization @id) 연결을 추가한다. 외부 기고자(articleAuthor가
  // 명시되고 config.name과 다른 경우)는 단순 Person으로 유지해 잘못된 affiliation 시그널을
  // 보내지 않는다.
  const authorName = articleAuthor || config.name;
  const isStudioAuthor = !articleAuthor || articleAuthor === config.name;
  const authorSameAs = Object.values(socialProfiles).filter(
    (url): url is string => typeof url === 'string' && url.trim() !== ''
  );
  const author = isStudioAuthor
    ? {
        '@type': 'Person',
        name: authorName,
        url: `${siteUrl}/${locale}/about`,
        ...(authorSameAs.length > 0 && { sameAs: authorSameAs }),
        worksFor: {
          '@type': 'Organization',
          '@id': organizationId,
          name: config.name,
        },
      }
    : {
        '@type': 'Person',
        name: authorName,
      };

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
    author,
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

  // Localized service name/description per locale. Korean 본문은 KR 검색용 그대로
  // 유지하고, 그 외 locale은 자연스러운 영어/현지 표현으로 출력해 Google가
  // /en/practice-room 등 외국어 페이지에서 한글 잔재로 인한 페널티를 받지
  // 않도록 한다.
  type ServiceCopy = { name: string; serviceType: string; description: string; offerName: string };
  const copyByLocale: Record<string, ServiceCopy> = {
    ko: {
      name: '음악연습실 월세 입주 — 스튜디오 놀',
      serviceType: '음악연습실 월세 입주',
      description:
        '서울 은평구 연신내역 도보 5분 거리 24시간 음악연습실 월세 입주 프로그램. 보증금 없음, 최소 1개월, 개별 도어록·냉난방·방음 설계 포함.',
      offerName: '음악연습실 월세 입주 (개인 연습실)',
    },
    en: {
      name: 'Monthly Practice Room Residency — Studio NOL',
      serviceType: 'Music practice room monthly rental',
      description:
        '24/7 soundproof music practice room in Eunpyeong-gu, Seoul — 5 min from Yeonsinnae Station. No deposit, 1-month minimum, private door lock, climate control, and studio-grade acoustic isolation.',
      offerName: 'Monthly Practice Room Residency (Private Room)',
    },
    zh: {
      name: '音乐练习室月租入住 — Studio NOL',
      serviceType: '音乐练习室月租',
      description:
        '首尔恩平区延新内站步行5分钟，24小时音乐练习室月租入住。无押金，最短1个月，独立门锁、冷暖空调、专业隔音设计。',
      offerName: '音乐练习室月租入住（个人练习室）',
    },
    es: {
      name: 'Sala de ensayo musical con alquiler mensual — Studio NOL',
      serviceType: 'Alquiler mensual de sala de ensayo musical',
      description:
        'Sala de ensayo musical 24/7 en Eunpyeong-gu, Seúl, a 5 min de la estación Yeonsinnae. Sin depósito, mínimo 1 mes, cerradura privada, climatización y aislamiento acústico profesional.',
      offerName: 'Alquiler mensual de sala de ensayo (sala privada)',
    },
    vi: {
      name: 'Phòng tập nhạc thuê tháng — Studio NOL',
      serviceType: 'Cho thuê phòng tập nhạc theo tháng',
      description:
        'Phòng tập nhạc cách âm 24/7 ở Eunpyeong-gu, Seoul, 5 phút từ ga Yeonsinnae. Không cọc, thuê tối thiểu 1 tháng, khóa riêng, điều hòa và cách âm chuyên nghiệp.',
      offerName: 'Phòng tập nhạc thuê tháng (phòng riêng)',
    },
    th: {
      name: 'ห้องซ้อมดนตรีเช่ารายเดือน — Studio NOL',
      serviceType: 'เช่าห้องซ้อมดนตรีรายเดือน',
      description:
        'ห้องซ้อมดนตรีกันเสียง 24 ชม. ใน Eunpyeong-gu กรุงโซล ห่างจากสถานี Yeonsinnae 5 นาที ไม่มีค่ามัดจำ เช่าขั้นต่ำ 1 เดือน มีล็อกประตูส่วนตัว ปรับอุณหภูมิ และกันเสียงระดับสตูดิโอ',
      offerName: 'ห้องซ้อมดนตรีรายเดือน (ห้องส่วนตัว)',
    },
    uz: {
      name: 'Oylik musiqa mashq xonasi — Studio NOL',
      serviceType: 'Musiqa mashq xonasi oylik ijarasi',
      description:
        '24/7 tovush izolyatsiyali musiqa mashq xonasi, Eunpyeong-gu, Seul, Yeonsinnae bekatidan 5 daqiqa. Depozitsiz, minimal 1 oy, shaxsiy qulf, iqlim nazorati va professional akustik izolyatsiya.',
      offerName: 'Oylik mashq xonasi (shaxsiy xona)',
    },
  };
  const copy = copyByLocale[locale] ?? copyByLocale.ko;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#practice-room-monthly-rent`,
    name: copy.name,
    serviceType: copy.serviceType,
    description: copy.description,
    provider: {
      '@type': 'LocalBusiness',
      '@id': `${config.url}/#studio`,
      name: config.name,
      url: config.url,
    },
    // 21개 dedicated 지역 LP가 커버하는 service area를 명시. Google이 LocalBusiness
    // service area를 정밀히 인식해 '연신내 음악연습실' 등 long-tail 지역 검색에서
    // 부스트. 행정구역(City/AdministrativeArea) + 동·역 단위 Place 혼합.
    // alternateName: 영문 음역 병기 — 외국인 사용자가 영문 'Yeonsinnae' 등으로 검색
    // 시에도 Google이 동일 area로 매칭하도록 시그널 보강.
    areaServed: [
      { '@type': 'City', name: '서울특별시', alternateName: 'Seoul' },
      { '@type': 'AdministrativeArea', name: '은평구', alternateName: 'Eunpyeong-gu' },
      { '@type': 'AdministrativeArea', name: '서대문구', alternateName: 'Seodaemun-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 덕양구', alternateName: 'Goyang-si Deokyang-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 일산동구', alternateName: 'Goyang-si Ilsandong-gu' },
      { '@type': 'AdministrativeArea', name: '고양시 일산서구', alternateName: 'Goyang-si Ilsanseo-gu' },
      { '@type': 'Place', name: '연신내', alternateName: 'Yeonsinnae' },
      { '@type': 'Place', name: '불광', alternateName: 'Bulgwang' },
      { '@type': 'Place', name: '대조동', alternateName: 'Daejo-dong' },
      { '@type': 'Place', name: '녹번', alternateName: 'Nokbeon' },
      { '@type': 'Place', name: '독바위', alternateName: 'Dokbawi' },
      { '@type': 'Place', name: '구산', alternateName: 'Gusan' },
      { '@type': 'Place', name: '역촌', alternateName: 'Yeokchon' },
      { '@type': 'Place', name: '응암', alternateName: 'Eungam' },
      { '@type': 'Place', name: '새절', alternateName: 'Saejeol' },
      { '@type': 'Place', name: '증산', alternateName: 'Jeungsan' },
      { '@type': 'Place', name: '상암', alternateName: 'Sangam' },
      { '@type': 'Place', name: '구파발', alternateName: 'Gupabal' },
      { '@type': 'Place', name: '지축', alternateName: 'Jichuk' },
      { '@type': 'Place', name: '삼송', alternateName: 'Samsong' },
      { '@type': 'Place', name: '원흥', alternateName: 'Wonheung' },
      { '@type': 'Place', name: '원당', alternateName: 'Wondang' },
      { '@type': 'Place', name: '일산', alternateName: 'Ilsan' },
    ],
    offers: {
      '@type': 'Offer',
      name: copy.offerName,
      price: 360000,
      priceCurrency: 'KRW',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: 360000,
        priceCurrency: 'KRW',
        unitCode: 'MON',
        unitText: locale === 'ko' ? '월'
          : locale === 'zh' ? '月'
          : locale === 'es' ? 'mes'
          : locale === 'vi' ? 'tháng'
          : locale === 'th' ? 'เดือน'
          : locale === 'uz' ? 'oy'
          : 'month',
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
