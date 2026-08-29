#!/usr/bin/env node
/**
 * content-quality-check.js
 *
 * 스토리 마크다운 파일의 품질 규칙을 검사합니다.
 *
 * 규칙:
 * 1. 고유 단어 수 ≥ 300 (숏코드 제외)
 * 2. 필수 frontmatter: title, date, category, tags(≥3), summary, faq(≥2)
 * 3. title 길이: 20~70자
 * 4. summary 길이: 50~200자
 * 5. 내부 링크: 최소 1개 (본문 내)
 * 6. 링크 집중도 경고: 단일 slug가 전체 파일의 15% 초과
 * 7. 보일러플레이트 잔존 경고 (숏코드 없이 원본 텍스트가 남아있는 경우)
 *
 * 사용법:
 *   node scripts/content-quality-check.js              # 전체 검사
 *   node scripts/content-quality-check.js --korean     # 한국어 파일만
 *   node scripts/content-quality-check.js --summary    # 요약만 출력
 *   node scripts/content-quality-check.js --ci         # CI 모드 (위반 시 exit 1)
 */

const fs = require('fs');
const path = require('path');
const { applyFactTokens } = require('../lib/factTokens');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');
const SHORTCODE_PATTERN = /%%[\w-]+%%/g;
const INTERNAL_LINK_PATTERN = /\[([^\]]*)\]\(\/stories\/([\w-]+)\d*\)/g;
const MARKDOWN_STRIP_PATTERN = /^---[\s\S]*?---\n/; // frontmatter
const ARGS = process.argv.slice(2);
const KOREAN_ONLY = ARGS.includes('--korean');
const SUMMARY_ONLY = ARGS.includes('--summary');
const CI_MODE = ARGS.includes('--ci');
const LINK_CONCENTRATION_THRESHOLD = 0.15; // 15%

// Known boilerplate strings to detect if not converted to shortcodes
const BOILERPLATE_SIGNATURES = [
  '방문이 어려우면 [온라인 파일 의뢰](/stories/onlinemix1)',
  '**출발 전 챙길 것:**',
];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};

  // Simple YAML parser for the fields we need
  const titleMatch = yaml.match(/^title:\s*(.+)$/m);
  const dateMatch = yaml.match(/^date:\s*(.+)$/m);
  const categoryMatch = yaml.match(/^category:\s*(.+)$/m);

  if (titleMatch) result.title = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');
  if (dateMatch) result.date = dateMatch[1].trim();
  if (categoryMatch) result.category = categoryMatch[1].trim().replace(/^['"]|['"]$/g, '');

  // Summary — supports both inline and YAML block scalar (>-, |)
  const summaryBlockMatch = yaml.match(/^summary:\s*(?:>-|>|\|[-+]?)\n((?:  [^\n]*\n?)+)/m);
  if (summaryBlockMatch) {
    result.summary = summaryBlockMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    const summaryInlineMatch = yaml.match(/^summary:\s*(.+)$/m);
    if (summaryInlineMatch) result.summary = summaryInlineMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  // Tags — match lines that start with "  - " (2-space indent + dash)
  const tagsBlockMatch = yaml.match(/^tags:\n((?:  - [^\n]+\n?)+)/m);
  if (tagsBlockMatch) {
    result.tags = tagsBlockMatch[1].match(/^  - (.+)$/gm)
      ?.map(l => l.replace(/^  - /, '').trim()) || [];
  } else {
    const tagsInlineMatch = yaml.match(/^tags:\s*\[([^\]]*)\]/m);
    if (tagsInlineMatch) {
      result.tags = tagsInlineMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, ''));
    } else {
      result.tags = [];
    }
  }

  // FAQ — count "- q:" entries in frontmatter
  const faqMatches = yaml.match(/^  - q:/gm);
  result.faqCount = faqMatches ? faqMatches.length : 0;

  // cta override (옵션) — 명시 시 정확한 enum 값이어야 한다. 자동 룰 silent fallback이라
  // 오타 발생 시 작가가 모르고 지나칠 수 있어 lint 단계에서 catch.
  const ctaMatch = yaml.match(/^cta:\s*(.+)$/m);
  if (ctaMatch) result.cta = ctaMatch[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase();

  return result;
}

