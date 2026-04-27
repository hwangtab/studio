#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Build-time generator that emits a JSON sidecar with portfolio metadata
 * (id, image URL, productionNotes locale presence). next-sitemap.config.js
 * reads this file instead of regex-parsing data/portfolio.ts at runtime,
 * removing brittleness around property reordering or formatting changes.
 *
 * Output: lib/portfolio-meta.json
 */

const fs = require('node:fs');
const path = require('node:path');

// portfolio item 데이터는 data/portfolio/items.ts에 있다. 분할 후에도 동일한
// `const items: PortfolioItem[] = [` 패턴 + brace 구조를 유지해 이 파서가
// 그대로 동작하도록 보장한다. 분할 정보는 data/portfolio.ts 상단 주석 참조.
const portfolioFile = path.join(process.cwd(), 'data', 'portfolio', 'items.ts');
const outputFile = path.join(process.cwd(), 'lib', 'portfolio-meta.json');

const SKIP_IDS = new Set(['all', 'album', 'single', 'compilation', 'commercial']);
const KNOWN_LOCALES = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];

const source = fs.readFileSync(portfolioFile, 'utf8');

const itemsArrayMarker = source.match(/const\s+items\s*:\s*PortfolioItem\[\]\s*=\s*\[/);
if (!itemsArrayMarker) {
  console.error('generate-portfolio-meta: items array not found in data/portfolio.ts');
  process.exit(1);
}
const arrayStart = itemsArrayMarker.index + itemsArrayMarker[0].length;

const collectTopLevelObjects = (start) => {
  const objects = [];
  let bracketDepth = 1; // we're already inside the items array '['
  let braceDepth = 0;
  let objStart = -1;
  let inString = false;
  let stringChar = '';
  let escapeNext = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 1; }
      continue;
    }
    if (escapeNext) { escapeNext = false; continue; }

    if (inString) {
      if (ch === '\\') { escapeNext = true; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }

    if (ch === '/' && next === '/') { inLineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '[') bracketDepth += 1;
    else if (ch === ']') {
      bracketDepth -= 1;
      if (bracketDepth === 0) break; // end of items array
    } else if (ch === '{') {
      if (braceDepth === 0 && bracketDepth === 1) objStart = i;
      braceDepth += 1;
    } else if (ch === '}') {
      braceDepth -= 1;
      if (braceDepth === 0 && objStart >= 0 && bracketDepth === 1) {
        objects.push({ start: objStart, end: i + 1 });
        objStart = -1;
      }
    }
  }
  return objects;
};

const findKeyValueStringInBlock = (block, key) => {
  // Match `"key": "..."` at any nesting level — sufficient for top-level
  // string fields like id/image/title where the first match wins.
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = block.match(re);
  return match ? match[1] : null;
};

const extractProductionNotesLocales = (block) => {
  const pnIndex = block.indexOf('"productionNotes"');
  if (pnIndex < 0) return [];
  const open = block.indexOf('{', pnIndex);
  if (open < 0) return [];

  // Track braces inside productionNotes to find its end.
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escapeNext = false;
  let close = -1;
  for (let j = open; j < block.length; j += 1) {
    const cj = block[j];
    if (escapeNext) { escapeNext = false; continue; }
    if (inString) {
      if (cj === '\\') { escapeNext = true; continue; }
      if (cj === stringChar) inString = false;
      continue;
    }
    if (cj === '"' || cj === "'" || cj === '`') {
      inString = true;
      stringChar = cj;
      continue;
    }
    if (cj === '{') depth += 1;
    else if (cj === '}') {
      depth -= 1;
      if (depth === 0) { close = j; break; }
    }
  }
  if (close < 0) return [];

  // Walk depth=1 keys only (direct children of productionNotes).
  const pnBlock = block.slice(open, close + 1);
  const present = new Set();
  let keyDepth = 0;
  let keyInString = false;
  let keyStringChar = '';
  let keyEscape = false;
  for (let j = 0; j < pnBlock.length; j += 1) {
    const cj = pnBlock[j];
    if (keyEscape) { keyEscape = false; continue; }
    if (keyInString) {
      if (cj === '\\') { keyEscape = true; continue; }
      if (cj === keyStringChar) keyInString = false;
      continue;
    }
    if (cj === '"' || cj === "'" || cj === '`') {
      if (keyDepth === 1) {
        // Find the closing quote to extract the key text.
        let k = j + 1;
        let esc = false;
        let closeQuote = -1;
        while (k < pnBlock.length) {
          const c = pnBlock[k];
          if (esc) { esc = false; k += 1; continue; }
          if (c === '\\') { esc = true; k += 1; continue; }
          if (c === cj) { closeQuote = k; break; }
          k += 1;
        }
        if (closeQuote >= 0) {
          const keyText = pnBlock.slice(j + 1, closeQuote);
          let m = closeQuote + 1;
          while (m < pnBlock.length && /\s/.test(pnBlock[m])) m += 1;
          if (pnBlock[m] === ':' && KNOWN_LOCALES.includes(keyText)) {
            present.add(keyText);
          }
        }
      }
      keyInString = true;
      keyStringChar = cj;
      continue;
    }
    if (cj === '{') keyDepth += 1;
    else if (cj === '}') keyDepth -= 1;
  }
  return KNOWN_LOCALES.filter((l) => present.has(l));
};

const ranges = collectTopLevelObjects(arrayStart);
const items = [];
for (const range of ranges) {
  const block = source.slice(range.start, range.end);
  const id = findKeyValueStringInBlock(block, 'id');
  if (!id || SKIP_IDS.has(id)) continue;
  const image = findKeyValueStringInBlock(block, 'image');
  const productionNotesLocales = extractProductionNotesLocales(block);
  items.push({
    id,
    image: image || null,
    productionNotesLocales,
  });
}

if (items.length === 0) {
  console.error('generate-portfolio-meta: no portfolio items extracted');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  `${JSON.stringify({ generated: new Date().toISOString(), count: items.length, items }, null, 2)}\n`
);
console.log(`portfolio-meta: ${items.length} items written to ${path.relative(process.cwd(), outputFile)}`);
