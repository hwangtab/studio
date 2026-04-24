const fs = require('node:fs');
const path = require('node:path');

/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://studionol.co.kr').replace(/\/+$/, '');
const buildTimestamp = new Date().toISOString();
const storiesDir = path.join(process.cwd(), 'content', 'stories');
const portfolioDataFile = path.join(process.cwd(), 'data', 'portfolio.ts');
const localePageDir = path.join(process.cwd(), 'pages', '[locale]');

// Map of page paths to their representative OG images
// title/caption은 Google Image Search용 메타. Studio NOL 브랜드+페이지 주제를 포함.
const pageImageMap = {
  '/about': { url: '/images/recording15.webp', title: 'Studio NOL - 10-Year Music Production Experience', caption: 'Recording studio in Yeonsinnae, Eunpyeong-gu, Seoul with professional engineers.' },
  '/contact': { url: '/images/hardware5.webp', title: 'Studio NOL Contact - Book Recording Session', caption: 'Reach Studio NOL for recording, mixing, voiceover, and wedding song production.' },
  '/index': { url: '/images/og-default.webp', title: 'Studio NOL - Seoul Music Production Studio', caption: 'Yeonsinnae Studio NOL: recording, mixing, mastering, voiceover, wedding song.' },
  '/lesson': { url: '/images/lesson1.webp', title: 'Studio NOL Music Lessons - Vocal & Production', caption: 'One-on-one vocal, mixing, and music production lessons at Studio NOL.' },
  '/portfolio': { url: '/images/recording1.webp', title: 'Studio NOL Portfolio - Recording & Mixing Works', caption: 'Albums, singles, and commercial works produced at Studio NOL.' },
  '/practice-room': { url: '/images/room5.webp', title: 'Studio NOL Premium Practice Room - Soundproof Residency', caption: 'Soundproof premium practice room with monthly residency in Eunpyeong-gu, Seoul.' },
  '/pricing': { url: '/images/hardware2.webp', title: 'Studio NOL Pricing - Transparent Recording Fees', caption: 'Studio NOL pricing: practice room ₩20K/hr, wedding vocal ₩150K, voiceover ₩30K/hr.' },
  '/stories': { url: '/images/studio1.webp', title: 'Studio NOL Stories - Mixing & Recording Guides', caption: 'Production guides, engineering tutorials, and studio stories by Studio NOL.' },
  '/studio-info': { url: '/images/hardware1.webp', title: 'Studio NOL Equipment - Analog Gear & Neumann Mics', caption: 'Studio NOL gear list: Neumann microphones, analog outboard, pro DAW setup.' },
  '/wedding-song': { url: '/images/recording3.webp', title: 'Studio NOL Wedding Song Package - ₩150K+', caption: 'Wedding vocal package at Studio NOL: pro recording, mix, and editing.' },
  '/voice-acting': { url: '/images/hardware3.webp', title: 'Studio NOL Voiceover Recording - ₩30K/hr', caption: 'Professional voiceover recording at Studio NOL, Yeonsinnae.' },
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

const getStoryTitle = (slug, locale) => {
  const candidates = [
    path.join(storiesDir, `${slug}.${locale}.md`),
    path.join(storiesDir, `${slug}.md`),
  ];
  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^title:\s*"?([^"\n]+)"?/m);
      if (match && match[1]) return match[1].trim();
    } catch { /* next */ }
  }
  return slug;
};

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];

// Google 공식 hreflang 코드 매핑 — lib/hreflang.json 단일 소스
const hreflangByLocale = require('./lib/hreflang.json');

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
  '/wedding-song': 'wedding-song.tsx',
  '/voice-acting': 'voice-acting.tsx',
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

const getStoryCategory = (slug, locale) => {
  const candidates = [
    path.join(storiesDir, `${slug}.${locale}.md`),
    path.join(storiesDir, `${slug}.md`),
  ];
  for (const filePath of candidates) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = content.match(/^category:\s*['"]?([^\s'"]+)['"]?/m);
      if (match && match[1]) return match[1].trim();
    } catch { /* next */ }
  }
  return null;
};

/**
 * Thin-content quality gate for sitemap inclusion.
 * Mirrors the logic in lib/stories.ts:343 (threshold 1500).
 * Returns true if the story should be excluded from the sitemap.
 */
const THIN_CONTENT_THRESHOLD = 1500;
const SHORTCODE_CHAR_ESTIMATES = {
  'online-fallback': 120,
  'session-checklist': 420,
};

