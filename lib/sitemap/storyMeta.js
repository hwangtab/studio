const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { applyFactTokens } = require('../factTokens');

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
      const fileContent = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
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

// frontmatter 날짜(Date | 문자열)를 ISO로 정규화. lib/stories.ts normalizeDate와 동일 정책이되,
// 사이트맵은 잘못된 값을 "오늘"로 대체하면 안 된다(가짜 freshness가 그대로 <lastmod>로 나감).
// 파싱 불가 값은 null을 반환해 호출부의 다음 후보로 넘긴다.
const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    console.warn(`[sitemap] invalid frontmatter date, ignoring: ${String(value)}`);
    return null;
  }
  return date.toISOString();
};

const getStoryLastmod = (slug, locale) => {
  // 해당 locale의 실제 서빙 파일 1개만 본다 — ko 갱신이 다른 locale URL의 freshness
  // 신호로 잘못 전파되지 않도록(이전 MAX 로직은 7개 locale URL 전체 lastmod이 ko 수정
  // 시각으로 동기화되는 버그였다). fallback 체인의 첫 존재 파일을 사용.
  //
  // 우선순위는 frontmatter lastmod → date → (최후) mtime이다. mtime을 먼저 쓰면 안 된다:
  // git은 mtime을 보존하지 않고 Vercel은 얕은 클론이라 배포마다 전 파일 mtime이 체크아웃
  // 시각으로 균일화된다. 그러면 1,100+ URL의 <lastmod>가 전부 같은 순간을 주장하고 배포마다
  // 갱신돼, Google이 요구하는 "consistently and verifiably accurate" 조건을 깨고 신호가
  // 통째로 폐기된다. lastmod은 scripts/backfill-story-lastmod.mjs가 git 이력에서 채워
  // 넣었고(1,757/1,764편), date는 전 편이 보유한다. 로컬 개발에서는 mtime이 파일마다 달라
  // 이 문제가 드러나지 않으므로 프로덕션 사이트맵으로만 검증할 것.
  const fm = getStoryFrontmatter(slug, locale);
  if (fm) {
    const fromFrontmatter = toIsoDate(fm.data.lastmod) || toIsoDate(fm.data.date);
    if (fromFrontmatter) return fromFrontmatter;
  }

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
