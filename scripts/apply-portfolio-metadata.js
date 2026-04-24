#!/usr/bin/env node
/**
 * Apply portfolio metadata from docs/portfolio-metadata-template.csv
 * into data/portfolio.ts.
 *
 * Fields handled: releaseDate, label, credits { engineer, musicians, gear }.
 * Empty CSV cells are ignored — existing values in portfolio.ts are preserved.
 *
 * Usage:
 *   node scripts/apply-portfolio-metadata.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT = path.resolve(__dirname, '..');
const CSV_FILE = path.join(ROOT, 'docs/portfolio-metadata-template.csv');
const TS_FILE = path.join(ROOT, 'data/portfolio.ts');

// --- CSV parsing ---------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
      field = ''; row = [];
      if (c === '\r' && text[i + 1] === '\n') i++;
      i++; continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const csv = parseCSV(fs.readFileSync(CSV_FILE, 'utf8'));
const header = csv[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const records = csv.slice(1).filter((r) => r[idx.id]).map((r) => ({
  id: r[idx.id].trim(),
  releaseDate: (r[idx.releaseDate] || '').trim(),
  label: (r[idx.label] || '').trim(),
  engineer: (r[idx.engineer] || '').trim(),
  musicians: (r[idx.musicians] || '').trim(),
  gear: (r[idx.gear] || '').trim(),
}));

// --- TS editing ----------------------------------------------------------
let src = fs.readFileSync(TS_FILE, 'utf8');

// Section boundaries are recomputed per-call because earlier upserts shift byte offsets.
function findItemBlock(source, id) {
  const itemsStartIdx = source.indexOf('const items: PortfolioItem[] = [');
  const itemsEndIdx = source.indexOf('export const getAudioTracks');
  const idMarker = `"id": "${id}"`;
  const idPos = source.indexOf(idMarker, itemsStartIdx);
  if (idPos < 0 || (itemsEndIdx > 0 && idPos > itemsEndIdx)) return null;
  let blockStart = idPos;
  while (blockStart > 0 && source[blockStart] !== '{') blockStart--;
  let depth = 0, blockEnd = -1;
  for (let i = blockStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) { blockEnd = i; break; } }
  }
  if (blockEnd < 0) return null;
  return { start: blockStart, end: blockEnd + 1 };
}

function escapeJSON(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function parseList(s) {
  return s.split('|').map((x) => x.trim()).filter(Boolean);
}

// Derive the indentation used inside an item block (level-1 properties).
function detectIndent(block) {
  const m = block.match(/\n(\s+)"[a-zA-Z]/);
  return m ? m[1] : '            ';
}

function upsertScalarField(block, indent, fieldName, value) {
  const escaped = escapeJSON(value);
  const entry = `"${fieldName}": "${escaped}"`;
  const fieldRegex = new RegExp(`"${fieldName}":\\s*"(?:\\\\.|[^"\\\\])*"`);
  if (fieldRegex.test(block)) {
    return block.replace(fieldRegex, entry);
  }
  // Insert before closing brace — ensure trailing comma on previous line.
  const closeIdx = block.lastIndexOf('}');
  if (closeIdx < 0) return block;
  const before = block.slice(0, closeIdx);
  // Ensure the last non-space char before "}" has a trailing comma.
  const trimmed = before.replace(/\s+$/, '');
  const needsComma = !trimmed.endsWith(',');
  const prefix = needsComma ? ',\n' : '\n';
  return trimmed + prefix + indent + entry + '\n' + ' '.repeat(Math.max(indent.length - 4, 0)) + block.slice(closeIdx);
}

function buildCreditsBlock(indent, engineer, musicians, gear) {
  const inner = indent + '    ';
  const parts = [];
  if (engineer) parts.push(`${inner}"engineer": "${escapeJSON(engineer)}"`);
  if (musicians) {
    const list = parseList(musicians).map((m) => `"${escapeJSON(m)}"`).join(', ');
    parts.push(`${inner}"musicians": [${list}]`);
  }
  if (gear) {
    const list = parseList(gear).map((g) => `"${escapeJSON(g)}"`).join(', ');
    parts.push(`${inner}"gear": [${list}]`);
  }
  if (parts.length === 0) return null;
  return `"credits": {\n${parts.join(',\n')}\n${indent}}`;
}

function upsertCredits(block, indent, engineer, musicians, gear) {
  const creditsText = buildCreditsBlock(indent, engineer, musicians, gear);
  if (!creditsText) return block;
  // Replace existing credits block or insert before closing brace.
  const creditsStart = block.indexOf('"credits":');
  if (creditsStart >= 0) {
    const braceOpen = block.indexOf('{', creditsStart);
    let depth = 0, braceClose = -1;
    for (let i = braceOpen; i < block.length; i++) {
      if (block[i] === '{') depth++;
      else if (block[i] === '}') { depth--; if (depth === 0) { braceClose = i; break; } }
    }
    if (braceClose < 0) return block;
    return block.slice(0, creditsStart) + creditsText + block.slice(braceClose + 1);
  }
  const closeIdx = block.lastIndexOf('}');
  if (closeIdx < 0) return block;
  const before = block.slice(0, closeIdx);
  const trimmed = before.replace(/\s+$/, '');
  const needsComma = !trimmed.endsWith(',');
  const prefix = needsComma ? ',\n' : '\n';
  return trimmed + prefix + indent + creditsText + '\n' + ' '.repeat(Math.max(indent.length - 4, 0)) + block.slice(closeIdx);
}

let changed = 0;
const log = [];
for (const rec of records) {
  const loc = findItemBlock(src, rec.id);
  if (!loc) { log.push(`SKIP ${rec.id}: not found`); continue; }
  const original = src.slice(loc.start, loc.end);
  const indent = detectIndent(original);
  let block = original;

  if (rec.releaseDate) block = upsertScalarField(block, indent, 'releaseDate', rec.releaseDate);
  if (rec.label)       block = upsertScalarField(block, indent, 'label', rec.label);
  if (rec.engineer || rec.musicians || rec.gear) {
    block = upsertCredits(block, indent, rec.engineer, rec.musicians, rec.gear);
  }

  if (block !== original) {
    src = src.slice(0, loc.start) + block + src.slice(loc.end);
    changed++;
    log.push(`UPDATE ${rec.id}`);
  }
}

console.log(log.join('\n'));
console.log(`\n${changed} items updated${DRY_RUN ? ' (dry run)' : ''}.`);

if (!DRY_RUN && changed > 0) {
  fs.writeFileSync(TS_FILE, src);
  console.log(`Wrote ${TS_FILE}`);
}
