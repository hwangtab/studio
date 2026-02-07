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
  schema?: any;
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
  const siteUrl = 'https://studionol.co.kr';

  // Determine current locale and path
  const { t } = useTranslation('common');
  // router.asPath includes query params, router.pathname includes placeholders
  // We want the clean path for hreflangs.
  // Assuming pages are at /[locale]/...
  // We need to strip the current locale from the path to append new ones.

  const currentPath = router.asPath.split('?')[0];
  const segments = currentPath.split('/');
  // segments[0] is empty, segments[1] is locale (if valid)
  let pathWithoutLocale = currentPath;
  let currentLocale: Locale = 'ko';

  if (locales.includes(segments[1] as Locale)) {
    currentLocale = segments[1] as Locale;
    pathWithoutLocale = '/' + segments.slice(2).join('/');
  }

  // Clean up double slashes if any (e.g. root path)
  if (pathWithoutLocale === '//') pathWithoutLocale = '/';

  const toAbsoluteUrl = React.useCallback((value = '') => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const sanitized = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    return `${siteUrl}${sanitized}`;
  }, [siteUrl]);

  const seoDefaults = React.useMemo(() => getSeoDefaults(currentLocale), [currentLocale]);
  const siteConfig = React.useMemo(() => getSiteConfig(currentLocale), [currentLocale]);

  const resolvedTitle = title || seoDefaults.title;
  const resolvedDescription = description || seoDefaults.description;
  const resolvedKeywords = keywords || seoDefaults.keywords;
  const resolvedAuthor = author || siteConfig.name;

  const absoluteOgImage = React.useMemo(() => toAbsoluteUrl(ogImage), [ogImage, toAbsoluteUrl]);

  // Use provided canonical or generate one based on current path
  const derivedCanonical = canonical || `${siteUrl}${currentPath}`;
  const canonicalUrl = React.useMemo(() => toAbsoluteUrl(derivedCanonical), [derivedCanonical, toAbsoluteUrl]);

  const normalizedCanonical = React.useMemo(() =>
    canonicalUrl.endsWith('/') && canonicalUrl !== `${siteUrl}/`
      ? canonicalUrl.slice(0, -1)
      : canonicalUrl,
    [canonicalUrl, siteUrl]);

  const defaultSchema = React.useMemo(
    () => generateDefaultSchema(siteUrl, absoluteOgImage, resolvedDescription, reviewItems, currentLocale),
    [siteUrl, absoluteOgImage, resolvedDescription, reviewItems, currentLocale]
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

  const faqSchema = React.useMemo(() => generateFaqSchema(faqItems), [faqItems]);

  const schemaItems = React.useMemo(() => {
    const items: any[] = [];

    const addItems = (input: any) => {
      if (!input) return;
      if (Array.isArray(input)) {
        input.forEach(addItems);
      } else if (input['@graph'] && Array.isArray(input['@graph'])) {
        input['@graph'].forEach(addItems);
      } else {
        items.push(input);
      }
    };

    addItems(defaultSchema);
    addItems(articleSchema);
    addItems(courseSchema);
    addItems(schema);

    return items.filter(Boolean);
  }, [defaultSchema, articleSchema, courseSchema, schema]);

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
      const { ['@context']: _, ...rest } = breadcrumbSchema as any;
      items.push(rest);
    }
    if (faqSchema) {
      const { ['@context']: _, ...rest } = faqSchema as any;
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

  const renderSchema = (data: any) => {
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
  };

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

      <link rel="preconnect" href="https://image.bugsm.co.kr" />
      <link rel="dns-prefetch" href="https://image.bugsm.co.kr" />
      <link rel="preconnect" href="https://img.tumblbug.com" />
      <link rel="dns-prefetch" href="https://img.tumblbug.com" />
      <link rel="preconnect" href="https://is1-ssl.mzstatic.com" />
      <link rel="dns-prefetch" href="https://is1-ssl.mzstatic.com" />
      <link rel="preconnect" href="https://thumb.mt.co.kr" />
      <link rel="dns-prefetch" href="https://thumb.mt.co.kr" />
      <link rel="preconnect" href="https://cdn.imweb.me" />
      <link rel="dns-prefetch" href="https://cdn.imweb.me" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="dns-prefetch" href="https://i.ytimg.com" />

      <link rel="canonical" href={normalizedCanonical} />

      {/* Hreflang tags for SEO */}
      {locales.map((locale) => (
        <link
          key={locale}
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
        <meta key={locale} property="og:locale:alternate" content={ogLocaleMap[locale]} />
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