const isStoryThin = (slug, locale) => {
  const candidates = [
    path.join(storiesDir, `${slug}.${locale}.md`),
    path.join(storiesDir, `${slug}.md`),
  ];
  for (const filePath of candidates) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      // Strip YAML frontmatter to get pure content
      const contentMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/m);
      if (!contentMatch) return true; // malformed → exclude
      const frontmatter = contentMatch[1] || '';
      const content = contentMatch[2] || '';
      // Exclude pages explicitly marked noindex (e.g., promotional event pages)
      if (/^robots:\s*['"]?[^'"\n]*noindex/mi.test(frontmatter)) return true;
      const rawNonWhitespace = content.replace(/\s+/g, '').length;
      const shortcodeBonus = [...content.matchAll(/%%([a-z-]+)%%/g)]
        .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? 80), 0);
      return (rawNonWhitespace + shortcodeBonus) < THIN_CONTENT_THRESHOLD;
    } catch {
      // File not found — fall through to next candidate
    }
  }
  return true; // no file found → exclude
};

/**
 * Check if a portfolio item is thin for a given locale.
 * Returns true when the item has no productionNotes at all, OR the requested
 * locale lacks a native productionNotes entry. Fallback-rendered pages emit
 * `noindex` at runtime, so excluding them from the sitemap avoids pointing
 * Google at URLs that will only waste crawl budget.
 */
