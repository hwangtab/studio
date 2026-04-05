const fs = require('node:fs');
const path = require('node:path');

/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const buildTimestamp = new Date().toISOString();
const storiesDir = path.join(process.cwd(), 'content', 'stories');
const portfolioDataFile = path.join(process.cwd(), 'data', 'portfolio.ts');
const localePageDir = path.join(process.cwd(), 'pages', '[locale]');

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];

const toIsoMtime = (filePath) => {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
};

const pageRouteMap = {
  '/about': 'about.tsx',
  '/contact': 'contact.tsx',
  '/index': 'index.tsx',
  '/lesson': 'lesson.tsx',
  '/portfolio': 'portfolio.tsx',
  '/practice-room': 'practice-room.tsx',
  '/pricing': 'pricing.tsx',
  '/privacy-policy': 'privacy-policy.tsx',
  '/stories': path.join('stories', 'index.tsx'),
  '/studio-info': 'studio-info.tsx',
};

const getStoryLastmod = (slug, locale) => {
  const candidates = [
    path.join(storiesDir, `${slug}.${locale}.md`),
    path.join(storiesDir, `${slug}.md`),
  ];
  const mtimes = candidates.map(toIsoMtime).filter(Boolean);
  if (mtimes.length === 0) return null;
  return mtimes.sort().at(-1);
};

const getAlternateRefs = (routePath) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) return [];
  const firstSegment = segments[0];
  if (!locales.includes(firstSegment)) return [];
  const restPath = segments.slice(1).join('/');
  const refs = locales.map(locale => ({
    href: `${siteUrl}/${locale}${restPath ? `/${restPath}` : ''}`,
    hreflang: locale,
    hrefIsAbsolute: true,
  }));
  refs.push({
    href: `${siteUrl}/en${restPath ? `/${restPath}` : ''}`,
    hreflang: 'x-default',
    hrefIsAbsolute: true,
  });
  return refs;
};

const getRouteLastmod = (routePath) => {
  const segments = routePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return toIsoMtime(path.join(localePageDir, 'index.tsx')) || buildTimestamp;
  }

  const maybeLocale = segments[0];
  const pathWithoutLocale = locales.includes(maybeLocale) ? `/${segments.slice(1).join('/') || 'index'}` : routePath;

  if (pathWithoutLocale.startsWith('/stories/')) {
    const slug = pathWithoutLocale.split('/')[2];
    if (slug) {
      const locale = locales.includes(maybeLocale) ? maybeLocale : 'ko';
      return getStoryLastmod(slug, locale) || buildTimestamp;
    }
  }

  if (pathWithoutLocale.startsWith('/portfolio/')) {
    return toIsoMtime(portfolioDataFile) || buildTimestamp;
  }

  const pageFile = pageRouteMap[pathWithoutLocale];
  if (pageFile) {
    return toIsoMtime(path.join(localePageDir, pageFile)) || buildTimestamp;
  }

  return buildTimestamp;
};

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  autoLastmod: false,
  alternateRefs: [],
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/api/*', '/404', '/500', '/'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: '/api/' },
      { userAgent: 'Yeti', allow: '/' },
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
    ],
    additionalSitemaps: [],
    transformRobotsTxt: async (_config, robotsTxt) =>
      robotsTxt.replace(/# Host\nHost:.*\n/g, ''),
  },
  transform: async (config, routePath) => {
    if (routePath.includes('/privacy-policy')) {
      return null;
    }

    const entry = {
      loc: routePath,
      lastmod: getRouteLastmod(routePath),
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: getAlternateRefs(routePath),
    };

    if (routePath === '/' || routePath.match(/^\/[a-z]{2}$/)) {
      return {
        ...entry,
        changefreq: 'daily',
        priority: 1.0,
      };
    }

    if (routePath.includes('/stories/') || routePath.includes('/portfolio/')) {
      return {
        ...entry,
        changefreq: 'weekly',
        priority: 0.8,
      };
    }

    if (routePath.match(/\/(pricing|contact)(\/|$)/)) {
      return { ...entry, priority: 0.9 };
    }

    if (routePath.match(/\/(about|studio-info|lesson|practice-room|portfolio|stories)(\/|$)/) && !routePath.includes('/stories/') && !routePath.includes('/portfolio/')) {
      return { ...entry, priority: 0.8 };
    }

    return entry;
  },
};
