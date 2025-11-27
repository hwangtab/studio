import Head from 'next/head';

const SEO = ({
  title = '스튜디오 놀 - 음악 제작의 모든 것',
  description = '최고의 사운드를 위한 음악 제작 스튜디오, 스튜디오 놀. 전문적인 믹싱, 마스터링, 레코딩 서비스로 당신의 음악을 완성하세요.',
  keywords = '스튜디오 놀, 음악 제작, 레코딩, 믹싱, 마스터링, 음반 제작, 음악 프로듀싱, 연신내 스튜디오, 서울 녹음 스튜디오',
  canonical = 'https://studionol.co.kr/',
  ogImage = '/images/hardware2.jpg',
  ogType = 'website',
  includeSchema = false,
  schema,
  author = '스튜디오 놀',
  robots = 'index, follow',
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
}) => {
  // 기본 사이트 URL
  const siteUrl = 'https://studionol.co.kr';

  const toAbsoluteUrl = (value = '') => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const sanitized = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    return `${siteUrl}${sanitized}`;
  };

  // OG 이미지를 절대 URL로 변환
  const absoluteOgImage = toAbsoluteUrl(ogImage);

  const canonicalUrl = toAbsoluteUrl(canonical);
  // Canonical URL 정규화 (trailing slash 제거)
  const normalizedCanonical =
    canonicalUrl.endsWith('/') && canonicalUrl !== `${siteUrl}/`
      ? canonicalUrl.slice(0, -1)
      : canonicalUrl;

  const defaultSchema = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecordingStudio',
    name: '스튜디오 놀',
    alternateName: 'Studio Nol',
    url: siteUrl,
    logo: `${siteUrl}/logo512.png`,
    image: absoluteOgImage,
    description,
    priceRange: 'KRW 400000/month',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '대조동 84-3 3층',
      addressLocality: '은평구',
      addressRegion: '서울특별시',
      postalCode: '03424',
      addressCountry: 'KR',
    },
    telephone: '+82-2-764-3114',
    email: 'contact@kosmart.org',
    priceRange: '$$',
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
      geoRadius: '50000', // 50km
    },
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
              value: '오디오가이 및 The Orchard를 통한 글로벌 플랫폼 송출, 순이익 70% 아티스트 배분',
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
  const schemaData = schema || defaultSchema;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content={robots} />

      <meta name="geo.region" content="KR-11" />
      <meta name="geo.placename" content="서울특별시 은평구" />
      <meta name="geo.position" content="37.614353;126.925887" />
      <meta name="ICBM" content="37.614353, 126.925887" />

      {/* Preconnect to external image domains */}
      <link rel="preconnect" href="https://image.bugsm.co.kr" />
      <link rel="preconnect" href="https://img.tumblbug.com" />
      <link rel="preconnect" href="https://is1-ssl.mzstatic.com" />
      <link rel="preconnect" href="https://thumb.mt.co.kr" />
      <link rel="preconnect" href="https://cdn.imweb.me" />
      <link rel="preconnect" href="https://i.ytimg.com" />

      {/* Canonical URL */}
      <link rel="canonical" href={normalizedCanonical} />

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={normalizedCanonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:alt" content="스튜디오 놀 - 음악 제작 스튜디오" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ko_KR" />
      <meta property="og:site_name" content="스튜디오 놀" />
      {ogType === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {ogType === 'article' && articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}
      {ogType === 'article' && articleAuthor && (
        <meta property="article:author" content={articleAuthor} />
      )}
      {ogType === 'article' && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={normalizedCanonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content="스튜디오 놀 - 음악 제작 스튜디오" />
      {articleAuthor && <meta name="twitter:creator" content={articleAuthor} />}

      {/* Structured Data */}
      {includeSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      )}
    </Head>
  );
};

export default SEO;
