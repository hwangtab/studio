#!/usr/bin/env node
/**
 * PageSpeed Insights 배치 측정 스크립트
 *
 * 사용법:
 *   node scripts/pagespeed-audit.js
 *   node scripts/pagespeed-audit.js --desktop-only
 *   node scripts/pagespeed-audit.js --mobile-only
 *
 * 환경 변수:
 *   PAGESPEED_API_KEY  (.env.local)  - 선택, 없으면 익명 호출
 */

const fs = require('node:fs');
const path = require('node:path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
} catch {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://studionol.co.kr';
const API_KEY = process.env.PAGESPEED_API_KEY || '';

const URLS = [
  `${SITE}/`,
  `${SITE}/ko`,
  `${SITE}/en`,
  `${SITE}/ko/stories`,
  `${SITE}/ko/contact`,
  `${SITE}/ko/stories/ableton1`,
  `${SITE}/ko/stories/acoustic-recording1`,
  `${SITE}/en/stories/ableton1`,
];

const args = process.argv.slice(2);
const strategies = args.includes('--desktop-only') ? ['desktop']
  : args.includes('--mobile-only') ? ['mobile']
  : ['mobile', 'desktop'];

const RESET = '\x1b[0m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RED = '\x1b[31m', BOLD = '\x1b[1m', GRAY = '\x1b[90m';

const THRESHOLDS = {
  LCP:  { good: 2500,  poor: 4000  },
  INP:  { good: 200,   poor: 500   },
  CLS:  { good: 0.1,   poor: 0.25  },
  FCP:  { good: 1800,  poor: 3000  },
  TTFB: { good: 800,   poor: 1800  },
};

function grade(metric, value) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  const t = THRESHOLDS[metric];
  if (!t) return '—';
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'ni';
  return 'poor';
}

function color(grade, text) {
  if (grade === 'good') return GREEN + text + RESET;
  if (grade === 'ni')   return YELLOW + text + RESET;
  if (grade === 'poor') return RED + text + RESET;
  return GRAY + text + RESET;
}

function fmtMs(v)   { return v == null ? '—' : (v / 1000).toFixed(2) + 's'; }
function fmtMsRaw(v){ return v == null ? '—' : Math.round(v) + 'ms'; }
function fmtCls(v)  { return v == null ? '—' : v.toFixed(3); }

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = (i + 1) * 5000;
        console.log(GRAY + `  rate limited, waiting ${wait / 1000}s...` + RESET);
        await new Promise(r => setTimeout(r, wait));
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

async function audit(url, strategy) {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'performance',
    locale: 'ko',
  });
  if (API_KEY) params.set('key', API_KEY);

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  const data = await fetchWithRetry(apiUrl);

  const lh = data.lighthouseResult || {};
  const audits = lh.audits || {};
  const score = Math.round((lh.categories?.performance?.score ?? 0) * 100);

  const lab = {
    LCP: audits['largest-contentful-paint']?.numericValue,
    CLS: audits['cumulative-layout-shift']?.numericValue,
    FCP: audits['first-contentful-paint']?.numericValue,
    TTFB: audits['server-response-time']?.numericValue,
    TBT: audits['total-blocking-time']?.numericValue,
    SI: audits['speed-index']?.numericValue,
  };

  const fld = data.loadingExperience?.metrics || {};
  const originFld = data.originLoadingExperience?.metrics || {};
  const fieldSource = Object.keys(fld).length ? 'url' : (Object.keys(originFld).length ? 'origin' : 'none');
  const source = fieldSource === 'url' ? fld : originFld;

  const field = {
    LCP: source.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
    INP: source.INTERACTION_TO_NEXT_PAINT?.percentile,
    CLS: source.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile / 100 || null,
    FCP: source.FIRST_CONTENTFUL_PAINT_MS?.percentile,
    TTFB: source.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile,
  };

  const topOpportunities = Object.values(audits)
    .filter(a => a.details?.type === 'opportunity' && a.numericValue > 100)
    .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
    .slice(0, 3)
    .map(a => `${a.title} (${fmtMs(a.numericValue)})`);

  return { url, strategy, score, lab, field, fieldSource, topOpportunities };
}

function printResult(r) {
  const scoreColor = r.score >= 90 ? GREEN : r.score >= 50 ? YELLOW : RED;
  console.log(`\n${BOLD}${r.url}${RESET}  ${GRAY}[${r.strategy}]${RESET}  ${scoreColor}Performance ${r.score}${RESET}`);

  const fieldTag = r.fieldSource === 'url' ? GREEN + 'URL' + RESET
    : r.fieldSource === 'origin' ? YELLOW + 'ORIGIN' + RESET
    : GRAY + 'NONE' + RESET;
  console.log(`  ${GRAY}Field(CrUX 28d) [${fieldTag}${GRAY}]${RESET}`);

  const metrics = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
  const fieldLine = metrics.map(m => {
    const v = r.field[m];
    const fmt = m === 'CLS' ? fmtCls(v) : m === 'INP' ? fmtMsRaw(v) : fmtMs(v);
    return `${m}:${color(grade(m, v), fmt)}`;
  }).join('  ');
  console.log('    ' + fieldLine);

  console.log(`  ${GRAY}Lab(Lighthouse)${RESET}`);
  const labLine = ['LCP', 'CLS', 'FCP', 'TTFB'].map(m => {
    const v = r.lab[m];
    const fmt = m === 'CLS' ? fmtCls(v) : fmtMs(v);
    return `${m}:${color(grade(m, v), fmt)}`;
  }).join('  ') + `  ${GRAY}TBT:${fmtMsRaw(r.lab.TBT)}  SI:${fmtMs(r.lab.SI)}${RESET}`;
  console.log('    ' + labLine);

  if (r.topOpportunities.length) {
    console.log(`  ${GRAY}주요 개선 기회${RESET}`);
    r.topOpportunities.forEach(o => console.log('    • ' + o));
  }
}

function toCsvRow(r) {
  const cells = [
    r.url,
    r.strategy,
    r.score,
    r.fieldSource,
    r.field.LCP ?? '',
    r.field.INP ?? '',
    r.field.CLS?.toFixed(3) ?? '',
    r.field.FCP ?? '',
    r.field.TTFB ?? '',
    r.lab.LCP ? Math.round(r.lab.LCP) : '',
    r.lab.CLS?.toFixed(3) ?? '',
    r.lab.FCP ? Math.round(r.lab.FCP) : '',
    r.lab.TTFB ? Math.round(r.lab.TTFB) : '',
    r.lab.TBT ? Math.round(r.lab.TBT) : '',
    r.lab.SI ? Math.round(r.lab.SI) : '',
  ];
  return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
}

async function main() {
  console.log(`${BOLD}PageSpeed Insights Audit${RESET}  ${GRAY}(${API_KEY ? 'API key ✓' : 'no key'})${RESET}`);
  console.log(`${GRAY}Site: ${SITE}  |  URLs: ${URLS.length}  |  Strategies: ${strategies.join(', ')}${RESET}\n`);

  const results = [];
  let idx = 0;
  const total = URLS.length * strategies.length;

  for (const url of URLS) {
    for (const strategy of strategies) {
      idx++;
      process.stdout.write(`${GRAY}[${idx}/${total}]${RESET} ${strategy.padEnd(7)} ${url} `);
      try {
        const r = await audit(url, strategy);
        results.push(r);
        process.stdout.write(GREEN + '✓' + RESET + '\n');
      } catch (err) {
        process.stdout.write(RED + '✗ ' + err.message + RESET + '\n');
      }
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(BOLD + 'RESULTS' + RESET);
  console.log('═'.repeat(80));
  results.forEach(printResult);

  const reportsDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const csvPath = path.join(reportsDir, `pagespeed-${stamp}.csv`);

  const header = [
    'url', 'strategy', 'perf_score', 'field_source',
    'field_LCP_ms', 'field_INP_ms', 'field_CLS', 'field_FCP_ms', 'field_TTFB_ms',
    'lab_LCP_ms', 'lab_CLS', 'lab_FCP_ms', 'lab_TTFB_ms', 'lab_TBT_ms', 'lab_SI_ms',
  ].join(',');
  fs.writeFileSync(csvPath, header + '\n' + results.map(toCsvRow).join('\n') + '\n');

  console.log(`\n${GREEN}✓${RESET} CSV 저장: ${path.relative(process.cwd(), csvPath)}`);

  const sum = (arr, k) => arr.reduce((a, r) => a + (r[k] || 0), 0);
  const mobileResults = results.filter(r => r.strategy === 'mobile');
  if (mobileResults.length) {
    const avgScore = Math.round(sum(mobileResults, 'score') / mobileResults.length);
    const urlFieldCount = mobileResults.filter(r => r.fieldSource === 'url').length;
    console.log(`\n${BOLD}요약 (모바일):${RESET}`);
    console.log(`  평균 점수: ${avgScore}`);
    console.log(`  URL 단위 CrUX 있음: ${urlFieldCount}/${mobileResults.length} (나머지는 origin 폴백 또는 데이터 없음)`);
  }
}

main().catch((err) => {
  console.error(RED + 'Fatal:' + RESET, err);
  process.exit(1);
});
