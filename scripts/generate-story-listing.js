#!/usr/bin/env node
/* eslint-disable no-console */
//
// 빌드타임 생성기. content/stories/*.md 1,764편을 스캔해 locale(7개)별 목록 렌더/관련글
// 계산에 필요한 경량 필드만 lib/storyListing/{locale}.json에 저장한다.
//
// 배경: pages/api/stories/catalog.ts와 lib/stories.ts의 getRelatedStories는 카테고리
// 필터·페이지 전환·관련글 계산마다 getAllStories(locale)을 호출해 1,580~1,764개
// fs.readFileSync + gray-matter 파싱 + summarizeText regex를 콜드 스타트마다 전부 돈다.
// scripts/generate-story-catalog.js가 GSC 감사용으로 이미 같은 문제를 빌드타임 JSON으로
// 푼 선례를 같은 패턴으로 확장한다 — 새 파이프라인을 발명하지 않는다.
//
// 이 스크립트는 lib/stories.ts의 아래 로직을 CommonJS로 미러링한다(직접 import 불가 —
// 플레인 node로 실행되는 빌드 스크립트라 TS를 로드할 수 없다. lib/sitemap/thinContent.js가
// lib/storyContentPolicy.ts를 미러링하는 것과 동일한 관례):
//   - resolveStoryFile / getAllStorySlugs (파일 탐색·locale fallback 체인)
//   - mapStoryFrontmatter (Story 필드 추출)
//   - getStoryAvailableLocales(=isLocaleIndexable) (hreflang·browsable 게이트)
// 원본이 바뀌면 이 파일도 함께 갱신할 것 — routes.test.js·stories.test.ts가 산출물
// 정합성을 실제 콘텐츠로 검증한다.
//
// 사용:
//   node scripts/generate-story-listing.js         # lib/storyListing/*.json 생성
//   node scripts/generate-story-listing.js --check # 생성 없이 최신 여부만 검증(CI)

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { applyFactTokens } = require('../lib/factTokens');
const {
  THIN_CONTENT_THRESHOLD,
  SHORTCODE_CHAR_ESTIMATES,
  AUTO_EXPAND_BLOCK_REGEX,
  REGION_HUB_SLUGS,
} = require('../lib/sitemap/thinContent');
const REDIRECTED_SLUGS = new Set(Object.keys(require('../lib/regionRedirectMap.json')));
const STORY_CTA_OVERRIDES = new Set(require('../lib/storyCtaTypes.json'));

const STORIES_DIR = path.join(process.cwd(), 'content/stories');
/**
 * 로케일별로 나눠 쓴다.
 *
 * 한 파일에 7개 로케일을 담으면 ko 목록 하나를 그리려고 en·zh·es·vi·th·uz까지
 * 전부 파싱해야 한다(7배). 들여쓰기까지 넣으면 파일이 실데이터의 두 배가 된다.
 * 로케일당 한 파일 + 최소화로 요청당 파싱량을 1/14로 줄인다.
 */
const OUTPUT_DIR = path.join(process.cwd(), 'lib/storyListing');
const outputPathFor = (locale) => path.join(OUTPUT_DIR, `${locale}.json`);
const DEFAULT_LOCALE = 'ko';
// 단일 소스는 lib/i18n-config.ts. lib/sitemap/routes.js도 같은 배열을 하드코딩해
// 유지하는 기존 관례를 따른다(TS를 플레인 node에서 import할 수 없음).
const LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
const DEFAULT_AUTHOR = '스튜디오 놀';
const DEFAULT_TAGS = ['기본'];
const SHORTCODE_DEFAULT_CHAR_ESTIMATE = 80;

// --- lib/storyFrontmatter.ts:stripCodeFenceWrapper 미러 ---
const stripCodeFenceWrapper = (source) => {
  if (!source) return '';
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('```')) return source;

  const lines = trimmed.split(/\r?\n/);
  const opening = lines[0].trim();
  if (!opening.startsWith('```')) return source;

  let closingIndex = lines.length - 1;
  while (closingIndex > 0 && !lines[closingIndex].trim().startsWith('```')) {
    closingIndex -= 1;
  }
  if (closingIndex <= 0) return source;
  return lines.slice(1, closingIndex).join('\n');
};

