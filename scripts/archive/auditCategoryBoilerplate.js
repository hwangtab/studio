#!/usr/bin/env node
/**
 * 카테고리별 thin-content / boilerplate 진단.
 *
 *  목적: 동일 카테고리 안에서 텍스트 블록이 얼마나 중복되는지 측정해
 *  Phase 0(지역 가이드)와 같은 진짜 doorway 패턴을 색출한다.
 *  악기 연습 footer처럼 "헤더만 같고 본문은 unique"한 case는 제외해야 한다.
 *
 *  측정 단위:
 *   1. 섹션(H2/H3) — 헤더 + 본문 전체를 hash해 동일 텍스트가 N개 파일에 등장하는지
 *   2. 라인 — 60자 이상 bullet/문단 라인을 hash해 동일 라인이 등장하는 파일 수
 *
 *  Boilerplate 정의:
 *   - 같은 카테고리 안에서 동일 섹션이 5개 이상 파일에 등장
 *   - 같은 카테고리 안에서 동일 라인이 10개 이상 파일에 등장
 *
 *  파일별 boilerplate 비율 = (boilerplate 라인 합계 글자수) / (전체 본문 글자수)
 *
 *  사용:
 *   node scripts/auditCategoryBoilerplate.js                # 모든 카테고리
 *   node scripts/auditCategoryBoilerplate.js --category="보컬 가이드"
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STORIES_DIR = path.join(process.cwd(), 'content', 'stories');
const LOCALE_SUFFIX_RE = /\.(en|zh|es|vi|th|uz)\.md$/;
const TARGET_CATEGORIES = ['보컬 가이드', '녹음 가이드', '믹싱·마스터링', '음악 제작', '음악 비즈니스'];
const SECTION_THRESHOLD = 5;   // 동일 섹션이 N개 파일에 등장 시 boilerplate
const LINE_THRESHOLD = 10;     // 동일 라인이 N개 파일에 등장 시 boilerplate
const MIN_LINE_LEN = 60;       // 너무 짧은 공통 라인은 제외 (markdown 구문, 빈 항목 등)

const argCategory = (() => {
  const arg = process.argv.find((a) => a.startsWith('--category='));
  if (!arg) return null;
  return arg.split('=', 2)[1].replace(/^['"]|['"]$/g, '');
})();

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

const stripFrontmatter = (raw) => {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { fm: '', body: raw };
  return { fm: m[1], body: m[2] };
};

const getCategory = (fm) => {
  const m = fm.match(/^category:\s*(.+?)\s*$/m);
  return m ? m[1].trim() : null;
};

const splitSections = (body) => {
  // ## 또는 ### 헤더로 분할. 첫 헤더 이전 텍스트는 'preface'로.
  const sections = [];
  const lines = body.split('\n');
  let current = { header: null, lines: [] };
  for (const line of lines) {
    if (/^#{2,3}\s+/.test(line)) {
      if (current.header || current.lines.length > 0) sections.push(current);
      current = { header: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.header || current.lines.length > 0) sections.push(current);
  return sections.map((s) => ({
    header: s.header,
    body: s.lines.join('\n').trim(),
    full: ((s.header ? s.header + '\n' : '') + s.lines.join('\n')).trim(),
  }));
};

const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();

const main = () => {
  const files = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md') && !LOCALE_SUFFIX_RE.test(f));

  // 1단계: 파일별 메타·섹션·라인 추출
  const fileEntries = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(STORIES_DIR, file), 'utf8');
    const { fm, body } = stripFrontmatter(raw);
    const cat = getCategory(fm);
    if (!cat) continue;
    if (argCategory && cat !== argCategory) continue;
    if (!argCategory && !TARGET_CATEGORIES.includes(cat)) continue;

    const sections = splitSections(body);
    const longLines = body
      .split('\n')
      .map(normalizeLine)
      .filter((l) => l.length >= MIN_LINE_LEN);

    fileEntries.push({
      file,
      category: cat,
      bodyChars: body.replace(/\s+/g, '').length,
      sections,
      longLines,
    });
  }

  // 2단계: 카테고리별 grouping
  const byCategory = new Map();
  for (const e of fileEntries) {
    if (!byCategory.has(e.category)) byCategory.set(e.category, []);
    byCategory.get(e.category).push(e);
  }

  // 3단계: 카테고리별 boilerplate 식별
  const reportPerCategory = [];
  for (const [cat, entries] of byCategory) {
    // 섹션 hash → {hash, header, count, fullText}
    const sectionMap = new Map();
    for (const e of entries) {
      for (const sec of e.sections) {
        if (!sec.full || sec.full.length < 80) continue;
        const h = sha(sec.full.replace(/\s+/g, ' '));
        if (!sectionMap.has(h)) {
          sectionMap.set(h, { hash: h, header: sec.header, sample: sec.full.slice(0, 200), count: 0, charLen: sec.full.length });
        }
        sectionMap.get(h).count += 1;
      }
    }
    const boilerSections = [...sectionMap.values()]
      .filter((s) => s.count >= SECTION_THRESHOLD)
      .sort((a, b) => b.count - a.count);

    // 라인 hash → {line, count}
    const lineMap = new Map();
    for (const e of entries) {
      const seen = new Set();
      for (const l of e.longLines) {
        const h = sha(l);
        if (seen.has(h)) continue;  // 같은 파일 안 중복은 1회로 카운트
        seen.add(h);
        if (!lineMap.has(h)) lineMap.set(h, { line: l, count: 0 });
        lineMap.get(h).count += 1;
      }
    }
    const boilerLines = [...lineMap.values()]
      .filter((l) => l.count >= LINE_THRESHOLD)
      .sort((a, b) => b.count - a.count);

    const boilerLineSet = new Set(boilerLines.map((l) => sha(l.line)));

    // 파일별 boilerplate 비율 = boilerplate 라인이 차지하는 글자 비율
    const fileRatios = entries.map((e) => {
      const boilerChars = e.longLines
        .filter((l) => boilerLineSet.has(sha(l)))
        .reduce((sum, l) => sum + l.length, 0);
      const totalChars = e.bodyChars || 1;
      return {
        file: e.file,
        ratio: boilerChars / (totalChars + boilerChars),  // 분모는 전체 본문
        boilerChars,
        totalChars,
      };
    }).sort((a, b) => b.ratio - a.ratio);

    const avgRatio = fileRatios.reduce((s, r) => s + r.ratio, 0) / (fileRatios.length || 1);

    reportPerCategory.push({
      category: cat,
      fileCount: entries.length,
      boilerSectionCount: boilerSections.length,
      boilerLineCount: boilerLines.length,
      avgBoilerplateRatio: avgRatio,
      topSections: boilerSections.slice(0, 5),
      topLines: boilerLines.slice(0, 8),
      worstFiles: fileRatios.slice(0, 5),
    });
  }

  // 보고서 출력
  reportPerCategory.sort((a, b) => b.avgBoilerplateRatio - a.avgBoilerplateRatio);

  for (const r of reportPerCategory) {
    console.log('='.repeat(70));
    console.log(`카테고리: ${r.category}  (파일 ${r.fileCount}개)`);
    console.log(`  평균 boilerplate 라인 비율: ${(r.avgBoilerplateRatio * 100).toFixed(1)}%`);
    console.log(`  중복 섹션 종류 (≥${SECTION_THRESHOLD}개 파일): ${r.boilerSectionCount}`);
    console.log(`  중복 라인 종류 (≥${LINE_THRESHOLD}개 파일): ${r.boilerLineCount}`);

    if (r.topSections.length > 0) {
      console.log(`\n  [상위 중복 섹션 — 헤더(파일수)]`);
      for (const s of r.topSections) {
        console.log(`    × ${s.count} files: ${s.header || '(no header)'}`);
      }
    }

    if (r.topLines.length > 0) {
      console.log(`\n  [상위 중복 라인 — N파일에 등장]`);
      for (const l of r.topLines) {
        const preview = l.line.length > 100 ? l.line.slice(0, 100) + '…' : l.line;
        console.log(`    × ${l.count} files: ${preview}`);
      }
    }

    if (r.worstFiles.length > 0) {
      console.log(`\n  [boilerplate 비율 최다 파일 Top 5]`);
      for (const f of r.worstFiles) {
        console.log(`    ${(f.ratio * 100).toFixed(1)}%  ${f.file}  (boiler ${f.boilerChars}/total ${f.totalChars})`);
      }
    }
    console.log();
  }

  console.log('='.repeat(70));
  console.log('전체 카테고리 요약 (avg boilerplate 비율 desc)');
  for (const r of reportPerCategory) {
    console.log(`  ${(r.avgBoilerplateRatio * 100).toFixed(1).padStart(5)}%  ${r.category.padEnd(18)} (${r.fileCount} files, ${r.boilerLineCount} 중복라인)`);
  }
};

main();
