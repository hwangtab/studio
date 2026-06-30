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
} from '../utils/schema';
import { defaultLocale, hreflangByLocale, ogLocaleByLocale, type Locale } from '../lib/i18n-config';
import { getSeoDefaults, getSiteConfig, socialProfiles, studioOperator } from '../data/siteConfig';
import { resolveSeoPathState, resolveSeoUrlState } from './seo/metadataUrls';
import { buildFinalSchemaData, collectSchemaItems, serializeJsonLd } from './seo/schemaData';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  disableUrlMetaAndAlternates?: boolean;
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
  disableUrlMetaAndAlternates = false,
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
  const asPath = router.asPath ?? '';
  const pathState = React.useMemo(
    () => resolveSeoPathState({ asPath, locale }),
    [asPath, locale]
  );
  const currentLocale = pathState.currentLocale;

  const { t } = useTranslation('common', { lng: currentLocale });
  const siteConfig = getSiteConfig(currentLocale);
  const siteUrl = siteConfig.url;
  const seoDefaults = getSeoDefaults(currentLocale);

  // 비-ko locale은 자동 noindex. 90일 GSC: /en·/es·/vi·/th·/uz·/zh 합계 5 clicks /
  // 803 impressions / CTR 0.62%. 검색 트래픽 거의 0인 152개 페이지가 인덱싱 풀에
  // 남아 사이트 전체 품질 시그널을 끌어내려 차단. hreflang은 유지해 ko 페이지의
  // 다국어 alternate 정보는 보존.
  const seoUrlState = React.useMemo(
    () =>
      resolveSeoUrlState({
        asPath,
        siteUrl,
        canonical,
        disableUrlMetaAndAlternates,
        disableAlternates,
        availableLocales,
        locale,
        pathState,
      }),
    [
      asPath,
      siteUrl,
      canonical,
      disableUrlMetaAndAlternates,
      disableAlternates,
      availableLocales,
      locale,
      pathState,
    ]
  );

  const {
    normalizedCanonical,
    shouldRenderAlternates,
    indexableAlternateLocales,
    toAbsoluteUrl,
    alternateHrefFor,
    xDefaultHref,
  } = seoUrlState;
  const effectiveRobots = seoUrlState.effectiveRobots(robots);

  const resolvedTitle = title || seoDefaults.title;
  const resolvedDescription = description || seoDefaults.description;
  const resolvedKeywords = keywords || seoDefaults.keywords;
  // Author 메타는 JSON-LD Author와 일관. 명시적 author prop이 없고 siteConfig.name(조직)
  // fallback이 되는 경우 실제 운영자 이름으로 매핑해 entity 시그널 일관성 유지.
  const resolvedAuthor = author || studioOperator.name;
  // articleAuthor 또한 organization name이면 운영자 Person으로 매핑 — article:author /
  // twitter:creator 등 OG·Twitter 메타가 JSON-LD와 동일 entity 가리키도록.
  const effectiveArticleAuthor =
    !articleAuthor || articleAuthor === siteConfig.name ? studioOperator.name : articleAuthor;

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

  const schemaItems = React.useMemo(
    () => collectSchemaItems([
      defaultSchema,
      websiteSchema,
      webPageSchema,
      articleSchema,
      courseSchema,
      schema,
    ]),
    [defaultSchema, websiteSchema, webPageSchema, articleSchema, courseSchema, schema]
  );

  const finalSchema = React.useMemo(() => {
    return buildFinalSchemaData({
      includeSchema,
      schemaItems,
      breadcrumbSchema,
      faqSchema,
    });
  }, [includeSchema, schemaItems, breadcrumbSchema, faqSchema]);

  const renderSchema = React.useCallback((data: Record<string, unknown> | null) => {
    if (!data) return null;
    let jsonString = '';
    try {
      jsonString = serializeJsonLd(data);
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
      <meta name="robots" content={effectiveRobots} />

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

      {/* rel=canonical은 항상 emit한다(fallback 페이지도 ko 원본을 향해 색인 통합 신호 유지).
          disableUrlMetaAndAlternates는 canonical link가 아니라 og:url·twitter:url·hreflang
          alternates만 끈다 — 이름이 'Canonical'을 끄는 것처럼 오해되던 것을 정정. */}
      <link rel="canonical" href={normalizedCanonical} />

      {/* Hreflang tags for SEO.
          Limit to locales that actually have native content to avoid directing Google
          at fallback-noindex pages (e.g. stories without full translations).
          또한 비-ko locale은 site-wide noindex 상태이므로(SEO 정책 — effectiveRobots 참고)
          hreflang alternate에서도 제외 — Google 가이드: hreflang은 indexable URL만 가리켜야
          모순 시그널이 안 생긴다. */}
      {shouldRenderAlternates && (
        indexableAlternateLocales
          .map((alternateLocale) => {
            const href = alternateHrefFor(alternateLocale);
            if (!href) return null;
            return (
              <link
                key={`hreflang-${alternateLocale}`}
                rel="alternate"
                hrefLang={hreflangByLocale[alternateLocale]}
                href={href}
              />
            );
          })
      )}
      {shouldRenderAlternates && xDefaultHref && (() => {
        // x-default 우선순위:
        // site-wide indexable locale인 ko만 x-default로 발행. non-ko는 noindex라
        // x-default 대상이 되면 hreflang이 비색인 URL을 가리키는 모순 신호가 된다.
        return (
          <link
            rel="alternate"
            hrefLang="x-default"
            href={xDefaultHref}
          />
        );
      })()}

      <meta property="og:type" content={ogType} />
      {!disableUrlMetaAndAlternates && <meta property="og:url" content={normalizedCanonical} />}
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
      {indexableAlternateLocales.filter(alternateLocale => alternateLocale !== currentLocale).map(alternateLocale => (
        <meta key={`og-locale-alt-${alternateLocale}`} property="og:locale:alternate" content={ogLocaleByLocale[alternateLocale]} />
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
      {ogType === 'article' && (
        <meta property="article:author" content={effectiveArticleAuthor} />
      )}
      {ogType === 'article' && articleSection && (
        <meta property="article:section" content={articleSection} />
      )}
      {ogType === 'article' && articleTags && articleTags.map((tag) => (
        <meta key={`article-tag-${tag}`} property="article:tag" content={tag} />
      ))}

      <meta name="twitter:card" content="summary_large_image" />
      {socialProfiles.twitter && <meta name="twitter:site" content={socialProfiles.twitter} />}
      {!disableUrlMetaAndAlternates && <meta name="twitter:url" content={normalizedCanonical} />}
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content={ogImageAlt || resolvedTitle} />
      {ogType === 'article' && (
        <meta name="twitter:creator" content={effectiveArticleAuthor} />
      )}
      {ogType === 'article' && (
        <meta name="twitter:label1" content={currentLocale === 'ko' ? '작성자' : 'Written by'} />
      )}
      {ogType === 'article' && (
        <meta name="twitter:data1" content={effectiveArticleAuthor} />
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