// --- lib/storyFrontmatter.ts:normalizeStoryCTAOverride 미러 ---
const normalizeStoryCTAOverride = (raw) => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  return STORY_CTA_OVERRIDES.has(trimmed) ? trimmed : undefined;
};

// --- utils/textUtils.ts:stripMarkdown/summarizeText 미러 ---
const stripMarkdown = (content) => {
  if (!content) return '';
  return content
    .replace(/!\[.*?\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
};

const summarizeText = (text, maxLength = 100, options = {}) => {
  if (!text) return '';
  const plainText = options.stripMarkdown ? stripMarkdown(text) : text;
  if (plainText.length <= maxLength) return plainText;
  const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
  const summary = plainText.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
  return summary + '...';
};

// --- utils/localDataUtils.ts:extractFirstImageUrl 미러 ---
const extractFirstImageUrl = (content) => {
  if (!content) return null;
  const match = content.match(/!\[.*?\]\(([^)]+)\)/);
  return match ? match[1] : null;
};

// --- lib/storyCategories.ts:normalizeStoryCategoryKey 미러 ---
// 매핑 값 자체 소스는 lib/storyCategories.ts(TS) — 카테고리 키를 늘리거나 매핑을
// 바꾸면 이 사전도 함께 갱신할 것. lib/stories.test.ts가 실제 콘텐츠로 산출물을
// 대조하므로 드리프트가 나면 CI에서 잡힌다.
const STORY_CATEGORY_KEY_SET = new Set([
  'instrument', 'region', 'lesson', 'production', 'recording',
  'vocal', 'feedback', 'mixing', 'business', 'event',
]);
const STORY_CATEGORY_NORMALIZATION_MAP = {
  '악기 연습': 'instrument',
  '지역 가이드': 'region',
  강좌: 'lesson',
  '음악 제작': 'production',
  '녹음 가이드': 'recording',
  '보컬 가이드': 'vocal',
  후기: 'feedback',
  '믹싱·마스터링': 'mixing',
  '음악 비즈니스': 'business',
  이벤트: 'event',
  instrument: 'instrument',
  region: 'region',
  lesson: 'lesson',
  production: 'production',
  recording: 'recording',
  vocal: 'vocal',
  feedback: 'feedback',
  mixing: 'mixing',
  business: 'business',
  event: 'event',
  news: 'event',
  notice: 'event',
  공지: 'event',
  소식: 'event',
  interview: 'feedback',
  review: 'feedback',
  인터뷰: 'feedback',
  리뷰: 'feedback',
  '후기·인터뷰': 'feedback',
  practice: 'instrument',
  '음악연습실 가이드': 'instrument',
  음악연습실: 'instrument',
  '음악 연습실 가이드': 'instrument',
  '연습실 가이드': 'instrument',
  'music-guide': 'recording',
  guide: 'recording',
  가이드: 'recording',
};
const normalizeStoryCategoryKey = (category) => {
  if (!category) return 'recording';
  const trimmed = String(category).trim();
  if (STORY_CATEGORY_NORMALIZATION_MAP[trimmed]) return STORY_CATEGORY_NORMALIZATION_MAP[trimmed];
  if (STORY_CATEGORY_KEY_SET.has(trimmed)) return trimmed;
  return 'recording';
};

// --- lib/stories.ts:normalizeDate 미러 ---
const normalizeDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    console.warn(`[story-listing] invalid date value, falling back to today: ${String(value)}`);
    return new Date().toISOString();
  }
  return date.toISOString();
};

