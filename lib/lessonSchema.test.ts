import { buildLessonServiceSchema } from './lessonSchema';

describe('buildLessonServiceSchema', () => {
  it('builds a Korean lesson Service schema with a distinct #service id', () => {
    expect(
      buildLessonServiceSchema({
        locale: 'ko',
        siteName: '스튜디오 놀',
        siteUrl: 'https://studionol.co.kr',
        title: '음악 레슨',
        description: '음악 제작 레슨',
      })
    ).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://studionol.co.kr/ko/lesson#service',
      name: '음악 레슨',
      description: '음악 제작 레슨',
      inLanguage: 'ko-KR',
      serviceType: '음악 레슨',
      areaServed: [
        { '@type': 'AdministrativeArea', name: '서울특별시' },
        { '@type': 'AdministrativeArea', name: '은평구' },
        { '@type': 'Neighborhood', name: 'Yeonsinnae' },
      ],
      provider: {
        '@type': 'Organization',
        '@id': 'https://studionol.co.kr/#organization',
        name: '스튜디오 놀',
      },
    });
  });

  it('uses English local labels for non-Korean lesson pages', () => {
    const schema = buildLessonServiceSchema({
      locale: 'en',
      siteName: 'Studio NOL',
      siteUrl: 'https://studionol.co.kr',
      title: 'Music Lesson',
      description: 'Music production lesson',
    });

    expect(schema).toMatchObject({
      inLanguage: 'en-US',
      serviceType: 'Music Lesson',
      areaServed: [
        { '@type': 'AdministrativeArea', name: 'Seoul' },
        { '@type': 'AdministrativeArea', name: 'Eunpyeong-gu' },
        { '@type': 'Neighborhood', name: 'Yeonsinnae' },
      ],
      location: {
        address: {
          addressLocality: 'Eunpyeong-gu',
          addressRegion: 'Seoul',
        },
      },
      url: 'https://studionol.co.kr/en/lesson',
    });
  });
});
