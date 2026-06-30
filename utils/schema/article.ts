import { type Locale } from '../../lib/i18n';
import { getSiteConfig, socialProfiles, studioOperator } from '../../data/siteConfig';
import { getSchemaLanguage } from './shared';

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

  // Author E-E-A-T 보강: 사이트 본인 명의 글은 실제 운영자(Person)로 author entity 명시.
  // GEO에서 ChatGPT/Claude는 author.name + sameAs를 entity 단서로 강하게 사용 — Organization
  // name을 Person.name에 박으면 entity resolution이 안 됨. 외부 기고자(articleAuthor가
  // config.name과 다른 경우)는 단순 Person으로 유지해 잘못된 affiliation 시그널을 피한다.
  const isStudioAuthor = !articleAuthor || articleAuthor === config.name;
  const authorName = isStudioAuthor ? studioOperator.name : articleAuthor!;
  // 스튜디오 SNS(socialProfiles) + 운영자 본인 권위 프로필(studioOperator.sameAs)을 author entity에 병합.
  // 운영자 개인 프로필은 Person author sameAs에만 들어가고 Organization sameAs(line 61)에는 섞지 않는다.
  const authorSameAs = [
    ...Object.values(socialProfiles),
    ...(isStudioAuthor ? studioOperator.sameAs ?? [] : []),
  ].filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  // canonical Person @id (host 기반) — release-project schema와 동일 entity로 묶어
  // AI/Google이 황경하를 단일 entity로 인식하게 함. locale 독립 ID로 다국어 alternate도 통합.
  const personId = `${siteUrl}/#person-hwang`;
  const author = isStudioAuthor
    ? {
        '@type': 'Person',
        '@id': personId,
        name: authorName,
        jobTitle: studioOperator.jobTitleByLocale[locale] || studioOperator.jobTitleByLocale.ko,
        url: `${siteUrl}/${locale}/about`,
        ...(authorSameAs.length > 0 && { sameAs: authorSameAs }),
        ...(studioOperator.award && { award: studioOperator.award }),
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
