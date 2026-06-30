import type { Locale } from './i18n';
import { getSchemaLanguage } from '../utils/schema';

interface BuildLessonServiceSchemaOptions {
  locale: Locale;
  siteName: string;
  siteUrl: string;
  title: string;
  description: string;
}

export const buildLessonServiceSchema = ({
  locale,
  siteName,
  siteUrl,
  title,
  description,
}: BuildLessonServiceSchemaOptions) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  // 동 페이지의 Course schema(#course)와 구분해 Rich Results entity 충돌을 피한다.
  '@id': `${siteUrl}/${locale}/lesson#service`,
  name: title,
  description,
  inLanguage: getSchemaLanguage(locale),
  serviceType: locale === 'ko' ? '음악 레슨' : 'Music Lesson',
  areaServed: [
    { '@type': 'AdministrativeArea', name: locale === 'ko' ? '서울특별시' : 'Seoul' },
    { '@type': 'AdministrativeArea', name: locale === 'ko' ? '은평구' : 'Eunpyeong-gu' },
    { '@type': 'Neighborhood', name: 'Yeonsinnae' },
  ],
  location: {
    '@type': 'Place',
    name: siteName,
    address: {
      '@type': 'PostalAddress',
      addressLocality: locale === 'ko' ? '은평구' : 'Eunpyeong-gu',
      addressRegion: locale === 'ko' ? '서울특별시' : 'Seoul',
      postalCode: '03424',
      addressCountry: 'KR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 37.614353,
      longitude: 126.925887,
    },
  },
  url: `${siteUrl}/${locale}/lesson`,
  provider: {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: siteName,
  },
});
