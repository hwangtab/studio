import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles, studioOperator } from '../../data/siteConfig';

// 운영자 전문 분야 — Person.knowsAbout 단일 소스 (article/releaseProject/author 페이지 공유).
export const OPERATOR_KNOWS_ABOUT: Record<'ko' | 'en', string[]> = {
  ko: ['A&R', '아티스트 발굴·육성', '음반 기획', '보컬 디렉팅', '믹싱', '인디 음악 유통', '평론 PR', '해외 매체·라디오·플레이리스트 피칭', '음반 크라우드펀딩 기획', '예술지원사업', '세션 네트워킹'],
  en: ['A&R', 'Artist Discovery & Development', 'Album Production', 'Vocal Direction', 'Mixing', 'Indie Music Distribution', 'Press PR', 'International Radio & Playlist Pitching', 'Music Crowdfunding Planning', 'Arts Grant Programs', 'Session Networking'],
};

export const getOperatorKnowsAbout = (locale: Locale): string[] =>
  locale === 'ko' ? OPERATOR_KNOWS_ABOUT.ko : OPERATOR_KNOWS_ABOUT.en;

// 운영자 Person 권위 프로필 URL — Person.url의 단일 소스.
// article/releaseProject 스키마와 author 페이지가 같은 URL을 가리켜야 entity가 하나로 묶인다.
export const getOperatorProfileUrl = (siteUrl: string, locale: Locale): string =>
  `${siteUrl}/${locale}/author`;

/**
 * Person.subjectOf — 운영자를 다룬 제3자 언론 보도.
 *
 * sameAs(본인이 관리하는 프로필)와 구분한다. 수상 이력 같은 자기주장을 사이트 밖에서
 * 검증할 수 있는 근거라, AI 엔진의 entity 신뢰도에 직접 작용한다.
 */
export const getOperatorPressCoverage = () =>
  (studioOperator.pressCoverage ?? []).map((article) => ({
    '@type': 'NewsArticle',
    headline: article.title,
    url: article.url,
    datePublished: article.datePublished,
    publisher: { '@type': 'Organization', name: article.publisher },
  }));

/** 운영자 Person entity의 canonical @id — locale 독립(다국어 alternate가 한 entity로 묶인다). */
export const getOperatorPersonId = (siteUrl: string): string => `${siteUrl}/#person-hwang`;

/**
 * Person.award — 수상 이력을 "2017 한국대중음악상 선정위원 특별상 〈젠트리피케이션〉" 형태 문자열로.
 * article·releaseProject 스키마도 같은 목록을 쓸 수 있도록 여기가 단일 변환 지점이다.
 */
export const getOperatorAwards = (): string[] =>
  (studioOperator.awards ?? []).map((award) =>
    [award.year, award.name, award.category, `〈${award.work}〉`].filter(Boolean).join(' ')
  );

/**
 * 운영자 Person entity(#person-hwang)의 canonical 노드 — @context 없는 @graph용 조각.
 *
 * 유일한 소비처는 generateDefaultSchema다. 전 페이지 @graph에 심어 Organization.founder가
 * 가리킬 실체를 만든다. 이게 없으면 /pricing·/recording 같은 커머셜 페이지에 Person entity가
 * 아예 없어서, 정작 "연신내 녹음실" 류 쿼리가 도달하는 면에 수상 이력과 얼굴이 하나도 실리지
 * 않는다(스토리와 /author에만 있었다).
 *
 * /author 페이지(generatePersonProfileSchema)는 이 완전 노드를 다시 만들지 않는다 — @id 참조 +
 * 그 페이지에만 필요한 description만 낸다. 완전 노드를 두 번 내보내면 배열 속성(award·sameAs·
 * subjectOf)이 값은 같아도 물리적으로 중복된 두 객체로 남아, node-map 병합을 엄격히 하는
 * 소비자에게 합집합 중복으로 보일 수 있다(2026-09-08 감사 #3). 정본은 여기 하나뿐이다.
 */
export const buildOperatorPersonNode = (
  siteUrl: string,
  locale: Locale,
  options: { description?: string } = {}
) => {
  const config = getSiteConfig(locale);
  const organizationId = `${siteUrl}/#organization`;
  const sameAs = [
    ...Object.values(socialProfiles),
    ...(studioOperator.sameAs ?? []),
  ].filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  const press = getOperatorPressCoverage();
  const awards = getOperatorAwards();

  return {
    '@type': 'Person',
    '@id': getOperatorPersonId(siteUrl),
    name: studioOperator.name,
    alternateName: studioOperator.alternateName,
    jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
    ...(options.description && { description: options.description }),
    url: getOperatorProfileUrl(siteUrl, locale),
    // Person.image — 검색·AI 엔진이 entity에 얼굴을 연결하는 신호. 절대 URL이어야 한다.
    // /author 히어로 아바타와 같은 사진(siteConfig.studioOperator.portrait 단일 소스).
    image: {
      '@type': 'ImageObject',
      url: `${siteUrl}${studioOperator.portrait.src}`,
      width: studioOperator.portrait.width,
      height: studioOperator.portrait.height,
    },
    // Person.award — 수상 이력 전체를 배열로. 문자열 하나였을 땐 한 건만 나갔다.
    ...(awards.length > 0 && { award: awards }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(press.length > 0 && { subjectOf: press }),
    knowsAbout: getOperatorKnowsAbout(locale),
    worksFor: { '@type': 'Organization', '@id': organizationId, name: config.name },
  };
};

/**
 * Person 프로필 스키마 — /[locale]/author 페이지의 mainEntity.
 * generateArticleSchema·generateReleaseProjectSchema와 동일한 @id(#person-hwang)를 사용해
 * 사이트 전체에서 황경하를 단일 entity로 인식시킨다 (GEO/E-E-A-T 핵심).
 *
 * 완전 노드가 아니라 @id 참조 + description만 낸다. name·jobTitle·award·sameAs·subjectOf
 * 같은 정본 속성은 generateDefaultSchema가 이미 같은 @graph에 심어 둔 buildOperatorPersonNode
 * 노드가 담당한다(위 주석 참고) — 여기서 다시 내면 같은 @id를 가진 완전 노드가 두 개가 된다.
 */
export const generatePersonProfileSchema = (
  siteUrl: string,
  locale: Locale,
  description: string
) => {
  void locale;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': getOperatorPersonId(siteUrl),
    description,
  };
};
