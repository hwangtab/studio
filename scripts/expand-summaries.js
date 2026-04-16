#!/usr/bin/env node
/**
 * expand-summaries.js
 * Expands frontmatter `summary` fields from ~80-100 chars to 120-150 chars
 * for SEO meta description optimization.
 *
 * Only processes Korean .md files (excludes .en., .zh., .es., .vi., .th., .uz.)
 * Skips files whose summary is already >= 120 chars.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const STORIES_DIR  = path.join(__dirname, '../content/stories');
const MIN_LEN      = 120;
const MAX_LEN      = 150;
const HARD_MAX_LEN = 195;

// Locale suffixes to exclude (Korean files must NOT have these in the filename)
const EXCLUDE_LOCALES = ['.en.', '.zh.', '.es.', '.vi.', '.th.', '.uz.'];

// ---------------------------------------------------------------------------
// Suffix tables
// ---------------------------------------------------------------------------
const INSTRUMENT_SUFFIXES = {
  bass:   ' 은평구 연신내 24시간 음악연습실에서 베이스 앰프와 방음 부스를 활용해 실전 연습하세요.',
  drum:   ' 은평구 연신내 24시간 음악연습실에서 드럼 킷 풀세트로 실전 연습하세요.',
  guitar: ' 은평구 연신내 24시간 음악연습실에서 기타 앰프와 방음 환경으로 실전 연습하세요.',
  vocal:  ' 은평구 연신내 24시간 음악연습실에서 마이크와 모니터 환경으로 보컬을 실전 연습하세요.',
  piano:  ' 은평구 연신내 24시간 음악연습실에서 피아노·키보드로 실전 연습하세요.',
};
const INSTRUMENT_FALLBACK = ' 은평구 연신내 24시간 음악연습실에서 최적의 환경으로 실전 연습하세요.';

const CATEGORY_SUFFIXES = {
  '악기 연습':    null, // handled separately via slug
  '지역 가이드':  ' Neumann U87AI 마이크와 10년 경력 엔지니어의 프리미엄 녹음 서비스를 합리적 요금으로 이용하세요.',
  '강좌':        ' 홈레코딩 환경에서도 바로 적용할 수 있는 실전 팁을 단계별로 정리합니다.',
  '음악 제작':    ' 스튜디오 놀 엔지니어의 실무 경험을 바탕으로 홈레코딩 환경에서 바로 적용할 수 있도록 정리합니다.',
  '녹음 가이드':  ' 스튜디오 녹음 전 준비사항부터 세션 후 파일 전달까지 연신내 스튜디오 놀의 실전 경험을 바탕으로 안내합니다.',
  '보컬 가이드':  ' 연신내 스튜디오 놀 보컬 엔지니어가 정리한 실전 팁으로 보컬 퍼포먼스를 끌어올리세요.',
  '음악 비즈니스': ' 음반 제작부터 유통까지 스튜디오 놀 엔지니어의 경험을 바탕으로 정리한 실용 가이드입니다.',
  '후기':        ' 스튜디오 놀에서의 실제 녹음·믹싱 경험을 바탕으로 한 생생한 후기입니다.',
  '믹싱·마스터링': ' 연신내 스튜디오 놀의 아날로그 하드웨어와 함께 최적의 믹싱·마스터링 결과물을 만들어 보세요.',
  '이벤트':       ' 스튜디오 놀에서 진행하는 뮤지션 네트워킹 및 커뮤니티 이벤트 안내입니다.',
};

const FALLBACK_SUFFIX = ' 연신내역 도보 5분, 방문 예약은 카카오톡으로 편하게 문의하세요.';

// ---------------------------------------------------------------------------
// Parse frontmatter — matches content-quality-check.js logic exactly
// ---------------------------------------------------------------------------
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const yaml = match[1];
  const result = {};

  const titleMatch    = yaml.match(/^title:\s*(.+)$/m);
  const categoryMatch = yaml.match(/^category:\s*(.+)$/m);
  if (titleMatch)    result.title    = titleMatch[1].trim().replace(/^['"]|['"]$/g, '');
  if (categoryMatch) result.category = categoryMatch[1].trim().replace(/^['"]|['"]$/g, '');

  // Summary — supports block scalar and inline
  const summaryBlockMatch = yaml.match(/^summary:\s*(?:>-|>|\|[-+]?)\n((?:  [^\n]*\n?)+)/m);
  if (summaryBlockMatch) {
    result.summary = summaryBlockMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    const summaryInlineMatch = yaml.match(/^summary:\s*(.+)$/m);
    if (summaryInlineMatch)
      result.summary = summaryInlineMatch[1].trim().replace(/^['"]|['"]$/g, '');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Determine instrument type from filename slug
// ---------------------------------------------------------------------------
function detectInstrument(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('bass') || lower.includes('베이스')) return 'bass';
  if (lower.includes('drum') || lower.includes('드럼'))   return 'drum';
  if (lower.includes('guitar') || lower.includes('기타')) return 'guitar';
  if (lower.includes('vocal') || lower.includes('보컬'))  return 'vocal';
  if (lower.includes('piano') || lower.includes('keyboard') ||
      lower.includes('피아노') || lower.includes('키보드')) return 'piano';
  return null;
}

// ---------------------------------------------------------------------------
// Pick suffix for a given category + filename
// ---------------------------------------------------------------------------
function pickSuffix(category, filename) {
  if (category === '악기 연습') {
    const inst = detectInstrument(filename);
    return inst ? INSTRUMENT_SUFFIXES[inst] : INSTRUMENT_FALLBACK;
  }
  return CATEGORY_SUFFIXES[category] || FALLBACK_SUFFIX;
}

// ---------------------------------------------------------------------------
// Build expanded summary
// ---------------------------------------------------------------------------
function buildExpanded(currentSummary, suffix) {
  let candidate = currentSummary.trim() + suffix;

  if (candidate.length > MAX_LEN) {
    // Try trimming the suffix by removing its last sentence
    const parts = suffix.split('.');
    if (parts.length > 2) {
      const shorterSuffix = parts.slice(0, -2).join('.') + '.';
      const shorterCandidate = currentSummary.trim() + shorterSuffix;
      if (shorterCandidate.length <= MAX_LEN) {
        candidate = shorterCandidate;
      } else {
        // Truncate at word-ish boundary (Korean: just truncate at MAX_LEN)
        candidate = candidate.slice(0, MAX_LEN);
      }
    } else {
      candidate = candidate.slice(0, MAX_LEN);
    }
  }

  if (candidate.length < MIN_LEN) {
    const withFallback = candidate + FALLBACK_SUFFIX;
    if (withFallback.length <= HARD_MAX_LEN) {
      candidate = withFallback.slice(0, MAX_LEN);
    }
    // If still < 120, accept as-is
  }

  return candidate;
}

// ---------------------------------------------------------------------------
// Replace summary in file content — handles all 3 YAML formats
// Returns new file content string.
//
// IMPORTANT: The replacement block must end with "\n" so the next YAML key
// (faq:, robots:, etc.) starts on a new line.
// We use a replacer function to avoid special-$ patterns in newSummary.
// ---------------------------------------------------------------------------
function replaceSummary(content, newSummary) {
  // The new block always ends with a newline so the next key is on its own line
  const newBlock = `summary: >-\n  ${newSummary}\n`;

  // 1. Block scalar (>-, >, |, |-, |+)
  //    Match "summary: >-\n" followed by one or more "  ...\n" lines.
  //    The block ends just before the first line that does NOT start with "  "
  //    (which would be the next top-level YAML key like "faq:" or "robots:").
  const blockRe = /^summary:\s*(?:>-|>|\|[-+]?)\n(?:  [^\n]*\n)*/m;
  if (blockRe.test(content)) {
    return content.replace(blockRe, () => newBlock);
  }

  // 2. Inline quoted  — "summary: "text"" or "summary: 'text'"
  const inlineQuotedRe = /^summary:\s*["'][^"'\n]*["']\s*$/m;
  if (inlineQuotedRe.test(content)) {
    return content.replace(inlineQuotedRe, () => newBlock.trimEnd());
  }

  // 3. Inline plain  — "summary: text without leading quote/block char"
  const inlinePlainRe = /^summary:\s*[^\n"'>|{[].+$/m;
  if (inlinePlainRe.test(content)) {
    return content.replace(inlinePlainRe, () => newBlock.trimEnd());
  }

  // Should not reach here; return original untouched
  return content;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const files = fs.readdirSync(STORIES_DIR).filter(f => {
    if (!f.endsWith('.md')) return false;
    // Exclude non-Korean locale files
    for (const loc of EXCLUDE_LOCALES) {
      if (f.includes(loc)) return false;
    }
    return true;
  });

  let expandedCount  = 0;
  let skippedCount   = 0;
  let errorCount     = 0;
  const samples      = [];
  const lengthBins   = { '0-79': 0, '80-99': 0, '100-119': 0, '120-139': 0, '140-159': 0, '160+': 0 };
  const overHardMax  = [];

  for (const filename of files) {
    const filepath = path.join(STORIES_DIR, filename);
    let content;
    try {
      content = fs.readFileSync(filepath, 'utf8');
    } catch (e) {
      console.error(`ERROR reading ${filename}: ${e.message}`);
      errorCount++;
      continue;
    }

    const fm = parseFrontmatter(content);
    if (!fm.summary) {
      skippedCount++;
      continue;
    }

    const origSummary = fm.summary;
    const origLen = origSummary.length;

    if (origLen >= MIN_LEN) {
      // Already long enough — track in bins as-is
      skippedCount++;
      const bin = origLen >= 160 ? '160+' : origLen >= 140 ? '140-159' : '120-139';
      lengthBins[bin]++;
      if (origLen > HARD_MAX_LEN) {
        overHardMax.push({ filename, len: origLen, summary: origSummary });
      }
      continue;
    }

    const category = fm.category || '';
    const suffix   = pickSuffix(category, filename);
    const newSummary = buildExpanded(origSummary, suffix);
    const newLen = newSummary.length;

    // Safety check
    if (newLen > HARD_MAX_LEN) {
      overHardMax.push({ filename, len: newLen, summary: newSummary });
    }

    // Track bin
    const bin =
      newLen < 80  ? '0-79'     :
      newLen < 100 ? '80-99'    :
      newLen < 120 ? '100-119'  :
      newLen < 140 ? '120-139'  :
      newLen < 160 ? '140-159'  : '160+';
    lengthBins[bin]++;

    // Write back
    const newContent = replaceSummary(content, newSummary);
    try {
      fs.writeFileSync(filepath, newContent, 'utf8');
    } catch (e) {
      console.error(`ERROR writing ${filename}: ${e.message}`);
      errorCount++;
      continue;
    }

    expandedCount++;

    // Collect samples (first 5 changed files)
    if (samples.length < 5) {
      samples.push({ filename, category, origSummary, origLen, newSummary, newLen });
    }

    if (expandedCount % 100 === 0) {
      process.stdout.write(`  ... ${expandedCount} files expanded so far\n`);
    }
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------
  console.log('\n==================================================');
  console.log('expand-summaries.js — RESULTS');
  console.log('==================================================');
  console.log(`Total Korean .md files scanned : ${files.length}`);
  console.log(`Files expanded                 : ${expandedCount}`);
  console.log(`Files skipped (already ≥120)   : ${skippedCount}`);
  console.log(`Errors                         : ${errorCount}`);
  console.log('');

  console.log('Length distribution AFTER expansion:');
  console.log(`  0–79   chars : ${lengthBins['0-79']}`);
  console.log(`  80–99  chars : ${lengthBins['80-99']}`);
  console.log(`  100–119 chars: ${lengthBins['100-119']}`);
  console.log(`  120–139 chars: ${lengthBins['120-139']}`);
  console.log(`  140–159 chars: ${lengthBins['140-159']}`);
  console.log(`  160+   chars : ${lengthBins['160+']}`);
  console.log('');

  if (overHardMax.length > 0) {
    console.log(`WARNING: ${overHardMax.length} summaries exceed ${HARD_MAX_LEN} chars!`);
    overHardMax.forEach(({ filename, len }) => console.log(`  ${filename} (${len} chars)`));
  } else {
    console.log(`Hard-max check (>${HARD_MAX_LEN} chars): 0 violations`);
  }

  console.log('');
  console.log('--- 5 Sample Before/After Pairs ---');
  samples.forEach(({ filename, category, origSummary, origLen, newSummary, newLen }, i) => {
    console.log(`\n[${i + 1}] ${filename} (${category})`);
    console.log(`  BEFORE (${origLen}): ${origSummary}`);
    console.log(`  AFTER  (${newLen}): ${newSummary}`);
  });

  console.log('\n==================================================\n');
}

main();
