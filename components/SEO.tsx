import Head from 'next/head';
import React from 'react';
import { Breadcrumb, FAQItem, ReviewItem } from '../types/data';
import {
  generateDefaultSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFaqSchema,
  generateCourseSchema,
} from '../utils/schemaGenerator';

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
  title = '스튜디오 놀 - 음악 제작의 모든 것',
  description = '최고의 사운드를 위한 음악 제작 스튜디오, 스튜디오 놀. 전문적인 믹싱, 마스터링, 레코딩 서비스로 당신의 음악을 완성하세요.',
  keywords = '스튜디오 놀, 음악 제작, 레코딩, 믹싱, 마스터링, 음반 제작, 음악 프로듀싱, 연신내 스튜디오, 서울 녹음 스튜디오',
  canonical = 'https://studionol.co.kr/',
  ogImage = '/images/hardware2.jpg',
  ogType = 'website',
  includeSchema = false,
  schema,
  author = '스튜디오 놀',
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
  const siteUrl = 'https://studionol.co.kr';

  const toAbsoluteUrl = React.useCallback((value = '') => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return value;
    }
    const sanitized = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
    return `${siteUrl}${sanitized}`;
  }, [siteUrl]);

  const absoluteOgImage = React.useMemo(() => toAbsoluteUrl(ogImage), [ogImage, toAbsoluteUrl]);

  const canonicalUrl = React.useMemo(() => toAbsoluteUrl(canonical), [canonical, toAbsoluteUrl]);
  const normalizedCanonical = React.useMemo(() =>
    canonicalUrl.endsWith('/') && canonicalUrl !== `${siteUrl}/`
      ? canonicalUrl.slice(0, -1)
      : canonicalUrl,
    [canonicalUrl, siteUrl]);

  const defaultSchema = React.useMemo(
    () => generateDefaultSchema(siteUrl, absoluteOgImage, description, reviewItems),
    [siteUrl, absoluteOgImage, description, reviewItems]
  );

  const articleSchema = React.useMemo(
    () =>
      ogType === 'article'
        ? generateArticleSchema(
          title,
          description,
          siteUrl,
          absoluteOgImage,
          normalizedCanonical,
          articlePublishedTime,
          articleModifiedTime,
          articleAuthor
        )
        : null,
    [
      ogType,
      title,
      description,
      siteUrl,
      absoluteOgImage,
      normalizedCanonical,
      articlePublishedTime,
      articleModifiedTime,
      articleAuthor,
    ]
  );

  const courseSchema = React.useMemo(
    () =>
      isCourse
        ? generateCourseSchema(
          title,
          description,
          siteUrl,
          absoluteOgImage,
          normalizedCanonical
        )
        : null,
    [isCourse, title, description, siteUrl, absoluteOgImage, normalizedCanonical]
  );

  const breadcrumbSchema = React.useMemo(
    () => generateBreadcrumbSchema(breadcrumbs, siteUrl),
    [breadcrumbs, siteUrl]
  );

  const faqSchema = React.useMemo(() => generateFaqSchema(faqItems), [faqItems]);

  const schemaData = schema || courseSchema || articleSchema || defaultSchema;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content={robots} />

      <meta name="geo.region" content="KR-11" />
      <meta name="geo.placename" content="서울특별시 은평구" />
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

      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={normalizedCanonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteOgImage} />
      <meta property="og:image:alt" content="스튜디오 놀 - 음악 제작 스튜디오" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="ko_KR" />
      <meta property="og:site_name" content="스튜디오 놀" />
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
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteOgImage} />
      <meta name="twitter:image:alt" content="스튜디오 놀 - 음악 제작 스튜디오" />
      {articleAuthor && <meta name="twitter:creator" content={articleAuthor} />}

      {includeSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }} />
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      )}
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
    </Head>
  );
};

export default SEO;