const isPortfolioThin = (itemId, locale = 'ko') => {
  try {
    const content = fs.readFileSync(portfolioDataFile, 'utf8');
    const idMarker = `"id": "${itemId}"`;
    const start = content.indexOf(idMarker);
    if (start < 0) return true;

    const rest = content.slice(start + idMarker.length);
    const nextIdRelative = rest.search(/"id":\s*"/);
    const blockEnd = nextIdRelative >= 0 ? start + idMarker.length + nextIdRelative : content.length;
    const block = content.slice(start, blockEnd);

    if (!block.includes('productionNotes')) return true;

    const pnStart = block.indexOf('"productionNotes"');
    if (pnStart < 0) return true;
    const braceOpen = block.indexOf('{', pnStart);
    if (braceOpen < 0) return true;
    let depth = 0;
    let braceClose = -1;
    for (let i = braceOpen; i < block.length; i++) {
      if (block[i] === '{') depth++;
      else if (block[i] === '}') { depth--; if (depth === 0) { braceClose = i; break; } }
    }
    if (braceClose < 0) return true;
    const pnBlock = block.slice(braceOpen, braceClose + 1);
    return !new RegExp(`"${locale}"\\s*:`).test(pnBlock);
  } catch {
    return true;
  }
};

// 카테고리별 최신 스토리 mtime을 계산 — buildTimestamp 고정으로 인한 freshness 신호 왜곡 방지
const getCategoryLastmod = (categoryKey, slugs, locale) => {
  const mtimes = [];
  for (const slug of slugs) {
    if (getStoryCategory(slug, locale) === categoryKey) {
      const mtime = getStoryLastmod(slug, locale);
      if (mtime) mtimes.push(mtime);
    }
  }
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
    hreflang: hreflangByLocale[locale],
    hrefIsAbsolute: true,
  }));
  refs.push({
    href: `${siteUrl}/ko${restPath ? `/${restPath}` : ''}`,
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
  exclude: ['/api/*', '/404', '/500', '/', '/*/privacy-policy'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: ['/', '/api/rss'], disallow: ['/api/'] },
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
    transformRobotsTxt: async (_config, robotsTxt) => {
      const cleaned = robotsTxt.replace(/# Host[\r\n]+Host:[^\r\n]*[\r\n]*/g, '');
      const llmsHint = `\n# LLM / AI content index\n# llms.txt: ${siteUrl}/llms.txt\n# llms-full.txt: ${siteUrl}/llms-full.txt\n`;
      return `Host: ${siteUrl}\n${cleaned}${llmsHint}`;
    },
  },
  sitemapSize: 50000,
  additionalPaths: async (config) => {
    const files = fs.readdirSync(storiesDir);
    const slugs = new Set();
    files.forEach((file) => {
      if (!file.endsWith('.md')) return;
      let name = file.replace(/\.md$/, '');
      locales.forEach((locale) => {
        if (name.endsWith(`.${locale}`)) {
          name = name.replace(new RegExp(`\\.${locale}$`), '');
        }
      });
      slugs.add(name);
    });

    const results = [];
    const slugList = Array.from(slugs);

    // Story category hub pages — keep in sync with pages/[locale]/stories/category/[key].tsx
    const storyCategoryKeys = ['instrument', 'region', 'lesson', 'production', 'recording', 'vocal', 'feedback', 'mixing', 'business', 'event'];
    for (const locale of locales) {
      for (const key of storyCategoryKeys) {
        const routePath = `/${locale}/stories/category/${key}`;
        results.push({
          loc: routePath,
          lastmod: getCategoryLastmod(key, slugList, locale) || buildTimestamp,
          changefreq: 'weekly',
          priority: 0.7,
          alternateRefs: getAlternateRefs(routePath),
        });
      }
    }
    for (const slug of slugs) {
      for (const locale of locales) {
        // Skip if no locale-specific file exists for this locale (would be noindexed fallback)
        if (locale !== 'ko') {
          const localeFilePath = path.join(storiesDir, `${slug}.${locale}.md`);
          if (!fs.existsSync(localeFilePath)) continue;
        }
        // Thin-content quality gate: exclude from sitemap if content < 1500 chars
        if (isStoryThin(slug, locale)) continue;

        const routePath = `/${locale}/stories/${slug}`;
        const thumbnail = getStoryThumbnail(slug, locale);
        let images = [];
        if (thumbnail) {
          const imageUrl = thumbnail.startsWith('http') ? thumbnail : `${siteUrl}${thumbnail.startsWith('/') ? thumbnail : '/' + thumbnail}`;
          const title = getStoryTitle(slug, locale);
          images = [{ loc: new URL(imageUrl), title, caption: title, geoLocation: 'Seoul, Eunpyeong-gu, South Korea' }];
        }
        results.push({
          loc: routePath,
          lastmod: getStoryLastmod(slug, locale) || new Date().toISOString(),
          changefreq: 'weekly',
          priority: 0.8,
          alternateRefs: getAlternateRefs(routePath),
          ...(images.length > 0 && { images }),
        });
      }
    }
    return results;
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
        const title = getStoryTitle(slug, locale);
        images = [{ loc: new URL(imageUrl), title, caption: title, geoLocation: 'Seoul, Eunpyeong-gu, South Korea' }];
      }
    } else if (pathWithoutLocale.startsWith('/portfolio/') && segments.length >= 3) {
      const itemId = segments[2];
      const portfolioImages = getPortfolioImageMap();
      const imgUrl = portfolioImages[itemId];
      if (imgUrl) {
        images = [{ loc: new URL(imgUrl.startsWith('http') ? imgUrl : `${siteUrl}${imgUrl}`), geoLocation: 'Seoul, Eunpyeong-gu, South Korea' }];
      }
    } else {
      const pageKey = pathWithoutLocale === '/index' ? '/index' : pathWithoutLocale;
      const pageImg = pageImageMap[pageKey];
      if (pageImg) {
        images = [{
          loc: new URL(`${siteUrl}${pageImg.url}`),
          title: pageImg.title,
          caption: pageImg.caption,
          geoLocation: 'Seoul, Eunpyeong-gu, South Korea',
        }];
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

    if (routePath.includes('/portfolio/')) {
      // Thin-content gate: exclude portfolio pages when productionNotes are missing
      // for this specific locale. Pages fall back to en/ko at runtime but carry
      // `noindex`, so keeping them out of the sitemap is the correct signal.
      if (segments.length >= 3) {
        const itemId = segments[2];
        if (isPortfolioThin(itemId, locale)) {
          return null;
        }
      }
      return {
        ...entry,
        changefreq: 'weekly',
        priority: 0.9,
      };
    }

    if (routePath.includes('/stories/')) {
      // Thin-content gate: already filtered in additionalPaths, but defensive check for transform
      if (segments.length >= 3) {
        const slug = segments[2];
        if (isStoryThin(slug, locale)) {
          return null;
        }
      }
      return {
        ...entry,
        changefreq: 'weekly',
        priority: 0.8,
      };
    }

    if (routePath.match(/\/(pricing|contact|studio-info|practice-room|wedding-song|voice-acting|lesson)(\/|$)/)) {
      return { ...entry, priority: 0.9 };
    }

    if (routePath.match(/\/(about|portfolio|stories)(\/|$)/) && !routePath.includes('/stories/') && !routePath.includes('/portfolio/')) {
      return { ...entry, priority: 0.8 };
    }

    return entry;
  },
};
