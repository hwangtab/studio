const fs = require('node:fs');
const path = require('node:path');

// Portfolio metadata는 prebuild의 scripts/generate-portfolio-meta.js가 생성한
// 사이드카 JSON에서 읽는다. 정규식으로 .ts 파일을 파싱하지 않으므로 속성 순서나
// 형식 변경에 영향받지 않는다.

const portfolioMetaFile = path.join(process.cwd(), 'lib', 'portfolio-meta.json');
const DEFAULT_LOCALE = 'ko';

let cachedItems = null;
const loadPortfolioMeta = () => {
  if (cachedItems) return cachedItems;
  // manifest 부재(prebuild 미실행/실패)·파싱 실패를 조용히 빈 목록으로 삼키면
  // isPortfolioThin이 전 아이템 true → 포트폴리오 전체가 사이트맵에서 무음 누락된다.
  // "정상적 빈 목록"(파싱 성공 + items 배열)과 구분해 명시적으로 throw하여
  // postbuild(next-sitemap)를 시끄럽게 중단시킨다.
  let raw;
  try {
    raw = fs.readFileSync(portfolioMetaFile, 'utf8');
  } catch (err) {
    throw new Error(
      `[sitemap] portfolio manifest not readable: ${portfolioMetaFile} — `
      + 'prebuild(scripts/generate-portfolio-meta.js, `npm run generate:manifests`)가 '
      + `실행되지 않았거나 실패한 상태. (${err.message})`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[sitemap] portfolio manifest is not valid JSON: ${portfolioMetaFile} — `
      + `\`npm run generate:manifests\`로 재생성 필요. (${err.message})`
    );
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error(
      `[sitemap] portfolio manifest malformed (\`items\` must be an array): ${portfolioMetaFile}`
    );
  }
  cachedItems = parsed.items;
  return cachedItems;
};

const getPortfolioImageMap = () => {
  const items = loadPortfolioMeta();
  const map = {};
  for (const item of items) {
    if (item?.id && item?.image) map[item.id] = item.image;
  }
  return map;
};

let cachedById = null;
const portfolioMetaById = () => {
  if (cachedById) return cachedById;
  cachedById = new Map();
  for (const item of loadPortfolioMeta()) {
    if (item?.id) cachedById.set(item.id, item);
  }
  return cachedById;
};

/**
 * Returns true when the item has no productionNotes for the requested locale.
 * Fallback-rendered pages emit `noindex` at runtime, so excluding them from the
 * sitemap avoids pointing Google at URLs that will only waste crawl budget.
 */
const isPortfolioThin = (itemId, locale = DEFAULT_LOCALE) => {
  const item = portfolioMetaById().get(itemId);
  if (!item) return true;
  const locales = Array.isArray(item.productionNotesLocales) ? item.productionNotesLocales : [];
  return !locales.includes(locale);
};

module.exports = {
  loadPortfolioMeta,
  getPortfolioImageMap,
  portfolioMetaById,
  isPortfolioThin,
};
