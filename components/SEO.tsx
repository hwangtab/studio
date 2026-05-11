import { useTranslation } from 'react-i18next';
import Head from 'next/head';
import React from 'react';
import { useRouter } from 'next/router';
import { Breadcrumb, FAQItem } from '../types/data';
import {
  generateDefaultSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
  generateCourseSchema,
  generateWebSiteSchema,
  generateWebPageSchema,
} from '../utils/schemaGenerator';
import { defaultLocale, hreflangByLocale, locales, ogLocaleByLocale, type Locale } from '../lib/i18n-config';
import { getSeoDefaults, getSiteConfig, socialProfiles } from '../data/siteConfig';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  disableCanonicalAndAlternates?: boolean;
  disableAlternates?: boolean;
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogType?: string;
  includeSchema?: boolean;
  schema?: Record<string, unknown> | Record<string, unknown>[];
  author?: string;
  robots?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  articleSection?: string;
  articleSchemaType?: 'Article' | 'BlogPosting';
  articleTags?: string[];
  articleWordCount?: number;
  breadcrumbs?: Breadcrumb[] | null;
  faqItems?: FAQItem[] | null;
  isCourse?: boolean;
  webPageType?: string;
  /**
   * Restrict hreflang alternates to this list of locales.
   * Use for pages that exist only in some locales (e.g. a story with native translations
   * only for ko/en) to avoid pointing Google at fallback-noindex URLs.
   * If omitted, hreflang is emitted for every configured locale.
   */
  availableLocales?: readonly Locale[];
  /**
   * Authoritative locale for this page. When provided, the component uses this
   * value directly instead of deriving the locale from `router.asPath`, which
   * is unreliable during SSR/SSG (asPath can be empty or fall back to `ko`).
   * Pass the `locale` from page props whenever available.
   */
  locale?: Locale;
}

