#!/usr/bin/env node
/**
 * suggest-internal-links.js
 *
 * 기사 본문을 스캔하여 topicLinks 레지스트리 기반의 자동 링크 삽입 효과를 시뮬레이션합니다.
 * MarkdownRenderer의 autoLinkKeywords와 동일한 로직으로 실행 결과를 리포트합니다.
 *
 * 사용법:
 *   node scripts/suggest-internal-links.js              # 전체 리포트
 *   node scripts/suggest-internal-links.js --stats      # 통계만
 *   node scripts/suggest-internal-links.js --target eq-guide1  # 특정 slug으로의 링크 목록
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');
const MAX_AUTO_LINKS = 3;

// data/internalLinks.ts에서 topicLinks 파싱 (간이 추출)
function loadTopicLinks() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'internalLinks.ts'), 'utf8');
  const links = {};
  const pattern = /'([^']+)':\s*\{\s*slug:\s*'([^']+)',\s*anchorText:\s*'([^']+)'/g;
  for (const m of src.matchAll(pattern)) {
    links[m[1]] = { slug: m[2], anchorText: m[3] };
  }
  return links;
}

function simulateAutoLink(body, currentSlug, topicLinks) {
  const sortedKeywords = Object.keys(topicLinks).sort((a, b) => b.length - a.length);
  const suggestions = [];
  const linkedSlugs = new Set();

  for (const keyword of sortedKeywords) {
    if (suggestions.length >= MAX_AUTO_LINKS) break;
    const { slug, anchorText } = topicLinks[keyword];
    if (slug === currentSlug) continue;
    if (linkedSlugs.has(slug)) continue;

    const idx = body.indexOf(keyword);
    if (idx === -1) continue;

    // Check if already inside a link
    const before50 = body.slice(Math.max(0, idx - 50), idx);
    const after50 = body.slice(idx + keyword.length, idx + keyword.length + 50);
    const isInsideLink = (before50.includes('[') && !before50.includes(']')) ||
                         (after50.includes(')') && !after50.includes('('));
    if (isInsideLink) continue;

    suggestions.push({ keyword, slug, anchorText });
    linkedSlugs.add(slug);
  }

  return suggestions;
}

function run() {
  const args = process.argv.slice(2);
  const statsOnly = args.includes('--stats');
  const targetIdx = args.indexOf('--target');
  const targetSlug = targetIdx >= 0 ? args[targetIdx + 1] : null;

  const topicLinks = loadTopicLinks();
  console.log('로드된 키워드: ' + Object.keys(topicLinks).length + '개\n');

  const files = fs.readdirSync(STORIES_DIR)
    .filter(f => f.endsWith('.md') && !f.match(/\.\w{2}\./));

  const results = { total: files.length, withSuggestions: 0, totalSuggestions: 0 };
  const linkTargetCounts = {}; // slug → number of files linking to it
  const allSuggestions = []; // For detailed output

  for (const file of files) {
    const slug = file.replace('.md', '');
    const content = fs.readFileSync(path.join(STORIES_DIR, file), 'utf8');
    const body = content.replace(/^---[\s\S]*?---\n/, '');

    const suggestions = simulateAutoLink(body, slug, topicLinks);

    if (suggestions.length > 0) {
      results.withSuggestions++;
      results.totalSuggestions += suggestions.length;

      for (const s of suggestions) {
        linkTargetCounts[s.slug] = (linkTargetCounts[s.slug] || 0) + 1;
      }

      if (!statsOnly) {
        allSuggestions.push({ slug, suggestions });
      }
    }
  }

  // Output
  if (targetSlug) {
    console.log('\n"' + targetSlug + '" 로의 자동 링크 삽입 대상:\n');
    for (const { slug, suggestions } of allSuggestions) {
      const match = suggestions.find(s => s.slug === targetSlug);
      if (match) console.log('  ' + slug + ' → 키워드 "' + match.keyword + '"');
    }
    return;
  }

  if (!statsOnly) {
    console.log('\n자동 링크 삽입 시뮬레이션 (기사당 최대 ' + MAX_AUTO_LINKS + '개):\n');
    for (const { slug, suggestions } of allSuggestions.slice(0, 30)) {
      console.log('  ' + slug + ':');
      for (const s of suggestions) {
        console.log('    → [' + s.anchorText + '](/stories/' + s.slug + ') (키워드: "' + s.keyword + '")');
      }
    }
    if (allSuggestions.length > 30) {
      console.log('  ... 외 ' + (allSuggestions.length - 30) + '개 파일\n');
    }
  }

  // Stats
  console.log('\n' + '='.repeat(50));
  console.log('자동 링크 삽입 통계:');
  console.log('  전체 파일: ' + results.total);
  console.log('  링크 삽입 대상: ' + results.withSuggestions + '개 (' + ((results.withSuggestions / results.total) * 100).toFixed(1) + '%)');
  console.log('  총 링크 수: ' + results.totalSuggestions + '개');
  console.log('  평균 링크/파일: ' + (results.totalSuggestions / (results.withSuggestions || 1)).toFixed(1) + '개');

  // Top targets
  const sorted = Object.entries(linkTargetCounts).sort((a, b) => b[1] - a[1]);
  console.log('\n링크 대상 분포 (상위 15):');
  for (const [slug, count] of sorted.slice(0, 15)) {
    const pct = ((count / results.total) * 100).toFixed(1);
    console.log('  /stories/' + slug + ': ' + count + '건 (' + pct + '%)');
  }

  // Check concentration
  const overConcentrated = sorted.filter(([, count]) => count / results.total > 0.15);
  if (overConcentrated.length > 0) {
    console.log('\n⚠️  집중도 경고 (15% 초과):');
    for (const [slug, count] of overConcentrated) {
      console.log('  /stories/' + slug + ': ' + count + '건 (' + ((count / results.total) * 100).toFixed(1) + '%)');
    }
  } else {
    console.log('\n✅ 링크 집중도 정상 (모든 slug 15% 이하)');
  }
}

run();
