const fs = require('node:fs');
const path = require('node:path');

// next-sitemap 설정. 헬퍼 모듈은 lib/sitemap/* 에 분할되어 있다 — 이 파일은
// next-sitemap이 호출하는 entrypoint(robots/transform/additionalPaths)만 보유.

// 카테고리 키 단일 소스는 lib/storyCategoryKeys.json — lib/storyCategories.ts도
// 동일 JSON을 import해 StoryCategoryKey 타입과 routes를 동기 유지한다.
const STORY_CATEGORY_KEYS = require('./lib/storyCategoryKeys.json');

const {
  storiesDir,
  getStoryThumbnail,
  getStoryTitle,
  getStoryLastmod,
} = require('./lib/sitemap/storyMeta');
const {
  getPortfolioImageMap,
  isPortfolioThin,
} = require('./lib/sitemap/portfolioMeta');
const {
  isStoryThin,
} = require('./lib/sitemap/thinContent');
const {
  SITE_URL,
  LOCALES,
  REDIRECTED_SLUGS,
  getAlternateRefs,
  getRouteLastmod,
  getCategoryLastmod,
} = require('./lib/sitemap/routes');

const buildTimestamp = new Date().toISOString();

// Map of marketing pages to their representative OG images.
// title/caption은 Google Image Search용 메타. Studio NOL 브랜드 + 페이지 주제 포함.
const pageImageMap = {
  '/about': { url: '/images/og-recording15.webp', title: 'Studio NOL - 10-Year Music Production Experience', caption: 'Recording studio in Yeonsinnae, Eunpyeong-gu, Seoul with professional engineers.' },
  '/contact': { url: '/images/og-hardware5.webp', title: 'Studio NOL Contact - Book Recording Session', caption: 'Reach Studio NOL for recording, mixing, voiceover, and wedding song production.' },
  '/index': { url: '/images/og-default.webp', title: 'Studio NOL - Seoul Music Production Studio', caption: 'Yeonsinnae Studio NOL: recording, mixing, mastering, voiceover, wedding song.' },
  '/lesson': { url: '/images/og-lesson1.webp', title: 'Studio NOL Music Lessons - Vocal & Production', caption: 'One-on-one vocal, mixing, and music production lessons at Studio NOL.' },
  '/portfolio': { url: '/images/og-recording1.webp', title: 'Studio NOL Portfolio - Recording & Mixing Works', caption: 'Albums, singles, and commercial works produced at Studio NOL.' },
  '/practice-room': { url: '/images/og-room5.webp', title: 'Studio NOL Premium Practice Room - Soundproof Residency', caption: 'Soundproof premium practice room with monthly residency in Eunpyeong-gu, Seoul.' },
  '/pricing': { url: '/images/og-hardware2.webp', title: 'Studio NOL Pricing - Transparent Recording Fees', caption: 'Studio NOL pricing: practice room ₩20K/hr, wedding vocal ₩150K, voiceover ₩30K/hr.' },
  '/stories': { url: '/images/og-studio1.webp', title: 'Studio NOL Stories - Mixing & Recording Guides', caption: 'Production guides, engineering tutorials, and studio stories by Studio NOL.' },
  '/studio-info': { url: '/images/og-hardware1.webp', title: 'Studio NOL Equipment - Analog Gear & Neumann Mics', caption: 'Studio NOL gear list: Neumann microphones, analog outboard, pro DAW setup.' },
  '/wedding-song': { url: '/images/og-recording3.webp', title: 'Studio NOL Wedding Song Package - ₩150K+', caption: 'Wedding vocal package at Studio NOL: pro recording, mix, and editing.' },
  '/voice-acting': { url: '/images/og-hardware3.webp', title: 'Studio NOL Voiceover Recording - ₩30K/hr', caption: 'Professional voiceover recording at Studio NOL, Yeonsinnae.' },
};

const buildStoryImage = (slug, locale) => {
  const thumbnail = getStoryThumbnail(slug, locale);
  if (!thumbnail) return null;
  const imageUrl = thumbnail.startsWith('http')
    ? thumbnail
    : `${SITE_URL}${thumbnail.startsWith('/') ? thumbnail : '/' + thumbnail}`;
  const title = getStoryTitle(slug, locale);
  return { loc: new URL(imageUrl), title, caption: title, geoLocation: 'Seoul, Eunpyeong-gu, South Korea' };
};

