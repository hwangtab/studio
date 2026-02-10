import { useTranslation } from 'react-i18next';
import Head from 'next/head';
import React from 'react';
import { useRouter } from 'next/router';
import { Breadcrumb, FAQItem, ReviewItem } from '../types/data';
import {
  generateDefaultSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
  generateCourseSchema,
  generateWebSiteSchema,
} from '../utils/schemaGenerator';
import { locales, type Locale } from '../lib/i18n';
import { getSeoDefaults, getSiteConfig } from '../data/siteConfig';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  includeSchema?: boolean;
  schema?: Record<string, unknown> | Record<string, unknown>[];
  author?: string;
  robots?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  articleSection?: string;
  breadcrumbs?: Breadcrumb[] | null;
  faqItems?: FAQItem[] | null;
  reviewItems?: ReviewItem[] | null;
  isCourse?: boolean;
}

const SEO = ({
  title,
  description,
  keywords,
  canonical,
  ogImage = '/images/hardware2.jpg',
  ogType = 'website',
  includeSchema = false,
  schema,
  author,
  robots = 'index, follow',
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
  breadcrumbs = null,
  faqItems = null,
  reviewItems = null,
  isCourse = false,
}: SEOProps) => {
  const router = useRouter();

  const currentPath = router.asPath.split('?')[0];
  const segments = currentPath.split('/');
  let pathWithoutLocale = currentPath;
  let currentLocale: Locale = 'ko';

  if (locales.includes(segments[1] as Locale)) {
    currentLocale = segments[1] as Locale;
    pathWithoutLocale = '/' + segments.slice(2).join('/');
  }

  const { t } = useTranslation('common', { lng: currentLocale });
  const siteConfig = getSiteConfig(currentLocale);
  const siteUrl = siteConfig.url;
  const seoDefaults = getSeoDefaults(currentLocale);

  // Clean up double slashes if any (e.g. root path)
  if (pathWithoutLocale === '//') pathWithoutLocale = '/';

  const toAbsoluteUrl = (value = '') => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const sanitized = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    return `${siteUrl}${sanitized}`;
  };

  const resolvedTitle = title || seoDefaults.title;
  const resolvedDescription = description || seoDefaults.description;
  const resolvedKeywords = keywords || seoDefaults.keywords;
  const resolvedAuthor = author || siteConfig.name;

  const absoluteOgImage = toAbsoluteUrl(ogImage);

  // Use provided canonical or generate one based on current path
  const derivedCanonical = canonical || `${siteUrl}${currentPath}`;
  const canonicalUrl = toAbsoluteUrl(derivedCanonical);

  const normalizedCanonical =
    canonicalUrl.endsWith('/') && canonicalUrl !== `${siteUrl}/`
      ? canonicalUrl.slice(0, -1)
      : canonicalUrl;

  const defaultSchema = React.useMemo(
    () => generateDefaultSchema(siteUrl, absoluteOgImage, resolvedDescription, reviewItems, currentLocale),
    [siteUrl, absoluteOgImage, resolvedDescription, reviewItems, currentLocale]
  );

  const websiteSchema = React.useMemo(
    () => generateWebSiteSchema(siteUrl, currentLocale),
    [siteUrl, currentLocale]
  );

  const articleSchema = React.useMemo(
    () =>
      ogType === 'article'
        ? generateArticleSchema(
          resolvedTitle,
          resolvedDescription,
          siteUrl,
          absoluteOgImage,
          normalizedCanonical,
          articlePublishedTime,
          articleModifiedTime,
          articleAuthor,
          currentLocale
        )
        : null,
    [
      ogType,
      resolvedTitle,
      resolvedDescription,
      siteUrl,
      absoluteOgImage,
      normalizedCanonical,
      articlePublishedTime,
      articleModifiedTime,
      articleAuthor,
      currentLocale,
    ]
  );

  const courseSchema = React.useMemo(
    () =>
      isCourse
        ? generateCourseSchema(
          resolvedTitle,
          resolvedDescription,
          siteUrl,
          absoluteOgImage,
          normalizedCanonical,
          currentLocale
        )
        : null,
    [isCourse, resolvedTitle, resolvedDescription, siteUrl, absoluteOgImage, normalizedCanonical, currentLocale]
  );

  const breadcrumbSchema = React.useMemo(
    () => generateBreadcrumbSchema(breadcrumbs, siteUrl),
    [breadcrumbs, siteUrl]
  );

  const faqSchema = React.useMemo(() => generateFaqSchema(faqItems, currentLocale), [faqItems, currentLocale]);

  const schemaItems = React.useMemo(() => {
    const items: Record<string, unknown>[] = [];

    const addItems = (input: unknown) => {
      if (!input) return;
      if (Array.isArray(input)) {
        input.forEach(addItems);
      } else if (typeof input === 'object' && input !== null && '@graph' in input && Array.isArray((input as Record<string, unknown>)['@graph'])) {
        ((input as Record<string, unknown>)['@graph'] as unknown[]).forEach(addItems);
      } else if (typeof input === 'object' && input !== null) {
        items.push(input as Record<string, unknown>);
      }
    };

    addItems(defaultSchema);
    addItems(websiteSchema);
    addItems(articleSchema);
    addItems(courseSchema);
    addItems(schema);

    return items.filter(Boolean);
  }, [defaultSchema, websiteSchema, articleSchema, courseSchema, schema]);

  const schemaData = React.useMemo(() => {
    if (schemaItems.length === 0) return null;
    if (schemaItems.length === 1) return schemaItems[0];
    return {
      '@context': 'https://schema.org',
      '@graph': schemaItems.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const { ['@context']: _context, ...rest } = item;
        return rest;
      }),
    };
  }, [schemaItems]);

  // Map locale codes to Open Graph locale format (e.g. ko -> ko_KR)
  const ogLocaleMap: Record<string, string> = {
    ko: 'ko_KR',
    en: 'en_US',
    zh: 'zh_CN',
    es: 'es_ES',
    vi: 'vi_VN',
    th: 'th_TH',
    uz: 'uz_UZ',
  };

  const finalSchema = React.useMemo(() => {
    if (!includeSchema || !schemaData) return null;

    // Initialize with existing schema items
    const items = [...schemaItems];

    // Add breadcrumb and FAQ to graph if they aren't already there
    if (breadcrumbSchema) {
      const { ['@context']: _, ...rest } = breadcrumbSchema as Record<string, unknown>;
      items.push(rest);
    }
    if (faqSchema) {
      const { ['@context']: _, ...rest } = faqSchema as Record<string, unknown>;
      items.push(rest);
    }

    if (items.length === 1 && !breadcrumbSchema && !faqSchema) return schemaData;

    return {
      '@context': 'https://schema.org',
      '@graph': items.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const { ['@context']: _context, ...rest } = item;
        return rest;
      }),
    };
  }, [includeSchema, schemaData, schemaItems, breadcrumbSchema, faqSchema]);

  const renderSchema = React.useCallback((data: Record<string, unknown> | null) => {
    if (!data) return null;
    let jsonString = '';
    try {
      if (typeof data === 'string') {
        JSON.parse(data);
        jsonString = data;
      } else {
        jsonString = JSON.stringify(data);
      }
    } catch (e) {
      console.error('Schema parsing error:', e);
      return null;
    }

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonString }}
      />
    );
  }, []);

  return (
    <Head>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="keywords" content={resolvedKeywords} />
      <meta name="author" content={resolvedAuthor} />
      <meta name="robots" content={robots} />

      <meta name="geo.region" content="KR-11" />
      <meta name="geo.placename" content={t('seo.geoPlacename')} />
      <meta name="geo.position" content="37.614353;126.925887" />
      <meta name="ICBM" content="37.614353, 126.925887" />

      <link rel="canonical" href={normalizedCanonical} />

      {/* Hreflang tags for SEO */}
      {locales.map((locale) => (
        <link
          key={`hreflang-${locale}`}
          rel="alternate"
          hrefLang={locale}
          href={`${siteUrl}/${locale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`}
        />
      ))}
      {/* Default fallback (x-default) usually points to the default language or a language selector page. 
          Here pointing to Korean version as default. */}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${siteUrl}/ko${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`}
      />

      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={normalizedCanonical} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:alt" content="Studio NOL - Music Production Studio" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content={ogLocaleMap[currentLocale] || 'ko_KR'} />
      <meta property="og:site_name" content="Studio NOL" />

      {/* Alternate locales in OG */}
      {locales.filter(l => l !== currentLocale).map(locale => (
        <meta key={`og-locale-alt-${locale}`} property="og:locale:alternate" content={ogLocaleMap[locale]} />
      ))}

      {ogType === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {ogType === 'article' && articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}
      {ogType === 'article' && articleAuthor && (
        <meta property="article:author" content={articleAuthor} />
      )}
      {ogType === 'article' && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={normalizedCanonical} />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content="Studio NOL" />
      <meta name="twitter:site" content="@StudioNOL" />
      {articleAuthor && <meta name="twitter:creator" content={articleAuthor} />}

      {renderSchema(finalSchema)}
    </Head>
  );
};

export default SEO;
