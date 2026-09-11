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
  getIndexableStoryLocales,
  getRouteLastmod,
  getCategoryLastmod,
} = require('./lib/sitemap/routes');
const { readFundingProjects } = require('./lib/sitemap/fundingMeta');

// 라우트 단위 en 색인 개방 대상(단일 소스 lib/enIndexablePaths.json) — 이 경로의 en
// 버전은 noindex 전면 제외에서 예외로 사이트맵에 등재된다(런타임 metadataUrls와 대칭).
// ⚠️ 엔트리는 self-canonical 라우트만(계약 상세: components/seo/metadataUrls.ts).
const EN_INDEXABLE_PATHS = new Set(require('./lib/enIndexablePaths.json'));

const buildTimestamp = new Date().toISOString();

// Map of marketing pages to their representative OG images.
// title/caption은 Google Image Search용 메타. Studio NOL 브랜드 + 페이지 주제 포함.
const pageImageMap = {
  '/artists': { url: '/images/og-recording15.webp', title: 'Support Artists - Studio NOL', caption: 'Monthly support for independent artists who recorded at Studio NOL, Seoul.' },
  '/release-project': { url: '/images/og-recording15.webp', title: 'Studio NOL Release Project - Indie Music Release by Producer Hwang Gyeongha', caption: 'Full-service indie music release: planning, recording, sessions, mixing, distribution, and media PR by 15-year producer Hwang Gyeongha.' },
  '/release-project/single': { url: '/images/og-recording15.webp', title: 'Studio NOL Single Release - Indie Single by Producer Hwang Gyeongha', caption: 'Indie single release project: planning, vocal recording, sessions, mixing, distribution, and PR by 15-year producer Hwang Gyeongha.' },
  '/release-project/ep': { url: '/images/og-recording15.webp', title: 'Studio NOL EP Release - Indie EP by Producer Hwang Gyeongha', caption: 'Indie EP release project: 3–5 tracks with planning, recording, sessions, mixing, distribution, and PR by 15-year producer Hwang Gyeongha.' },
  '/release-project/album': { url: '/images/og-recording15.webp', title: 'Studio NOL Full Album Release - Indie Album by Producer Hwang Gyeongha', caption: 'Full album release project: planning, vocal recording, sessions, mixing, distribution, and media PR by 15-year producer Hwang Gyeongha.' },
  '/about': { url: '/images/og-recording15.webp', title: 'Studio NOL - 10-Year Music Production Experience', caption: 'Recording studio in Yeonsinnae, Eunpyeong-gu, Seoul with professional engineers.' },
  // 상업 LP 2종 + 운영자 프로필. ogImage는 각 페이지의 SEO ogImage prop과 동기
  // (recording.tsx:137 · mixing-mastering.tsx:171 · author.tsx:45).
  '/recording': { url: '/images/og-recording1.webp', title: 'Studio NOL Recording Studio - Vocal Recording ₩250K/song', caption: 'Vocal and instrument recording in Yeonsinnae, Seoul: treated live room, STC 60+ booth, Neumann U87Ai, dedicated engineer.' },
  '/mixing-mastering': { url: '/images/og-hardware1.webp', title: 'Studio NOL Mixing & Mastering - From ₩200K/song', caption: 'Professional mixing and mastering by 15-year producer Hwang Gyeongha. Track-count tiers, two revisions included, remote submission accepted.' },
  '/author': { url: '/images/og-recording15.webp', title: 'Hwang Gyeongha - Producer & Audio Engineer, Studio NOL', caption: 'Producer and audio engineer with 15 years of experience; recipient of the Selection Committee Special Award at the 14th Korean Music Awards (2017).' },
  '/contact': { url: '/images/og-hardware5.webp', title: 'Studio NOL Contact - Book Recording Session', caption: 'Reach Studio NOL for recording, mixing, voiceover, and wedding song production.' },
  '/index': { url: '/images/og-studio2.webp', title: 'Studio NOL - Seoul Music Production Studio', caption: 'Yeonsinnae Studio NOL: recording, mixing, mastering, voiceover, wedding song.' },
  '/lesson': { url: '/images/og-lesson1.webp', title: 'Studio NOL Music Lessons - Vocal & Production', caption: 'One-on-one vocal, mixing, and music production lessons at Studio NOL.' },
  '/portfolio': { url: '/images/og-recording1.webp', title: 'Studio NOL Portfolio - Recording & Mixing Works', caption: 'Albums, singles, and commercial works produced at Studio NOL.' },
  '/practice-room': { url: '/images/og-room8.webp', title: 'Studio NOL Premium Practice Room - Soundproof Residency', caption: 'Soundproof premium practice room with monthly residency in Eunpyeong-gu, Seoul.' },
  '/pricing': { url: '/images/og-hardware2.webp', title: 'Studio NOL Pricing - Transparent Recording Fees', caption: 'Studio NOL pricing: practice room ₩360K/mo, recording ₩100K/hr, wedding song ₩350K, voiceover ₩100K/hr.' },
  '/stories': { url: '/images/og-studio1.webp', title: 'Studio NOL Stories - Mixing & Recording Guides', caption: 'Production guides, engineering tutorials, and studio stories by Studio NOL.' },
  '/studio-info': { url: '/images/og-hardware1.webp', title: 'Studio NOL Equipment - Analog Gear & Neumann Mics', caption: 'Studio NOL gear list: Neumann microphones, analog outboard, pro DAW setup.' },
  '/wedding-song': { url: '/images/og-recording3.webp', title: 'Studio NOL Wedding Song Package - ₩350K+', caption: 'Wedding vocal package at Studio NOL: pro recording, mix, and editing.' },
  '/voice-acting': { url: '/images/og-hardware3.webp', title: 'Studio NOL Voiceover Recording - ₩100K/hr', caption: 'Professional voiceover recording at Studio NOL, Yeonsinnae.' },
  '/cover-video': { url: '/images/og-recording1.webp', title: 'Studio NOL Cover Video Package - ₩350K', caption: 'Cover video filming + recording + mixing all-in-one at Studio NOL, Yeonsinnae.' },
  // Buyer-intent 가이드 허브 6종 — 이미지 소스는 data/buyerIntentHubs.ts hero.image와
  // 수동 동기(허브 추가/이미지 변경 시 여기도 갱신).
  '/guides/wedding-song-singing': { url: '/images/recording7.webp', title: 'Wedding Song Self-Singing Guide - Studio NOL', caption: 'Practice, record, and deliver your own wedding song — one-page guide by Studio NOL.' },
  '/guides/audiobook-asmr-getting-started': { url: '/images/recording6.webp', title: 'Audiobook & ASMR Starter Guide - Studio NOL', caption: 'Getting started with audiobook and ASMR recording — curated guide by Studio NOL.' },
  '/guides/home-recording-survival': { url: '/images/hardware2.webp', title: 'Home Recording Survival Guide - Studio NOL', caption: 'Making demos in a one-room studio — gear, limits, and when to go pro.' },
  '/guides/vocal-beginners-guide': { url: '/images/lesson1.webp', title: '1:1 Music Production Lesson Guide - Studio NOL', caption: 'MIDI composition, mixing, and release consulting — 1:1 lesson guide.' },
  '/guides/cover-video-production': { url: '/images/recording1.webp', title: 'Cover Video Production Guide - Studio NOL', caption: 'Filming, mixing, and uploading your first cover video — one-page guide.' },
  '/guides/indie-release-guide': { url: '/images/room7.webp', title: 'Indie Music Release A to Z - Studio NOL', caption: 'Single, EP, and album release steps, distribution, and royalties for indie artists.' },
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
  // /admin·계약 서명 경로는 운영자·당사자 전용이라 색인 대상이 아니다(각 페이지에도 noindex).
  // /booking·/terms도 동일 — 예약 퍼널·약관 고지는 검색 노출 대상이 아니다.
  exclude: [
    '/api/*', '/404', '/500', '/', '/*/privacy-policy', '/admin', '/admin/*', '/*/contracts/*', '/*/booking/*', '/*/terms',
    // 펀딩 트랜잭셔널 경로 — noindex + Cache-Control: no-store 페이지라 사이트맵 등재 대상이 아니다.
    '/*/funding/success', '/*/funding/fail', '/*/funding/manage/*', '/*/funding/*/pledge', '/*/funding/terms',
  ],
  robotsTxtOptions: {
    // robots 스펙: UA가 자기 이름의 그룹을 찾으면 '*' 그룹을 완전히 무시한다.
    // 따라서 명명된 봇 그룹에 allow:'/'만 두면 그 봇들은 /api/ disallow를 잃는다
    // (X-Robots-Tag가 색인은 막지만 크롤 예산은 샘). 모든 그룹에 동일 규칙을 복제한다.
    // allow에 /api/og/ 포함: 스토리 og:image가 /api/og/story라, 이게 없으면 robots를
    // 준수하는 소셜 스크레이퍼(Twitterbot·Slackbot 등 '*' 그룹 대상)가 공유 카드
    // 이미지를 못 가져온다. /llms.txt·/llms-full*.txt는 rewrite 경로(비-/api/)라
    // AI 봇의 /api/ 차단과 무관하게 접근 가능.
    policies: (() => {
      const RULES = {
        allow: ['/', '/api/rss', '/api/og/'],
        // /admin·계약 서명 링크는 크롤 대상이 아니다(전자계약 운영·당사자 전용).
        // /ko/booking/은 예약 퍼널(결제 진행 중 상태 등)이라 크롤 대상이 아니다.
        disallow: [
          '/api/', '/admin', '/ko/contracts/', '/en/contracts/', '/ko/booking/',
          // 펀딩 트랜잭셔널 경로 — 결제 진행 중 상태 등이라 크롤 대상이 아니다.
          '/ko/funding/success', '/ko/funding/fail', '/ko/funding/manage/', '/ko/funding/terms', '/ko/funding/*/pledge',
        ],
      };
      // 이 목록에 봇을 추가/누락해도 실효 차단 범위는 바뀌지 않는다 — 모든 명명
      // 그룹이 위 RULES를 그대로 복제하고, 명명되지 않은 UA는 RFC 9309에 따라
      // '*' 그룹을 따르므로 규칙 자체가 동일하다. 따라서 이 배열은 운영자가
      // robots.txt를 읽을 때 "이 봇을 인지하고 있다"를 보여주는 문서적 가시성
      // 목적이며, 새 봇 추가는 기능 변경이 아니다.
      const NAMED_BOTS = [
        // Google (Google-Extended는 SGE/Gemini 학습용 분리 신호 — 정책 가시성 목적 명시,
        // GoogleOther는 품질평가·기타 용도 크롤러 — 동일하게 가시성 목적)
        'Googlebot', 'Googlebot-Image', 'Google-Extended', 'GoogleOther',
        // Bing / Naver / DuckDuckGo (DuckAssistBot은 DuckDuckGo AI 답변용 분리 봇)
        'Bingbot', 'Yeti', 'DuckDuckBot', 'DuckAssistBot',
        // OpenAI
        'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
        // Anthropic (Claude-SearchBot·Claude-User는 답변 시 실시간 fetch/검색 봇)
        'ClaudeBot', 'anthropic-ai', 'Claude-SearchBot', 'Claude-User',
        // Perplexity (Perplexity-User는 답변 시 실시간 fetch 봇)
        'PerplexityBot', 'Perplexity-User',
        // Meta / Apple (Applebot-Extended는 AI 학습용 분리 봇)
        'FacebookBot', 'Meta-ExternalAgent', 'Applebot', 'Applebot-Extended',
        // ByteDance / Amazon / Cohere / Common Crawl / Mistral (MistralAI-User는 답변 시 실시간 fetch 봇)
        'Bytespider', 'Amazonbot', 'cohere-ai', 'CCBot', 'MistralAI-User',
      ];
      return [
        { userAgent: '*', ...RULES },
        ...NAMED_BOTS.map((userAgent) => ({ userAgent, ...RULES })),
      ];
    })(),
    additionalSitemaps: [],
    transformRobotsTxt: async (_config, robotsTxt) => {
      const cleaned = robotsTxt.replace(/# Host[\r\n]+Host:[^\r\n]*[\r\n]*/g, '');
      const llmsHint = `\n# LLM / AI content index\n# llms.txt: ${SITE_URL}/llms.txt\n# llms-full.txt: ${SITE_URL}/llms-full.txt\n# llms-full (locale-scoped): ${SITE_URL}/llms-full-ko.txt ${SITE_URL}/llms-full-en.txt ${SITE_URL}/llms-full-zh.txt\n`;
      const hostDomain = SITE_URL.replace(/^https?:\/\//, '');
      return `Host: ${hostDomain}\n${cleaned}${llmsHint}`;
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
    // 단 ko 원본 없는 native-only 스토리는 예외로 native locale entry가 등재된다 —
    // getIndexableStoryLocales가 정책·thin·noindex 게이트를 일괄 적용해 "등재 ⇔ 색인
    // 가능" 불변식을 지킨다. (components/SEO.tsx effectiveRobots의
    // allowNonDefaultLocaleIndexing 예외, transform의 locale !== 'ko' 가드와 일관.
    // transform이 null로 거른 native-only 정적 경로는 여기서 추가되고, ko 경로 충돌은
    // next-sitemap이 loc 기준 merge하므로 중복 없음.)
    const hubLocale = 'ko';

    // Story category hub pages — pages/[locale]/stories/category/[key].tsx와 동기화 (ko 전용 유지).
    for (const key of STORY_CATEGORY_KEYS) {
      const routePath = `/${hubLocale}/stories/category/${key}`;
      results.push({
        loc: routePath,
        lastmod: getCategoryLastmod(key, slugList, hubLocale) || buildTimestamp,
        changefreq: 'weekly',
        priority: 0.7,
        alternateRefs: getAlternateRefs(routePath),
      });
    }
    for (const slug of slugs) {
      // 308 redirect 대상은 sitemap에서 제외 (next.config.mjs가 광역 허브로 보냄).
      if (REDIRECTED_SLUGS.has(slug)) continue;
      // 일반 스토리 ['ko'](thin/noindex면 []) · native-only 스토리 [native].
      for (const locale of getIndexableStoryLocales(slug)) {
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
    }
    // 펀딩 프로젝트 상세 페이지 — draft·hidden 프로젝트(예: 결제 스모크 테스트용)는 등재하지 않는다.
    for (const project of readFundingProjects()) {
      if (project.draft || project.hidden) continue;
      const routePath = `/ko/funding/${project.slug}`;
      results.push({
        loc: routePath,
        lastmod: getRouteLastmod(routePath, buildTimestamp),
        changefreq: 'daily',
        priority: 0.7,
        alternateRefs: getAlternateRefs(routePath),
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
    // 단, 상업 3페이지(/pricing·/contact·/release-project)의 en 버전은 선별 색인
    // 개방 대상이라 예외로 등재 — 런타임 metadataUrls의 EN_INDEXABLE_PATHS와 대칭.
    if (locale !== 'ko' && !(locale === 'en' && EN_INDEXABLE_PATHS.has(pathWithoutLocale))) {
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

    // guides 포함: buyer-intent 허브는 구매 직전 의도 LP라 서비스 페이지와 동급(0.9).
    if (routePath.match(/\/(pricing|contact|studio-info|practice-room|wedding-song|voice-acting|cover-video|lesson|release-project|guides|artists)(\/|$)/)) {
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
