import { buildSchemaGraph, buildStudioServiceSchema } from './studioServiceSchema';

describe('buildStudioServiceSchema', () => {
  it('builds a localized Studio NOL service schema with provider, place, and offer data', () => {
    const schema = buildStudioServiceSchema({
      locale: 'ko',
      siteName: '스튜디오 놀',
      siteUrl: 'https://studionol.co.kr',
      pageUrl: 'https://studionol.co.kr/ko/voice-acting',
      name: '성우 녹음',
      description: '성우 녹음 서비스',
      serviceType: '성우 녹음',
      offerName: '성우/나레이션 녹음',
      offerPrice: 100000,
    });

    expect(schema).toMatchObject({
      '@type': 'Service',
      name: '성우 녹음',
      description: '성우 녹음 서비스',
      inLanguage: 'ko-KR',
      serviceType: '성우 녹음',
      areaServed: {
        '@type': 'City',
        name: '서울특별시 은평구',
      },
      provider: {
        '@type': 'Organization',
        '@id': 'https://studionol.co.kr/#organization',
        name: '스튜디오 놀',
        url: 'https://studionol.co.kr',
      },
      url: 'https://studionol.co.kr/ko/voice-acting',
      offers: {
        '@type': 'Offer',
        name: '성우/나레이션 녹음',
        priceCurrency: 'KRW',
        price: 100000,
        availability: 'https://schema.org/InStock',
        url: 'https://studionol.co.kr/ko/pricing#special-packages',
      },
    });
  });

  it('uses English local area labels for non-Korean locale pages', () => {
    const schema = buildStudioServiceSchema({
      locale: 'en',
      siteName: 'Studio NOL',
      siteUrl: 'https://studionol.co.kr',
      pageUrl: 'https://studionol.co.kr/en/cover-video',
      name: 'Cover Video',
      description: 'Cover video production',
      serviceType: 'Cover Video Production',
      offerName: 'Cover Video All-in-One Package',
      offerPrice: 350000,
    });

    expect(schema.areaServed).toEqual({
      '@type': 'City',
      name: 'Eunpyeong-gu, Seoul',
    });
    expect(schema.location).toMatchObject({
      address: {
        addressLocality: 'Eunpyeong-gu',
        addressRegion: 'Seoul',
      },
    });
  });
});

describe('buildSchemaGraph', () => {
  it('wraps schema items in a schema.org graph', () => {
    expect(buildSchemaGraph({ '@type': 'Service' }, { '@type': 'HowTo' })).toEqual({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Service' }, { '@type': 'HowTo' }],
    });
  });
});
