import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles, studioOperator } from '../../data/siteConfig';

// 운영자 전문 분야 — Person.knowsAbout 단일 소스 (article/releaseProject/author 페이지 공유).
export const OPERATOR_KNOWS_ABOUT: Record<'ko' | 'en', string[]> = {
  ko: ['A&R', '음반 기획', '보컬 디렉팅', '믹싱', '인디 음악 유통', '평론 PR', '세션 네트워킹'],
  en: ['A&R', 'Album Production', 'Vocal Direction', 'Mixing', 'Indie Music Distribution', 'Press PR', 'Session Networking'],
};

export const getOperatorKnowsAbout = (locale: Locale): string[] =>
  locale === 'ko' ? OPERATOR_KNOWS_ABOUT.ko : OPERATOR_KNOWS_ABOUT.en;

// 운영자 Person 권위 프로필 URL — Person.url의 단일 소스.
// article/releaseProject 스키마와 author 페이지가 같은 URL을 가리켜야 entity가 하나로 묶인다.
export const getOperatorProfileUrl = (siteUrl: string, locale: Locale): string =>
  `${siteUrl}/${locale}/author`;

/**
 * Person 프로필 스키마 — /[locale]/author 페이지의 mainEntity.
 * generateArticleSchema·generateReleaseProjectSchema와 동일한 @id(#person-hwang)를 사용해
 * 사이트 전체에서 황경하를 단일 entity로 인식시킨다 (GEO/E-E-A-T 핵심).
 */
export const generatePersonProfileSchema = (
  siteUrl: string,
  locale: Locale,
  description: string
) => {
  const config = getSiteConfig(locale);
  const organizationId = `${siteUrl}/#organization`;
  const sameAs = [
    ...Object.values(socialProfiles),
    ...(studioOperator.sameAs ?? []),
  ].filter((url): url is string => typeof url === 'string' && url.trim() !== '');

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${siteUrl}/#person-hwang`,
    name: studioOperator.name,
    jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
    description,
    url: getOperatorProfileUrl(siteUrl, locale),
    ...(studioOperator.award && { award: studioOperator.award }),
    ...(sameAs.length > 0 && { sameAs }),
    knowsAbout: getOperatorKnowsAbout(locale),
    worksFor: { '@type': 'Organization', '@id': organizationId, name: config.name },
  };
};
