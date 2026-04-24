#!/usr/bin/env node
/**
 * scripts/audit-thin-content.js
 *
 * Audit script to identify thin content across stories and portfolio pages.
 * Outputs a JSON report with content quality metrics per page.
 *
 * Usage:
 *   node scripts/audit-thin-content.js              # stdout (JSON)
 *   node scripts/audit-thin-content.js --summary    # human-readable summary
 *   node scripts/audit-thin-content.js --fail       # exit 1 if thin content found (CI mode)
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const storiesDirectory = path.join(process.cwd(), 'content/stories');
const portfolioFile = path.join(process.cwd(), 'data/portfolio.ts');

const THIN_CONTENT_THRESHOLD = 1500;
const SHORTCODE_CHAR_ESTIMATES = {
  'online-fallback': 120,
  'session-checklist': 420,
};

const args = process.argv.slice(2);
const showSummary = args.includes('--summary');
const ciMode = args.includes('--fail');

/**
 * Compute content score for a given raw markdown content string.
 * Returns { rawNonWhitespace, shortcodeBonus, total, isThin }.
 */
function scoreContent(content) {
  const rawNonWhitespace = content.replace(/\s+/g, '').length;
  const shortcodeBonus = [...content.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_CHAR_ESTIMATES[m[1]] ?? 80), 0);
  const total = rawNonWhitespace + shortcodeBonus;
  return { rawNonWhitespace, shortcodeBonus, total, isThin: total < THIN_CONTENT_THRESHOLD };
}

/**
 * Get all story slugs (unique, deduplicated across locales).
 */
function getAllStorySlugs() {
  if (!fs.existsSync(storiesDirectory)) {
    console.error(`Stories directory not found: ${storiesDirectory}`);
    return [];
  }

  const files = fs.readdirSync(storiesDirectory);
  const slugs = new Set();

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    // Strip locale suffix and extension: "slug.ko.md" -> "slug", "slug.md" -> "slug"
    let slug = file.replace(/\.md$/, '');
    slug = slug.replace(/\.(ko|en|zh|es|vi|th|uz)$/, '');
    slugs.add(slug);
  }

  return [...slugs].sort();
}

/**
 * Audit all stories and return results.
 */
function auditStories() {
  const slugs = getAllStorySlugs();
  const results = [];

  for (const slug of slugs) {
    // Check each locale
    const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
    for (const locale of locales) {
      let filePath = null;
      let sourceLocale = null;

      // Try locale-specific file first
      const localeFile = path.join(storiesDirectory, `${slug}.${locale}.md`);
      if (fs.existsSync(localeFile)) {
        filePath = localeFile;
        sourceLocale = locale;
      } else {
        // Fall back to default (no locale suffix)
        const defaultFile = path.join(storiesDirectory, `${slug}.md`);
        if (fs.existsSync(defaultFile)) {
          filePath = defaultFile;
          sourceLocale = 'ko';
        }
      }

      if (!filePath) continue;

      let score;
      let category = 'uncategorized';
      let robots = null;

      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(raw);
        score = scoreContent(content);
        category = data.category || 'uncategorized';
        robots = data.robots || null;
      } catch (err) {
        // YAML parsing failed — skip this file but note it
        results.push({
          type: 'story',
          slug,
          locale,
          sourceLocale,
          category: 'parse-error',
          rawNonWhitespace: 0,
          shortcodeBonus: 0,
          total: 0,
          isThin: true,
          robots: null,
          parseError: err.message.slice(0, 100),
        });
        continue;
      }

      results.push({
        type: 'story',
        slug,
        locale,
        sourceLocale,
        category,
        ...score,
        robots,
      });
    }
  }

  return results;
}

/**
 * Audit portfolio items for missing productionNotes.
 * Parses the portfolio.ts file to extract items without productionNotes.
 */
function auditPortfolio() {
  const results = [];

  if (!fs.existsSync(portfolioFile)) {
    console.error(`Portfolio file not found: ${portfolioFile}`);
    return results;
  }

  const raw = fs.readFileSync(portfolioFile, 'utf-8');

  // Extract portfolio item IDs and check for productionNotes
  // Pattern: "id": "some-id" followed by content block
  const idPattern = /"id":\s*"([^"]+)"/g;
  let match;

  while ((match = idPattern.exec(raw)) !== null) {
    const id = match[1];
    // Skip category IDs and track stubs
    if (['all', 'album', 'single', 'compilation', 'commercial', 'track-1', 'track-2', 'track-3'].includes(id)) {
      continue;
    }

    // Find the block for this ID and check for productionNotes
    const idIndex = match.index;
    // Look for the next "id" to bound the current item
    const nextIdMatch = raw.slice(idIndex + 1).match(/"id":\s*"/);
    const blockEnd = nextIdMatch ? idIndex + 1 + nextIdMatch.index : raw.length;
    const block = raw.slice(idIndex, blockEnd);

    const hasProductionNotes = block.includes('productionNotes');
    const hasCredits = block.includes('"credits"');
    const hasTrackList = block.includes('trackList');
    const hasReleaseDate = block.includes('releaseDate');
    const hasLabel = block.includes('"label"');
    const isFeatured = block.includes('"featured": true');

    // Estimate content: count characters in the block (rough proxy)
    const contentEstimate = block.replace(/\s+/g, '').length;

    results.push({
      type: 'portfolio',
      slug: id,
      locale: 'all',
      sourceLocale: 'all',
      category: block.match(/"category":\s*"([^"]+)"/) ? block.match(/"category":\s*"([^"]+)"/)[1] : 'unknown',
      hasProductionNotes,
      hasCredits,
      hasTrackList,
      hasReleaseDate,
      hasLabel,
      isFeatured,
      contentEstimate,
      // Portfolio is considered "thin" if it lacks productionNotes
      isThin: !hasProductionNotes,
    });
  }

  return results;
}