const SEO = ({
  title,
  description,
  keywords,
  canonical,
  disableCanonicalAndAlternates = false,
  disableAlternates = false,
  ogImage = '/images/og-default.webp',
  ogImageAlt,
  ogImageWidth,
  ogImageHeight,
  ogType = 'website',
  includeSchema = false,
  schema,
  author,
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
  articleSchemaType = 'Article',
  articleTags,
  articleWordCount,
  breadcrumbs = null,
  faqItems = null,
  isCourse = false,
  webPageType,
  availableLocales,
  locale,
}: SEOProps) => {
  const router = useRouter();

  const currentPath = router.asPath.split('?')[0].split('#')[0];
  const segments = currentPath.split('/');
  let pathWithoutLocale = currentPath;
  // 우선순위: 명시된 locale prop > URL prefix 추출 > defaultLocale 폴백.
  // SSR/SSG 시 router.asPath가 비거나 잘못된 값으로 들어올 수 있어 prop 제공이 권장.
  let currentLocale: Locale = locale ?? defaultLocale;

  if (locales.includes(segments[1] as Locale)) {
    if (!locale) {
      currentLocale = segments[1] as Locale;
    }
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

  // og-default.webp는 1200x630으로 고정 생성. 페이지가 width/height를 명시하지 않았을 때
  // 소셜 크롤러가 aspect를 재협상하지 않도록 기본값을 자동 주입.
  const isDefaultOgImage = ogImage === '/images/og-default.webp';
  const effectiveOgImageWidth = ogImageWidth ?? (isDefaultOgImage ? 1200 : undefined);
  const effectiveOgImageHeight = ogImageHeight ?? (isDefaultOgImage ? 630 : undefined);

  const ogImageMimeType = React.useMemo(() => {
    // @vercel/og API routes return PNG by default
    if (ogImage.includes('/api/og/')) return 'image/png';
    // query(?...)·fragment(#...) 모두 제거한 뒤 확장자 추출
    const ext = ogImage.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase();
    if (ext === 'webp') return 'image/webp';
    if (ext === 'avif') return 'image/avif';
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    return 'image/jpeg';
  }, [ogImage]);

  // Use provided canonical or generate one based on current path
  const derivedCanonical = canonical || `${siteUrl}${currentPath}`;
  const canonicalUrl = toAbsoluteUrl(derivedCanonical);
  const shouldRenderAlternates = !disableCanonicalAndAlternates && !disableAlternates;

  const normalizedCanonical =
    canonicalUrl.endsWith('/') && canonicalUrl !== `${siteUrl}/`
      ? canonicalUrl.slice(0, -1)
      : canonicalUrl;

  const defaultSchema = React.useMemo(
    () => generateDefaultSchema(siteUrl, currentLocale),
    [siteUrl, currentLocale]
  );

  const websiteSchema = React.useMemo(
    () => generateWebSiteSchema(siteUrl, currentLocale),
    [siteUrl, currentLocale]
  );

  const webPageSchema = React.useMemo(
    () =>
      includeSchema
        ? generateWebPageSchema(
          resolvedTitle,
          resolvedDescription,
          siteUrl,
          normalizedCanonical,
          currentLocale,
          ogType === 'article' ? `${normalizedCanonical}#article` : undefined,
          Boolean(breadcrumbs && breadcrumbs.length > 0),
          absoluteOgImage || undefined,
          webPageType
        )
        : null,
    [includeSchema, resolvedTitle, resolvedDescription, siteUrl, normalizedCanonical, currentLocale, ogType, breadcrumbs, absoluteOgImage, webPageType]
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
          currentLocale,
          articleSchemaType,
          articleSection,
          articleTags,
          articleWordCount,
          ogImageWidth,
          ogImageHeight
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
      articleSchemaType,
      articleSection,
      articleTags,
      articleWordCount,
      ogImageWidth,
      ogImageHeight,
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
    () => generateBreadcrumbSchema(breadcrumbs, siteUrl, normalizedCanonical),
    [breadcrumbs, siteUrl, normalizedCanonical]
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
    addItems(webPageSchema);
    addItems(articleSchema);
    addItems(courseSchema);
    addItems(schema);

    return items.filter(Boolean);
  }, [defaultSchema, websiteSchema, webPageSchema, articleSchema, courseSchema, schema]);

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

  const finalSchema = React.useMemo(() => {
    if (!includeSchema) return null;

    const extraItems: Record<string, unknown>[] = [];
    if (breadcrumbSchema) {
      const { ['@context']: _, ...rest } = breadcrumbSchema as Record<string, unknown>;
      extraItems.push(rest);
    }
    if (faqSchema) {
      const { ['@context']: _, ...rest } = faqSchema as Record<string, unknown>;
      extraItems.push(rest);
    }

    if (!schemaData && extraItems.length === 0) return null;

    const items = [...(schemaData ? schemaItems : []), ...extraItems];

    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

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
      jsonString = JSON.stringify(data).replace(/<\//g, '<\\/');
    } catch (e) {
      console.error('Schema serialization error:', e);
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

      {/* geo meta는 ko locale에서만 emit — 다른 locale URL에 KR-11을 박으면 다국어 SERP가
          잘못된 region targeting을 받아 외국 시장 노출이 약해진다. ICBM/geo.position은
          LocalBusiness JSON-LD에 동일 좌표가 있어 정보 누락 위험 없음. */}
      {currentLocale === 'ko' && (
        <>
          <meta name="geo.region" content="KR-11" />
          <meta name="geo.placename" content={t('seo.geoPlacename')} />
          <meta name="geo.position" content="37.614353;126.925887" />
          <meta name="ICBM" content="37.614353, 126.925887" />
        </>
      )}

      {/* fallback 페이지에도 canonical은 ko 원본을 향해 emit해야 Google이 색인 통합 신호로
          인식. disableCanonicalAndAlternates는 hreflang만 끄도록 의미 축소. */}
      <link rel="canonical" href={normalizedCanonical} />

      {/* Hreflang tags for SEO.
          Limit to locales that actually have native content to avoid directing Google
          at fallback-noindex pages (e.g. stories without full translations). */}
      {shouldRenderAlternates && (
        locales
          .filter((locale) => !availableLocales || availableLocales.includes(locale))
          .map((locale) => (
            <link
              key={`hreflang-${locale}`}
              rel="alternate"
              hrefLang={hreflangByLocale[locale]}
              href={`${siteUrl}/${locale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`}
            />
          ))
      )}
      {shouldRenderAlternates && (!availableLocales || availableLocales.includes(defaultLocale)) && (
        <link
          rel="alternate"
          hrefLang="x-default"
          href={`${siteUrl}/ko${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`}
        />
      )}

      <meta property="og:type" content={ogType} />
      {!disableCanonicalAndAlternates && <meta property="og:url" content={normalizedCanonical} />}
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={absoluteOgImage} />
      {/* og:image:secure_url은 og:image가 https://면 Facebook이 자동 인식하므로 중복 emit
          불필요. 또한 fallback 페이지 가드 정책과 충돌하는 경계 케이스도 함께 제거. */}
      <meta property="og:image:alt" content={ogImageAlt || resolvedTitle} />
      {typeof effectiveOgImageWidth === 'number' && effectiveOgImageWidth > 0 && (
        <meta property="og:image:width" content={String(effectiveOgImageWidth)} />
      )}
      {typeof effectiveOgImageHeight === 'number' && effectiveOgImageHeight > 0 && (
        <meta property="og:image:height" content={String(effectiveOgImageHeight)} />
      )}
      <meta property="og:image:type" content={ogImageMimeType} />
      <meta property="og:locale" content={ogLocaleByLocale[currentLocale] || ogLocaleByLocale[defaultLocale]} />
      <meta property="og:site_name" content={siteConfig.name} />

      {/* Alternate locales in OG */}
      {locales.filter(l => l !== currentLocale).map(locale => (
        <meta key={`og-locale-alt-${locale}`} property="og:locale:alternate" content={ogLocaleByLocale[locale]} />
      ))}

      {ogType === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {ogType === 'article' && articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}
      {ogType === 'article' && articleModifiedTime && (
        <meta property="og:updated_time" content={articleModifiedTime} />
      )}
      {ogType === 'article' && articleAuthor && (
        <meta property="article:author" content={articleAuthor} />
      )}
      {ogType === 'article' && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}
      {ogType === 'article' && articleTags && articleTags.map((tag) => (
        <meta key={`article-tag-${tag}`} property="article:tag" content={tag} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      {socialProfiles.twitter && <meta name="twitter:site" content={socialProfiles.twitter} />}
      {!disableCanonicalAndAlternates && <meta name="twitter:url" content={normalizedCanonical} />}
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content={ogImageAlt || resolvedTitle} />
      {articleAuthor && <meta name="twitter:creator" content={articleAuthor} />}
      {ogType === 'article' && articleAuthor && (
        <meta name="twitter:label1" content={currentLocale === 'ko' ? '작성자' : 'Written by'} />
      )}
      {ogType === 'article' && articleAuthor && (
        <meta name="twitter:data1" content={articleAuthor} />
      )}
      {ogType === 'article' && articleSection && (
        <meta name="twitter:label2" content={currentLocale === 'ko' ? '카테고리' : 'Category'} />
      )}
      {ogType === 'article' && articleSection && (
        <meta name="twitter:data2" content={articleSection} />
      )}

      {renderSchema(finalSchema)}
    </Head>
  );
};

export default SEO;
