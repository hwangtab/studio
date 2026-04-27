#!/usr/bin/env node
/**
 * 한국어 원본 스토리 frontmatter 형식을 통일한다.
 *
 *  변환 규칙:
 *   1. date — 모든 변종을 `YYYY-MM-DD` (bare, no quotes)로 통일
 *      - `2026-04-06T00:00:00.000Z` → `2026-04-06`
 *      - `'2026-04-06'` → `2026-04-06`
 *      - `"2026-04-06"` → `2026-04-06`
 *   2. category — 외부 따옴표 제거 (값 자체는 보존)
 *      - `category: "강좌"` → `category: 강좌`
 *      - `category: '강좌'` → `category: 강좌`
 *
 *  스코프: content/stories/ 의 한국어 원본(.md, locale suffix 없음)만 대상.
 *  번역본(.en.md, .zh.md, ...)은 손대지 않는다.
 *
 *  안전성: gray-matter는 모든 변종을 동일하게 파싱하므로 런타임 동작 변화 없음.
 *  순수 cosmetic + 향후 lint·일괄 작업의 토대.
 *
 *  사용:
 *   node scripts/normalizeStoryFrontmatter.js          # dry-run + 요약
 *   node scripts/normalizeStoryFrontmatter.js --apply  # 실제 적용
 *   node scripts/normalizeStoryFrontmatter.js --apply --files file1.md,file2.md  # 일부만
 */
const fs = require('node:fs');
const path = require('node:path');

const STORIES_DIR = path.join(process.cwd(), 'content', 'stories');
const LOCALE_SUFFIX_RE = /\.(en|zh|es|vi|th|uz)\.md$/;

const apply = process.argv.includes('--apply');
const filesArgIdx = process.argv.indexOf('--files');
const explicitFiles = filesArgIdx >= 0 ? process.argv[filesArgIdx + 1].split(',') : null;

const isFrontmatterBoundary = (line) => /^---\s*$/.test(line);

const normalizeDateLine = (line) => {
  // `date: ...` 라인 매칭. 따옴표·ISO 자정시간을 모두 bare YYYY-MM-DD로.
  const m = line.match(/^(date:\s*)(['"]?)(\d{4}-\d{2}-\d{2})(?:T00:00:00\.000Z)?\2(\s*)$/);
  if (!m) return line;
  return `${m[1]}${m[3]}${m[4]}`;
};

const normalizeCategoryLine = (line) => {
  const m = line.match(/^(category:\s*)(['"])([^'"\n]+)\2(\s*)$/);
  if (!m) return line;
  return `${m[1]}${m[3]}${m[4]}`;
};

const transformFile = (rawText) => {
  const lines = rawText.split(/\r?\n/);
  let inFrontmatter = false;
  let boundaryCount = 0;
  const changes = { date: 0, category: 0 };

  for (let i = 0; i < lines.length; i++) {
    if (isFrontmatterBoundary(lines[i])) {
      boundaryCount += 1;
      inFrontmatter = boundaryCount === 1; // 두 번째 --- 만나면 종료
      if (boundaryCount === 1) inFrontmatter = true;
      else if (boundaryCount === 2) inFrontmatter = false;
      continue;
    }
    if (!inFrontmatter) continue;

    const original = lines[i];
    let next = normalizeDateLine(original);
    if (next !== original) changes.date += 1;
    const after = normalizeCategoryLine(next);
    if (after !== next) changes.category += 1;
    lines[i] = after;
  }

  return { newText: lines.join('\n'), changes };
};

const listKoreanFiles = () => {
  if (explicitFiles) return explicitFiles;
  return fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md') && !LOCALE_SUFFIX_RE.test(f));
};

const main = () => {
  const files = listKoreanFiles();
  let changedFiles = 0;
  let totalDate = 0;
  let totalCategory = 0;
  const samples = [];

  for (const file of files) {
    const filePath = path.join(STORIES_DIR, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const { newText, changes } = transformFile(raw);

    if (changes.date === 0 && changes.category === 0) continue;

    changedFiles += 1;
    totalDate += changes.date;
    totalCategory += changes.category;
    if (samples.length < 5) samples.push({ file, changes });

    if (apply && newText !== raw) {
      fs.writeFileSync(filePath, newText, 'utf8');
    }
  }

  console.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] processed ${files.length} files`);
  console.log(`  변경된 파일: ${changedFiles}`);
  console.log(`  date 라인 변환: ${totalDate}`);
  console.log(`  category 라인 변환: ${totalCategory}`);
  if (samples.length > 0) {
    console.log('  샘플 변경 파일:');
    for (const s of samples) {
      console.log(`    - ${s.file} (date:${s.changes.date} category:${s.changes.category})`);
    }
  }
  if (!apply) console.log('\n  --apply 플래그를 추가하면 실제로 파일을 수정합니다.');
};

main();
