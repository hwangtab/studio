#!/usr/bin/env node
/**
 * 전체 Lighthouse 카테고리(Performance / Accessibility / Best Practices / SEO) 점수 배치 측정.
 *
 * Performance는 pagespeed-audit.js가 담당. 이 스크립트는 나머지 3개 카테고리
 * 요약 + 주요 실패 항목을 표시한다.
 */

const fs = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';
const API_KEY = process.env.PAGESPEED_API_KEY || '';

const URLS = [
  `${SITE}/ko`,
  `${SITE}/ko/stories`,
  `${SITE}/ko/stories/ableton1`,
  `${SITE}/ko/contact`,
  `${SITE}/ko/pricing`,
  `${SITE}/ko/practice-room`,
  `${SITE}/ko/portfolio`,
];

const CATEGORIES = ['accessibility', 'best-practices', 'seo'];

const RESET = '\x1b[0m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', BOLD = '\x1b[1m', GRAY = '\x1b[90m';

function scoreColor(s) {
  if (s >= 90) return GREEN;
  if (s >= 50) return YELLOW;
  return RED;
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, (i + 1) * 5000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function audit(url) {
  const params = new URLSearchParams({ url, strategy: 'mobile', locale: 'ko' });
  CATEGORIES.forEach((c) => params.append('category', c));
  if (API_KEY) params.set('key', API_KEY);

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  const data = await fetchWithRetry(apiUrl);
  const lh = data.lighthouseResult || {};
  const cats = lh.categories || {};
  const audits = lh.audits || {};

  const scores = {};
  for (const c of CATEGORIES) {
    scores[c] = Math.round((cats[c]?.score ?? 0) * 100);
  }

  // 주요 실패 audit 추출
  const failingAudits = {};
  for (const c of CATEGORIES) {
    const auditRefs = cats[c]?.auditRefs || [];
    failingAudits[c] = auditRefs
      .filter((ref) => {
        const a = audits[ref.id];
        return a && a.score !== null && a.score < 1 && !a.scoreDisplayMode?.includes('notApplicable');
      })
      .map((ref) => ({
        id: ref.id,
        title: audits[ref.id]?.title,
        score: audits[ref.id]?.score,
      }));
  }

  return { url, scores, failingAudits };
}

function printResult(r) {
  console.log(`\n${BOLD}${r.url}${RESET}`);
  const line = CATEGORIES.map(c => {
    const s = r.scores[c];
    const label = c === 'best-practices' ? 'Best' : c === 'accessibility' ? 'A11y' : 'SEO';
    return `${label}:${scoreColor(s)}${s}${RESET}`;
  }).join('  ');
  console.log('  ' + line);

  for (const c of CATEGORIES) {
    const fails = r.failingAudits[c];
    if (!fails.length) continue;
    const label = c === 'best-practices' ? 'Best Practices' : c === 'accessibility' ? 'Accessibility' : 'SEO';
    console.log(`  ${GRAY}${label} 실패 (${fails.length}):${RESET}`);
    fails.slice(0, 5).forEach((f) => console.log(`    • ${f.id}: ${f.title}`));
  }
}

async function main() {
  console.log(`${BOLD}Lighthouse Accessibility/Best Practices/SEO Audit${RESET}`);
  console.log(`${GRAY}URLs: ${URLS.length}${RESET}\n`);

  const results = [];
  for (let i = 0; i < URLS.length; i++) {
    process.stdout.write(`${GRAY}[${i + 1}/${URLS.length}]${RESET} ${URLS[i]} `);
    try {
      const r = await audit(URLS[i]);
      results.push(r);
      process.stdout.write(GREEN + '✓' + RESET + '\n');
    } catch (err) {
      process.stdout.write(RED + '✗ ' + err.message + RESET + '\n');
    }
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log('\n' + '═'.repeat(80));
  console.log(BOLD + 'RESULTS' + RESET);
  console.log('═'.repeat(80));
  results.forEach(printResult);

  // 요약
  console.log('\n' + '═'.repeat(80));
  console.log(BOLD + '요약 (평균)' + RESET);
  const avg = {};
  for (const c of CATEGORIES) {
    const sum = results.reduce((a, r) => a + r.scores[c], 0);
    avg[c] = Math.round(sum / results.length);
  }
  CATEGORIES.forEach((c) => {
    const label = c === 'best-practices' ? 'Best Practices' : c === 'accessibility' ? 'Accessibility' : 'SEO';
    console.log(`  ${label.padEnd(20)}: ${scoreColor(avg[c])}${avg[c]}${RESET}`);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
