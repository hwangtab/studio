const fs = require('node:fs');
const path = require('node:path');

/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const buildTimestamp = new Date().toISOString();
const storiesDir = path.join(process.cwd(), 'content', 'stories');
const portfolioDataFile = path.join(process.cwd(), 'data', 'portfolio.ts');
const localePageDir = path.join(process.cwd(), 'pages', '[locale]');

// Map of page paths to their representative OG images
const pageImageMap = {
  '/about': '/images/recording15.webp',
  '/contact': '/images/hardware5.webp',
  '/index': '/images/og-default.jpg',
  '/lesson': '/images/lesson1.webp',
  '/portfolio': '/images/recording1.webp',
  '/practice-room': '/images/room5.jpg',
  '/pricing': '/images/hardware2.jpg',
  '/stories': '/images/studio1.jpg',
  '/studio-info': '/images/hardware1.jpg',
};

// Parse portfolio item images from TypeScript source at build time
const getPortfolioImageMap = (() => {
  let cached = null;
  return () => {
    if (cached) return cached;
    try {
      const content = fs.readFileSync(portfolioDataFile, 'utf8');
      const map = {};
      // Match id/image pairs in sequence: "id": "...", then "image": "..."
      const idRegex = /"id":\s*"([^"]+)"/g;
      const imageRegex = /"image":\s*"([^"]+)"/g;
      const ids = [];
      const images = [];
      let m;
      while ((m = idRegex.exec(content)) !== null) ids.push({ index: m.index, id: m[1] });
      while ((m = imageRegex.exec(content)) !== null) images.push({ index: m.index, url: m[1] });
      // For each image, find the most recent id that appears before it
      for (const img of images) {
        const precedingIds = ids.filter(i => i.index < img.index);
        if (precedingIds.length > 0) {
          const closest = precedingIds[precedingIds.length - 1];
          // Skip category ids (all/album/single/compilation/commercial)
          if (!['all', 'album', 'single', 'compilation', 'commercial'].includes(closest.id)) {
            map[closest.id] = img.url;
          }
        }
      }
      cached = map;
      return map;
    } catch {
      return {};
    }
  };
})();

const getStoryThumbnail = (slug, locale) => {
  const candidates = [
    path.join(storiesDir, `${slug}.${locale}.md`),
    path.join(storiesDir, `${slug}.md`),
  ];
  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^---[\s\S]*?^thumbnail:\s*['"]?([^\s'"]+)['"]?/m);
      if (match && match[1]) return match[1];
    } catch {
      // File not found, try next candidate
    }
  }
  return null;
};

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
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
      // Naver
      { userAgent: 'Yeti', allow: '/' },
      // OpenAI
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      // Anthropic
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      // Perplexity
      { userAgent: 'PerplexityBot', allow: '/' },
      // Meta
      { userAgent: 'FacebookBot', allow: '/' },
      // Apple
      { userAgent: 'Applebot', allow: '/' },
    ],
    additionalSitemaps: [],
    transformRobotsTxt: async (_config, robotsTxt) =>
      robotsTxt.replace(/# Host[\r\n]+Host:[^\r\n]*[\r\n]*/g, ''),
  },
  transform: async (config, routePath) => {
    if (routePath.includes('/privacy-policy')) {
      return null;
    }

    const segments = routePath.split('/').filter(Boolean);
    const maybeLocale = segments[0];
    const locale = locales.includes(maybeLocale) ? maybeLocale : 'ko';
    const pathWithoutLocale = locales.includes(maybeLocale) ? `/${segments.slice(1).join('/') || 'index'}` : routePath;

    // Determine image for this route
    let images = [];
    if (pathWithoutLocale.startsWith('/stories/') && segments.length >= 3) {
      const slug = segments[2];
      const thumbnail = getStoryThumbnail(slug, locale);
      if (thumbnail) {
        const imageUrl = thumbnail.startsWith('http') ? thumbnail : `${siteUrl}${thumbnail.startsWith('/') ? thumbnail : '/' + thumbnail}`;
        images = [{ loc: new URL(imageUrl) }];
      }
    } else if (pathWithoutLocale.startsWith('/portfolio/') && segments.length >= 3) {
      const itemId = segments[2];
      const portfolioImages = getPortfolioImageMap();
      const imgUrl = portfolioImages[itemId];
      if (imgUrl) {
        images = [{ loc: new URL(imgUrl.startsWith('http') ? imgUrl : `${siteUrl}${imgUrl}`) }];
      }
    } else {
      const pageKey = pathWithoutLocale === '/index' ? '/index' : pathWithoutLocale;
      const pageImg = pageImageMap[pageKey];
      if (pageImg) {
        images = [{ loc: new URL(`${siteUrl}${pageImg}`) }];
      }
    }

    const entry = {
      loc: routePath,
      lastmod: getRouteLastmod(routePath),
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: getAlternateRefs(routePath),
      ...(images.length > 0 && { images }),
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
