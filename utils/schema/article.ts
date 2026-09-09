import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles, studioOperator } from '../../data/siteConfig';
import { getSchemaLanguage } from './shared';
import { getOperatorAwards } from './person';

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

  // author는 **화면 바이라인과 같은 주체**를 가리킨다.
  //
  // 예전에는 frontmatter author가 없거나 '스튜디오 놀'이면 전부 운영자 Person(황경하)으로
  // 승격했다. GEO에서 Person + sameAs가 강한 entity 단서라는 이유였는데, 그 결과 스토리
  // 1,533편(97%)에서 화면은 "스튜디오 놀", JSON-LD는 "황경하"가 되어 구조화 데이터가
  // 페이지에 보이는 내용을 반영해야 한다는 원칙과 어긋났다(2026-09-08 감사 #4).
  //
  // 이 사이트의 스토리는 스튜디오 명의로 쓴다. 운영자 개인 명의는 frontmatter에 명시적으로
  // `author: 황경하`를 적은 글(플래그십)뿐이고, 그 경우에만 Person으로 낸다.
  //   - 미기재 또는 '스튜디오 놀' → Organization(#organization) 참조. 화면 표기와 동일.
  //   - '황경하'                  → Person(#person-hwang). 권위 프로필·수상 이력 포함.
  //   - 그 외(외부 기고자)        → 단순 Person. 잘못된 affiliation 신호를 피한다.
  //
  // Person entity의 GEO 가치는 사라지지 않는다 — Organization.founder와 /author의
  // ProfilePage가 같은 @id로 전 페이지 그래프에 실린다(utils/schema/person.ts).
  const isOperatorByline = articleAuthor === studioOperator.name;
  const isOrganizationByline = !articleAuthor || articleAuthor === config.name;
  // 운영자 개인 권위 프로필은 Person author에만 싣는다. 스튜디오 SNS는 Organization 노드가
  // 이미 sameAs로 들고 있으므로 여기서 다시 내지 않는다(같은 @id에 중복 배열을 만들지 않기).
  const operatorSameAs = [
    ...Object.values(socialProfiles),
    ...(studioOperator.sameAs ?? []),
  ].filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  // canonical Person @id (host 기반) — release-project schema와 동일 entity로 묶어
  // AI/Google이 황경하를 단일 entity로 인식하게 함. locale 독립 ID로 다국어 alternate도 통합.
  const personId = `${siteUrl}/#person-hwang`;
  const operatorAwards = getOperatorAwards();
  const operatorPersonAuthor = {
    '@type': 'Person',
    '@id': personId,
    name: studioOperator.name,
    jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
    // Person 권위 프로필 홈 — /author 프로필 페이지(ProfilePage mainEntity)와 일치.
    url: `${siteUrl}/${locale}/author`,
    ...(operatorSameAs.length > 0 && { sameAs: operatorSameAs }),
    ...(operatorAwards.length > 0 && { award: operatorAwards }),
    worksFor: {
      '@type': 'Organization',
      '@id': organizationId,
      name: config.name,
    },
  };
  // 조직 명의 글은 전 페이지 그래프에 이미 실린 Organization 노드를 참조만 한다
  // (name까지 다시 쓰면 같은 @id에 값이 두 벌 생긴다 — /author Person 중복과 같은 문제).
  const organizationAuthor = {
    '@type': 'Organization',
    '@id': organizationId,
    name: config.name,
  };

  let author: Record<string, unknown>;
  if (isOperatorByline) {
    author = operatorPersonAuthor;
  } else if (isOrganizationByline) {
    author = organizationAuthor;
  } else {
    author = { '@type': 'Person', name: articleAuthor! };
  }

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