/**
 * Print human-readable summary.
 */
function printSummary(storyResults, portfolioResults) {
  const isNoindex = (r) => typeof r.robots === 'string' && /noindex/i.test(r.robots);
  const thinAll = storyResults.filter(r => r.isThin);
  const thinActionable = thinAll.filter(r => !isNoindex(r));
  const thinNoindex = thinAll.filter(isNoindex);
  const thinPortfolio = portfolioResults.filter(r => r.isThin);

  console.log('\n=== Thin Content Audit Summary ===\n');

  console.log(`Stories: ${storyResults.length} total, ${thinAll.length} under ${THIN_CONTENT_THRESHOLD} chars`);
  console.log(`  ├─ actionable (indexable & thin): ${thinActionable.length}`);
  console.log(`  └─ already noindex (safe to ignore): ${thinNoindex.length}`);
  console.log(`Portfolio: ${portfolioResults.length} total, ${thinPortfolio.length} without productionNotes\n`);

  if (thinActionable.length > 0) {
    console.log('--- Actionable Thin Stories (top 20) ---');
    thinActionable.slice(0, 20).forEach(r => {
      console.log(`  [${r.locale}] ${r.slug} (${r.category}) — ${r.total} chars`);
    });
    if (thinActionable.length > 20) {
      console.log(`  ... and ${thinActionable.length - 20} more`);
    }
    console.log();
  }

  if (thinPortfolio.length > 0) {
    console.log('--- Portfolio without productionNotes ---');
    thinPortfolio.forEach(r => {
      const featured = r.isFeatured ? ' [featured]' : '';
      console.log(`  ${r.slug} (${r.category})${featured}`);
    });
    console.log();
  }

  // Category breakdown
  const categoryBreakdown = {};
  storyResults.forEach(r => {
    if (!categoryBreakdown[r.category]) {
      categoryBreakdown[r.category] = { total: 0, thin: 0 };
    }
    categoryBreakdown[r.category].total++;
    if (r.isThin) categoryBreakdown[r.category].thin++;
  });

  console.log('--- Category Breakdown ---');
  Object.entries(categoryBreakdown)
    .sort((a, b) => b[1].thin - a[1].thin)
    .forEach(([cat, counts]) => {
      const pct = counts.total > 0 ? ((counts.thin / counts.total) * 100).toFixed(1) : '0.0';
      console.log(`  ${cat}: ${counts.thin}/${counts.total} thin (${pct}%)`);
    });
  console.log();
}

// Main
function main() {
  const storyResults = auditStories();
  const portfolioResults = auditPortfolio();

  if (showSummary) {
    printSummary(storyResults, portfolioResults);
  } else {
    // Output JSON
    const report = {
      timestamp: new Date().toISOString(),
      threshold: THIN_CONTENT_THRESHOLD,
      stories: storyResults,
      portfolio: portfolioResults,
      summary: {
        totalStories: storyResults.length,
        thinStories: storyResults.filter(r => r.isThin).length,
        totalPortfolio: portfolioResults.length,
        thinPortfolio: portfolioResults.filter(r => r.isThin).length,
      }
    };
    console.log(JSON.stringify(report, null, 2));
  }

  // CI mode: fail only on actionable thin content (indexable + thin).
  // Stories with `robots: noindex` in frontmatter are intentional and excluded.
  if (ciMode) {
    const isNoindex = (r) => typeof r.robots === 'string' && /noindex/i.test(r.robots);
    const actionableThinStories = storyResults.filter(r => r.isThin && !isNoindex(r)).length;
    const thinPortfolio = portfolioResults.filter(r => r.isThin).length;
    const thinCount = actionableThinStories + thinPortfolio;
    if (thinCount > 0) {
      console.error(`\nAudit failed: ${thinCount} actionable thin items (threshold: ${THIN_CONTENT_THRESHOLD} chars, excludes noindex)`);
      process.exit(1);
    }
  }
}

main();