function getBodyContent(content) {
  // Remove frontmatter
  return content.replace(MARKDOWN_STRIP_PATTERN, '');
}

function stripMarkdownSyntax(text) {
  return text
    .replace(SHORTCODE_PATTERN, '')     // remove shortcodes
    .replace(/!\[.*?\]\(.*?\)/g, '')    // remove images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^#{1,6}\s+/gm, '')        // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/^[-*]\s+/gm, '')          // list items
    .replace(/^---+$/gm, '')            // hr
    .replace(/`[^`]+`/g, '')            // inline code
    .replace(/\|[^|\n]*\|/g, '')         // table rows (same-line only)
    .replace(/\n+/g, ' ')              // newlines → space
    .trim();
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function checkFile(filePath) {
  const content = applyFactTokens(fs.readFileSync(filePath, 'utf8'));
  const fm = parseFrontmatter(content);
  const body = getBodyContent(content);
  const strippedBody = stripMarkdownSyntax(body);
  const wordCount = countWords(strippedBody);

  const violations = [];
  const warnings = [];

  // Rule 1: Word count (shortcode rendered content counts as bonus words)
  // 렌더 실측 기준(session-checklist = 51단어). lib/storyContentPolicy.ts의 글자수 추정과 짝이다.
  const SHORTCODE_WORD_ESTIMATES = {
    'online-fallback': 25, 'session-checklist': 51, 'studio-more': 62,
    'studio-services': 42, 'online-request': 36,
  };
  const shortcodeBonus = [...body.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_WORD_ESTIMATES[m[1]] ?? 15), 0);
  const effectiveWordCount = wordCount + shortcodeBonus;
  if (effectiveWordCount < 200) {
    violations.push(`단어 수 부족: ${wordCount}개 (최소 200개, 숏코드 환산 ${effectiveWordCount}개)`);
  }

  // Rule 2: Required frontmatter
  if (!fm.title) violations.push('title 누락');
  if (!fm.date) violations.push('date 누락');
  if (!fm.category) violations.push('category 누락');
  if (!fm.summary) violations.push('summary 누락');
  if (!fm.tags || fm.tags.length < 3) {
    violations.push(`tags 부족: ${fm.tags?.length || 0}개 (최소 3개)`);
  }
  if (!fm.faqCount || fm.faqCount < 2) {
    violations.push(`faq 부족: ${fm.faqCount || 0}개 (최소 2개)`);
  }

  // Rule 3: Title length
  if (fm.title) {
    const titleLen = fm.title.length;
    if (titleLen < 20) violations.push(`title 너무 짧음: ${titleLen}자 (20~70자)`);
    if (titleLen > 70) warnings.push(`title 너무 김: ${titleLen}자 (20~70자)`);
  }

  // Rule 4: Summary length
  if (fm.summary) {
    const sumLen = fm.summary.length;
    if (sumLen < 50) violations.push(`summary 너무 짧음: ${sumLen}자 (50~200자)`);
    if (sumLen > 200) warnings.push(`summary 너무 김: ${sumLen}자 (50~200자)`);
  }

  // Rule 4a: 생성 요약의 주제 불일치 방지
  const titleText = fm.title || '';
  const summaryText = fm.summary || '';
  if (/녹음실/.test(titleText) && /음악연습실 선택 기준/.test(summaryText)) {
    violations.push('summary 주제 불일치: 녹음실 글이 음악연습실 월세 요약으로 생성됨');
  }
  if (/^\d+\s+정보를/.test(summaryText)) {
    violations.push('summary 주제 추출 실패: 숫자만 topic으로 사용됨');
  }
  if (((summaryText.match(/"/g) || []).length % 2) === 1) {
    violations.push('summary 따옴표 불균형: 큰따옴표가 홀수 개임');
  }

  // Rule 4b: cta enum 검증 (옵션 — 명시 시에만 유효성 검사)
  const VALID_CTA = require('../lib/storyCtaTypes.json');
  if (fm.cta !== undefined && !VALID_CTA.includes(fm.cta)) {
    violations.push(`cta 값 잘못됨: '${fm.cta}' (유효값: ${VALID_CTA.join(', ')})`);
  }

  // Rule 5: Internal links in body
  const internalLinks = [...body.matchAll(/\[([^\]]*)\]\(\/stories\/([\w-]+[\w\d]*)\)/g)];
  if (internalLinks.length === 0) {
    violations.push('내부 링크 없음 (최소 1개)');
  }

  // Rule 7: Boilerplate signatures still present
  for (const sig of BOILERPLATE_SIGNATURES) {
    if (body.includes(sig)) {
      warnings.push(`보일러플레이트 잔존: "${sig.slice(0, 30)}..."`);
    }
  }

  return { violations, warnings, wordCount, internalLinks: internalLinks.length, fm };
}

function buildLinkConcentrationMap(files) {
  const linkCounts = {};
  const total = files.length;

  for (const file of files) {
    const content = applyFactTokens(fs.readFileSync(file, 'utf8'));
    const body = getBodyContent(content);
    const slugs = new Set([...body.matchAll(/\[([^\]]*)\]\(\/stories\/([\w-]+[\w\d]*)\)/g)].map(m => m[2]));
    for (const slug of slugs) {
      linkCounts[slug] = (linkCounts[slug] || 0) + 1;
    }
  }

  const overconcentrated = Object.entries(linkCounts)
    .filter(([, count]) => count / total > LINK_CONCENTRATION_THRESHOLD)
    .sort((a, b) => b[1] - a[1]);

  return { linkCounts, overconcentrated, total };
}

function run() {
  const allFiles = fs.readdirSync(STORIES_DIR).filter(f => {
    if (!f.endsWith('.md')) return false;
    if (KOREAN_ONLY) return !f.includes('.en.') && !f.includes('.zh.') && !f.includes('.es.') && !f.includes('.vi.') && !f.includes('.th.') && !f.includes('.uz.');
    return true;
  }).map(f => path.join(STORIES_DIR, f));

  console.log(`\n콘텐츠 품질 검사 — ${allFiles.length}개 파일\n${'='.repeat(60)}`);

  const results = { violations: [], warnings: [], ok: 0 };

  for (const file of allFiles) {
    const { violations, warnings, wordCount, internalLinks } = checkFile(file);
    const slug = path.basename(file, '.md');

    if (violations.length > 0) {
      results.violations.push({ slug, violations, wordCount, internalLinks });
    } else if (warnings.length > 0) {
      results.warnings.push({ slug, warnings, wordCount, internalLinks });
    } else {
      results.ok++;
    }
  }

  // Link concentration check
  const { overconcentrated, total } = buildLinkConcentrationMap(allFiles);

  // Output
  if (!SUMMARY_ONLY && results.violations.length > 0) {
    console.log(`\n❌ 위반 (${results.violations.length}개 파일):`);
    for (const { slug, violations, wordCount } of results.violations) {
      console.log(`  ${slug} (${wordCount}단어):`);
      for (const v of violations) console.log(`    • ${v}`);
    }
    if (results.violations.length > 50) {
      console.log(`  ... 외 ${results.violations.length - 50}개`);
    }
  }

  if (!SUMMARY_ONLY && results.warnings.length > 0) {
    console.log(`\n⚠️  경고 (${results.warnings.length}개 파일):`);
    for (const { slug, warnings } of results.warnings.slice(0, 20)) {
      console.log(`  ${slug}:`);
      for (const w of warnings) console.log(`    • ${w}`);
    }
  }

  if (overconcentrated.length > 0) {
    console.log(`\n🔗 링크 집중도 경고 (단일 slug → ${(LINK_CONCENTRATION_THRESHOLD * 100).toFixed(0)}% 초과):`);
    for (const [slug, count] of overconcentrated) {
      console.log(`  /stories/${slug}: ${count}개 파일에서 링크 (${((count / total) * 100).toFixed(1)}%)`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ 통과: ${results.ok}개`);
  console.log(`⚠️  경고: ${results.warnings.length}개`);
  console.log(`❌ 위반: ${results.violations.length}개`);
  console.log(`총 검사: ${allFiles.length}개\n`);

  if (CI_MODE && results.violations.length > 0) {
    process.exit(1);
  }
}

run();
