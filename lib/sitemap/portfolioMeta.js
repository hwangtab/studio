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
  try {
    const raw = fs.readFileSync(portfolioMetaFile, 'utf8');
    const parsed = JSON.parse(raw);
    cachedItems = Array.isArray(parsed.items) ? parsed.items : [];
    return cachedItems;
  } catch {
    cachedItems = [];
    return cachedItems;
  }
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