// --- lib/stories.ts:getAllStorySlugs 미러 ---
function getAllStorySlugs() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  const files = fs.readdirSync(STORIES_DIR);
  const slugs = new Set();
  files.forEach((file) => {
    if (!file.endsWith('.md')) return;
    let name = file.replace(/\.md$/, '');
    LOCALES.forEach((locale) => {
      if (name.endsWith(`.${locale}`)) {
        name = name.replace(new RegExp(`\\.${locale}$`), '');
      }
    });
    if (REDIRECTED_SLUGS.has(name)) return;
    slugs.add(name);
  });
  return Array.from(slugs);
}

// --- lib/stories.ts:resolveStoryFile 미러 (locale fallback 체인) ---
function resolveStoryFile(slug, locale) {
  const localeFilePath = path.join(STORIES_DIR, `${slug}.${locale}.md`);
  if (fs.existsSync(localeFilePath)) return { filePath: localeFilePath, sourceLocale: locale };

  if (locale !== DEFAULT_LOCALE) {
    const englishFallbackPath = path.join(STORIES_DIR, `${slug}.en.md`);
    if (fs.existsSync(englishFallbackPath)) return { filePath: englishFallbackPath, sourceLocale: 'en' };

    for (const fb of LOCALES) {
      if (fb === locale || fb === DEFAULT_LOCALE || fb === 'en') continue;
      const fbPath = path.join(STORIES_DIR, `${slug}.${fb}.md`);
      if (fs.existsSync(fbPath)) return { filePath: fbPath, sourceLocale: fb };
    }
  }

  return { filePath: path.join(STORIES_DIR, `${slug}.md`), sourceLocale: DEFAULT_LOCALE };
}

// --- lib/storyContentPolicy.ts:computeThinContentStatus 미러 ---
function computeThinContentStatus(contentAfterAutoExpandStrip, slug) {
  const shortcodeBonus = [...contentAfterAutoExpandStrip.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? SHORTCODE_DEFAULT_CHAR_ESTIMATE), 0);
  const rawNonWhitespace = contentAfterAutoExpandStrip.replace(/\s+/g, '').length;
  const charCount = rawNonWhitespace + shortcodeBonus;
  const isThinContent = !REGION_HUB_SLUGS.has(slug) && charCount < THIN_CONTENT_THRESHOLD;
  return { isThinContent };
}

// --- lib/stories.ts:extractAutoExpandBlock(stripped만) 미러 ---
function stripAutoExpandBlock(source) {
  if (!source || !source.includes('AUTO-EXPAND-V1')) return source;
  return source.replace(AUTO_EXPAND_BLOCK_REGEX, '').replace(/\n{3,}/g, '\n\n');
}

// --- lib/stories.ts:getStoryAvailableLocales(=isLocaleIndexable) 미러 ---
// 주의: 여기는 fallback 체인을 쓰지 않는다 — 해당 locale의 "네이티브" 파일이 실존하고
// noindex/thin이 아닐 때만 포함된다(hreflang alternate·related 후보 게이트와 동일 정책).
function getStoryAvailableLocales(slug) {
  const available = [];
  for (const locale of LOCALES) {
    const filePath = locale === DEFAULT_LOCALE
      ? path.join(STORIES_DIR, `${slug}.md`)
      : path.join(STORIES_DIR, `${slug}.${locale}.md`);
    if (!fs.existsSync(filePath)) continue;
    try {
      const raw = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
      const fm = matter(raw);
      if (typeof fm.data.robots === 'string' && /noindex/i.test(fm.data.robots)) continue;
      const stripped = stripAutoExpandBlock(fm.content);
      const { isThinContent } = computeThinContentStatus(stripped, slug);
      if (!isThinContent) available.push(locale);
    } catch {
      // skip
    }
  }
  return available;
}

// --- lib/stories.ts:isListableStory 미러 ---
function isListableStory(categoryKey, slug) {
  if (categoryKey === 'region' && !REGION_HUB_SLUGS.has(slug)) return false;
  return true;
}

