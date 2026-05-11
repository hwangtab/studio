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
  // 해당 locale의 실제 서빙 파일 1개의 mtime만 반환해야 ko 갱신이 다른 locale URL의
  // freshness 신호로 잘못 전파되지 않는다(이전 MAX 로직은 7개 locale URL 전체 lastmod이
  // ko 수정 시각으로 동기화되는 버그). fallback 체인의 첫 존재 파일을 사용.
  const candidates = locale === DEFAULT_LOCALE
    ? [path.join(storiesDir, `${slug}.md`)]
    : [
        path.join(storiesDir, `${slug}.${locale}.md`),
        path.join(storiesDir, `${slug}.en.md`),
        path.join(storiesDir, `${slug}.md`),
      ];
  for (const candidate of candidates) {
    const mtime = toIsoMtime(candidate);
    if (mtime) return mtime;
  }
  return null;
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
