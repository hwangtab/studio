import { Breadcrumb, FAQItem } from '../../types/data';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { LESSON_MONTHLY_PRICE } from '../../data/pricing';
import { getOperatorPersonId } from './person';
import { getOfferPriceValidUntil, getSchemaLanguage } from './shared';

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
      // 리터럴 350000이 박혀 있었다. data/pricing.ts와 값이 우연히 같았을 뿐이라
      // 레슨가를 올리면 JSON-LD만 옛 가격으로 남는다(그 파일 주석이 경고하는 드리프트).
      // 350,000은 레슨·축가·음반기획 세 상품의 우연한 동일값이라 특히 위험하다.
      price: LESSON_MONTHLY_PRICE,
      // 다른 Offer는 전부 getOfferPriceValidUntil()을 쓰는데 Course만 빠져 있었다.
      // 없으면 Google이 가격을 만료 처리한다.
      priceValidUntil: getOfferPriceValidUntil(),
      availability: 'https://schema.org/InStock',
      url: normalizedCanonical,
    },
    availableLanguage: [schemaLanguage],
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      courseWorkload: 'PT1H',
      inLanguage: schemaLanguage,
      // 강사를 무명 문자열('스튜디오 놀 엔지니어')로 두면, 레슨 쿼리의 핵심 신뢰 신호인
      // "누가 가르치나"에 2017 한국대중음악상 수상 이력이 붙지 않는다. #person-hwang을
      // 참조하면 같은 @graph의 Person 노드(award·sameAs·subjectOf 포함)로 해석된다.
      instructor: { '@id': getOperatorPersonId(siteUrl) },
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
  webPageType?: string,
  // 정적 페이지 lastmod 정본(lib/pageLastmod.ts)에서 온 ISO 문자열. 값이 없으면(정본에
  // 항목이 없거나 article 페이지라 Article.dateModified가 이미 담당) 필드를 아예 생략한다 —
  // CLAUDE.md "lastmod 정책": 가짜 날짜를 만들어 채우지 않는다.
  dateModified?: string
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
    ...(dateModified && { dateModified }),
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
  locale: Locale = 'ko',
  /**
   * 이 절차를 수행하는 데 실제로 필요한 도구. 호출부가 알 때만 넘긴다.
   *
   * 예전에는 여기가 '전문 녹음 장비'로 하드코딩돼 조건 없이 붙었다. 그런데 실제
   * howTo 보유 60편의 주제는 보컬 발성 훈련·악기 연습·음원 유통·EPK 제작·노래 키 찾기·
   * 예약 흐름이 다수다 — 예컨대 distribution1의 절차는 "DistroKid 가입 → 메타데이터 입력"
   * 인데 필요 도구로 녹음 장비가 발행됐다. LLM이 절차를 요약할 때 존재하지 않는
   * 장비 요구사항을 주입할 수 있는 사실 오류였다(lib/factGuards.ts는 본문만 검사하고
   * JSON-LD는 보지 않아 CI에서도 안 걸렸다).
   * schema.org에서 tool은 필수가 아니므로, 모르면 넣지 않는 편이 정확하다.
   */
  tools?: string[]
) => {
  const schemaLanguage = getSchemaLanguage(locale);
  const toolNames = (tools ?? []).map((tool) => tool.trim()).filter((tool) => tool.length > 0);

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
    ...(toolNames.length > 0 && {
      tool: toolNames.map((toolName) => ({ '@type': 'HowToTool', name: toolName })),
    }),
  };
};
