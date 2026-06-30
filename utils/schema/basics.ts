import { Breadcrumb, FAQItem } from '../../types/data';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { getSchemaLanguage } from './shared';

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
          streetAddress: getSiteConfig(locale).contact.address,
          addressLocality: isKo ? '은평구' : 'Eunpyeong-gu',
          addressRegion: isKo ? '서울특별시' : 'Seoul',
          addressCountry: 'KR',
        },
      },
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
