const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

// Story frontmatter helpers used by next-sitemap.config.js.
// gray-matter로 일원화된 파서로 lib/stories.ts와 동일한 fallback 체인을 따른다:
//   slug.{locale}.md → slug.en.md (locale !== ko일 때) → slug.md
// 캐시는 process 수명 동안 유지 — 빌드 단일 실행 컨텍스트에서 재사용.

const storiesDir = path.join(process.cwd(), 'content', 'stories');
const DEFAULT_LOCALE = 'ko';
const storyFileCache = new Map();

const getStoryFrontmatter = (slug, locale) => {
  const cacheKey = `${locale}:${slug}`;
  if (storyFileCache.has(cacheKey)) return storyFileCache.get(cacheKey);

  const candidates = [path.join(storiesDir, `${slug}.${locale}.md`)];
  if (locale !== DEFAULT_LOCALE) {
    candidates.push(path.join(storiesDir, `${slug}.en.md`));
  }
  candidates.push(path.join(storiesDir, `${slug}.md`));

  for (const filePath of candidates) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContent);
      const result = { data: data || {}, content: content || '', filePath };
      storyFileCache.set(cacheKey, result);
      return result;
    } catch {
      // next candidate
    }
  }
  storyFileCache.set(cacheKey, null);
  return null;
};

const getStoryThumbnail = (slug, locale) => {
  const fm = getStoryFrontmatter(slug, locale);
  const thumbnail = fm?.data?.thumbnail;
  return typeof thumbnail === 'string' && thumbnail.length > 0 ? thumbnail : null;
};

const getStoryTitle = (slug, locale) => {
  const fm = getStoryFrontmatter(slug, locale);
  const title = fm?.data?.title;
  return typeof title === 'string' && title.trim().length > 0 ? title.trim() : slug;
};

const getStoryCategory = (slug, locale) => {
  const fm = getStoryFrontmatter(slug, locale);
  const category = fm?.data?.category;
  return typeof category === 'string' && category.trim().length > 0 ? category.trim() : null;
};

const toIsoMtime = (filePath) => {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
};

const getStoryLastmod = (slug, locale) => {
  // getStoryFrontmatter와 동일한 3단 fallback 체인을 따라야 sitemap lastmod가
  // 실제 서빙 파일의 mtime을 반영한다. en fallback 누락 시 stale 신호 발생.
  const candidates = [path.join(storiesDir, `${slug}.${locale}.md`)];
  if (locale !== DEFAULT_LOCALE) {
    candidates.push(path.join(storiesDir, `${slug}.en.md`));
  }
  candidates.push(path.join(storiesDir, `${slug}.md`));
  const mtimes = candidates.map(toIsoMtime).filter(Boolean);
  if (mtimes.length === 0) return null;
  return mtimes.sort().at(-1);
};

module.exports = {
  storiesDir,
  toIsoMtime,
  getStoryFrontmatter,
  getStoryThumbnail,
  getStoryTitle,
  getStoryCategory,
  getStoryLastmod,
};