function buildListing() {
  const slugs = getAllStorySlugs();
  const availableLocalesBySlug = new Map(slugs.map((slug) => [slug, getStoryAvailableLocales(slug)]));

  const locales = {};

  for (const locale of LOCALES) {
    const entries = [];

    for (const slug of slugs) {
      const { filePath } = resolveStoryFile(slug, locale);
      if (!fs.existsSync(filePath)) continue; // getParsedStoryFile 원본과 동일하게 조용히 skip

      let data;
      let content;
      try {
        const fileContents = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
        const normalized = stripCodeFenceWrapper(fileContents);
        const parsed = matter(normalized);
        data = parsed.data;
        content = parsed.content;
      } catch {
        continue;
      }

      const isoDate = normalizeDate(data?.date);
      const derivedThumbnail = data?.thumbnail || extractFirstImageUrl(content);
      const rawCategory = data?.category || '';
      const categoryKey = normalizeStoryCategoryKey(rawCategory);
      const cta = normalizeStoryCTAOverride(data?.cta);
      const availableLocales = availableLocalesBySlug.get(slug) || [];
      const browsable = isListableStory(categoryKey, slug) && availableLocales.includes(locale);

      const entry = {
        slug,
        title: data?.title || slug,
        date: isoDate,
        categoryKey,
        tags: Array.isArray(data?.tags) ? data.tags : DEFAULT_TAGS,
        summary: data?.summary || summarizeText(content, 150, { stripMarkdown: true }),
        thumbnail: derivedThumbnail || null,
        thumbnailDerived: !data?.thumbnail && Boolean(derivedThumbnail),
        images: Array.isArray(data?.images) ? data.images : [],
        browsable,
      };
      if (data?.author && data.author !== DEFAULT_AUTHOR) entry.author = data.author;
      if (cta) entry.cta = cta;

      entries.push(entry);
    }

    // 날짜 desc, 동률은 slug asc로 타이브레이크. readdirSync는 정렬을 보장하지 않고
    // 맥(APFS)·CI(ext4)의 순서가 달라, 타이브레이크 없이는 같은 날짜인 두 파일의
    // 순서가 플랫폼마다 달라져 내용이 같은데도 --check가 stale로 오탐할 수 있다.
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.slug.localeCompare(b.slug));
    locales[locale] = entries;
  }

  return locales;
}

function writeOutput() {
  const locales = buildListing();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  // generatedAt은 담지 않는다 — 내용이 같아도 매번 diff가 나 --check가 무의미해지고
  // 커밋 노이즈가 된다. 최신 여부는 content/stories와 대조해 판정한다.
  for (const [locale, entries] of Object.entries(locales)) {
    fs.writeFileSync(outputPathFor(locale), JSON.stringify(entries), 'utf-8');
  }
  const counts = LOCALES.map((l) => `${l}:${locales[l].length}`).join(' ');
  console.log(`story-listing: written to ${path.relative(process.cwd(), OUTPUT_DIR)}/{locale}.json (${counts})`);
}

// --check: 네트워크·파일쓰기 없이 산출물이 현재 콘텐츠와 정합한지만 검증한다.
function runCheck() {
  const fresh = buildListing();

  const missing = Object.keys(fresh).filter((locale) => !fs.existsSync(outputPathFor(locale)));
  if (missing.length > 0) {
    console.error(`story-listing --check failed: lib/storyListing/{${missing.join(',')}}.json missing. Run: node scripts/generate-story-listing.js`);
    process.exit(1);
  }
  const committed = Object.fromEntries(
    Object.keys(fresh).map((locale) => [locale, JSON.parse(fs.readFileSync(outputPathFor(locale), 'utf-8'))]),
  );
  const committedStr = JSON.stringify(committed);
  const freshStr = JSON.stringify(fresh);
  if (committedStr !== freshStr) {
    console.error('story-listing --check failed: lib/storyListing/*.json is stale relative to content/stories/*.md.');
    console.error('Run: node scripts/generate-story-listing.js and commit the result.');
    process.exit(1);
  }
  console.log('story-listing OK — lib/storyListing/*.json matches content/stories/*.md');
}

try {
  if (process.argv.includes('--check')) {
    runCheck();
  } else {
    writeOutput();
  }
} catch (err) {
  console.error('generate-story-listing failed:', err);
  process.exit(1);
}