module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  autoLastmod: false,
  alternateRefs: [],
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/api/*', '/404', '/500', '/', '/*/privacy-policy'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: ['/', '/api/rss'], disallow: ['/api/'] },
      // Google
      { userAgent: 'Googlebot', allow: '/' },
      { userAgent: 'Googlebot-Image', allow: '/' },
      // Google-Extended는 SGE/Gemini 학습용 분리 신호 — Google search 색인은 그대로 두고
      // 별도로 명시해 정책 가시성 확보
      { userAgent: 'Google-Extended', allow: '/' },
      // Bing
      { userAgent: 'Bingbot', allow: '/' },
      // Naver
      { userAgent: 'Yeti', allow: '/' },
      // DuckDuckGo
      { userAgent: 'DuckDuckBot', allow: '/' },
      // OpenAI
      { userAgent: 'GPTBot', allow: '/' },
      { userAgent: 'OAI-SearchBot', allow: '/' },
      { userAgent: 'ChatGPT-User', allow: '/' },
      // Anthropic
      { userAgent: 'ClaudeBot', allow: '/' },
      { userAgent: 'anthropic-ai', allow: '/' },
      // Perplexity
      { userAgent: 'PerplexityBot', allow: '/' },
      // Perplexity 사용자 fetch 봇 (검색 답변 시 실시간 fetch)
      { userAgent: 'Perplexity-User', allow: '/' },
      // Meta
      { userAgent: 'FacebookBot', allow: '/' },
      { userAgent: 'Meta-ExternalAgent', allow: '/' },
      // Apple
      { userAgent: 'Applebot', allow: '/' },
      // Apple Intelligence (별도 봇 — Applebot은 Siri/Spotlight, Applebot-Extended는 AI 학습)
      { userAgent: 'Applebot-Extended', allow: '/' },
      // ByteDance / TikTok AI
      { userAgent: 'Bytespider', allow: '/' },
      // Amazon
      { userAgent: 'Amazonbot', allow: '/' },
      // Cohere AI
      { userAgent: 'cohere-ai', allow: '/' },
      // Common Crawl
      { userAgent: 'CCBot', allow: '/' },
    ],
    additionalSitemaps: [],
    transformRobotsTxt: async (_config, robotsTxt) => {
      const cleaned = robotsTxt.replace(/# Host[\r\n]+Host:[^\r\n]*[\r\n]*/g, '');
      const llmsHint = `\n# LLM / AI content index\n# llms.txt: ${SITE_URL}/llms.txt\n# llms-full.txt: ${SITE_URL}/llms-full.txt\n`;
      return `Host: ${SITE_URL}\n${cleaned}${llmsHint}`;
    },
  },
  sitemapSize: 50000,
  additionalPaths: async () => {
    const files = fs.readdirSync(storiesDir);
    const slugs = new Set();
    files.forEach((file) => {
      if (!file.endsWith('.md')) return;
      let name = file.replace(/\.md$/, '');
      LOCALES.forEach((locale) => {
        if (name.endsWith(`.${locale}`)) {
          name = name.replace(new RegExp(`\\.${locale}$`), '');
        }
      });
      slugs.add(name);
    });

    const results = [];
    const slugList = Array.from(slugs);

    // 비-ko locale은 site-wide noindex 정책이라 sitemap에는 ko entry만 등록.
    // (components/SEO.tsx의 effectiveRobots, transform의 locale !== 'ko' 가드와 일관.)
    const locale = 'ko';

    // Story category hub pages — pages/[locale]/stories/category/[key].tsx와 동기화.
    for (const key of STORY_CATEGORY_KEYS) {
      const routePath = `/${locale}/stories/category/${key}`;
      results.push({
        loc: routePath,
        lastmod: getCategoryLastmod(key, slugList, locale) || buildTimestamp,
        changefreq: 'weekly',
        priority: 0.7,
        alternateRefs: getAlternateRefs(routePath),
      });
    }
    for (const slug of slugs) {
      // 308 redirect 대상은 sitemap에서 제외 (next.config.mjs가 광역 허브로 보냄).
      if (REDIRECTED_SLUGS.has(slug)) continue;
      // Thin-content quality gate.
      if (isStoryThin(slug, locale)) continue;

      const routePath = `/${locale}/stories/${slug}`;
      const image = buildStoryImage(slug, locale);
      const images = image ? [image] : [];
      results.push({
        loc: routePath,
        lastmod: getStoryLastmod(slug, locale) || new Date().toISOString(),
        changefreq: 'weekly',
        priority: 0.8,
        alternateRefs: getAlternateRefs(routePath),
        ...(images.length > 0 && { images }),
      });
    }
    return results;
  },
  transform: async (config, routePath) => {
    if (routePath.includes('/privacy-policy')) {
      return null;
    }

    const segments = routePath.split('/').filter(Boolean);
    const maybeLocale = segments[0];
    const locale = LOCALES.includes(maybeLocale) ? maybeLocale : 'ko';
    const pathWithoutLocale = LOCALES.includes(maybeLocale)
      ? `/${segments.slice(1).join('/') || 'index'}`
      : routePath;

    // 비-ko 페이지는 sitemap에서 전면 제외. SEO 컴포넌트가 noindex을 부여하므로
    // sitemap 등록은 모순 신호. 90일 GSC에서 비-ko 152페이지 합계 5 clicks /
    // CTR 0.62%로 검색 트래픽 사실상 없어 인덱싱 풀 정리.
    if (locale !== 'ko') {
      return null;
    }

    // Determine image for this route.
    let images = [];
    if (pathWithoutLocale.startsWith('/stories/') && segments.length >= 3) {
      const slug = segments[2];
      const image = buildStoryImage(slug, locale);
      if (image) images = [image];
    } else if (pathWithoutLocale.startsWith('/portfolio/') && segments.length >= 3) {
      const itemId = segments[2];
      const portfolioImages = getPortfolioImageMap();
      const imgUrl = portfolioImages[itemId];
      if (imgUrl) {
        images = [{
          loc: new URL(imgUrl.startsWith('http') ? imgUrl : `${SITE_URL}${imgUrl}`),
          geoLocation: 'Seoul, Eunpyeong-gu, South Korea',
        }];
      }
    } else {
      const pageKey = pathWithoutLocale === '/index' ? '/index' : pathWithoutLocale;
      const pageImg = pageImageMap[pageKey];
      if (pageImg) {
        images = [{
          loc: new URL(`${SITE_URL}${pageImg.url}`),
          title: pageImg.title,
          caption: pageImg.caption,
          geoLocation: 'Seoul, Eunpyeong-gu, South Korea',
        }];
      }
    }

    const entry = {
      loc: routePath,
      lastmod: getRouteLastmod(routePath, buildTimestamp),
      changefreq: config.changefreq,
      priority: config.priority,
      alternateRefs: getAlternateRefs(routePath),
      ...(images.length > 0 && { images }),
    };

    if (routePath === '/' || routePath.match(/^\/[a-z]{2}$/)) {
      return { ...entry, changefreq: 'daily', priority: 1.0 };
    }

    if (routePath.includes('/portfolio/')) {
      // Thin gate: productionNotes가 해당 locale에 없으면 fallback noindex이므로 제외.
      if (segments.length >= 3) {
        const itemId = segments[2];
        if (isPortfolioThin(itemId, locale)) return null;
      }
      return { ...entry, changefreq: 'weekly', priority: 0.9 };
    }

    if (routePath.includes('/stories/')) {
      // Thin gate + 308 redirect 대상 제외 (defensive).
      // fallback locale gate: native 파일(`{slug}.{locale}.md`) 없으면 ko 폴백 페이지로
      // 렌더되어 noindex로 처리되므로 sitemap에서도 제외. additionalPaths는 이미 동일
      // 게이트를 적용하지만 transform은 getStaticPaths가 자동 등록한 path까지 호출하므로
      // 여기서 한 번 더 차단해야 sitemap에 fallback URL이 누락 없이 제거된다.
      if (segments.length >= 3) {
        const slug = segments[2];
        if (REDIRECTED_SLUGS.has(slug)) return null;
        if (isStoryThin(slug, locale)) return null;
        if (locale !== 'ko') {
          const localeFilePath = path.join(storiesDir, `${slug}.${locale}.md`);
          if (!fs.existsSync(localeFilePath)) return null;
        }
      }
      return { ...entry, changefreq: 'weekly', priority: 0.8 };
    }

    if (routePath.match(/\/(pricing|contact|studio-info|practice-room|wedding-song|voice-acting|lesson)(\/|$)/)) {
      return { ...entry, priority: 0.9 };
    }

    if (routePath.match(/\/(about|portfolio|stories)(\/|$)/)
      && !routePath.includes('/stories/')
      && !routePath.includes('/portfolio/')) {
      return { ...entry, priority: 0.8 };
    }

    return entry;
  },
};
