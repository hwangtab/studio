import Head from 'next/head';

const SEO = ({
  title = '스튜디오 놀 - 음악 제작의 모든 것',
  description = '최고의 사운드를 위한 음악 제작 스튜디오, 스튜디오 놀. 전문적인 믹싱, 마스터링, 레코딩 서비스로 당신의 음악을 완성하세요.',
  keywords = '스튜디오 놀, 음악 제작, 레코딩, 믹싱, 마스터링, 음반 제작, 음악 프로듀싱, 연신내 스튜디오, 서울 녹음 스튜디오',
  canonical = 'https://studionol.co.kr/',
  ogImage = '/images/hardware2.jpg',
  includeSchema = false,
  structuredData = [],
}) => {
  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecordingStudio',
    name: '스튜디오 놀',
    url: 'https://studionol.co.kr/',
    logo: '/logo512.png',
    image: ogImage,
    description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '대조동 84-3 3층',
      addressLocality: '은평구',
      addressRegion: '서울특별시',
      addressCountry: 'KR',
    },
    telephone: '+82-2-764-3114',
    email: 'contact@kosmart.org',
    priceRange: '$$',
    openingHours: 'Mo-Su 10:00-22:00',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '37.5',
      longitude: '126.9',
    },
    sameAs: ['https://open.kakao.com/me/nol'],
    serviceType: ['레코딩', '믹싱', '마스터링', '음반 기획', '음원 유통', '음악 프로덕션'],
  };

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="ko_KR" />
      <meta property="og:site_name" content="스튜디오 놀" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {[includeSchema ? schemaData : null, ...structuredData]
        .filter(Boolean)
        .map((schema, index) => (
          <script
            // eslint-disable-next-line react/no-array-index-key
            key={`schema-${index}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          />
        ))}
    </Head>
  );
};

export default SEO;
