#!/usr/bin/env node
/**
 * extract_boilerplate.js
 *
 * 마크다운 파일에서 반복되는 보일러플레이트 블록을 숏코드 마커로 교체합니다.
 *
 * 대상 패턴:
 * 1. "방문이 어려우면 [온라인 파일 의뢰]..." 라인 → %%online-fallback%%
 * 2. "**출발 전 챙길 것:**" 섹션 → %%session-checklist%%
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

const stats = { totalFiles: 0, modifiedFiles: 0, onlineFallback: 0, sessionChecklist: 0 };

function replaceOnlineFallback(content) {
  let result = content;
  let count = 0;

  // Pattern: ---\n\n방문이 어려우면...\n\n--- (with surrounding hr)
  const withHr = /\n---\n\n방문이 어려우면 \[온라인 파일 의뢰\]\(\/stories\/onlinemix1\)도 가능합니다\.\n\n---(?=\n)/g;
  const after = result.replace(withHr, '\n\n%%online-fallback%%');
  if (after !== result) { count++; result = after; }

  // Pattern: standalone line (no surrounding ---)
  const standalone = /\n방문이 어려우면 \[온라인 파일 의뢰\]\(\/stories\/onlinemix1\)도 가능합니다\.\n/g;
  const after2 = result.replace(standalone, '\n%%online-fallback%%\n');
  if (after2 !== result) { count++; result = after2; }

  return { result, count };
}

function replaceSessionChecklist(content) {
  // Match from **출발 전 챙길 것:** up to the next ## heading, --- divider, or [ link
  const pattern = /\*\*출발 전 챙길 것:\*\*[\s\S]*?(?=\n##|\n---|\n\[|$)/g;
  let count = 0;
  const result = content.replace(pattern, () => {
    count++;
    return '%%session-checklist%%';
  });
  return { result, count };
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;

  // Skip if shortcodes already present
  if (content.includes('%%online-fallback%%') || content.includes('%%session-checklist%%')) {
    return;
  }

  let changed = false;
  let fileOnline = 0;
  let fileSession = 0;

  const onlineResult = replaceOnlineFallback(content);
  if (onlineResult.count > 0) {
    content = onlineResult.result;
    fileOnline = onlineResult.count;
    changed = true;
  }

  const sessionResult = replaceSessionChecklist(content);
  if (sessionResult.count > 0) {
    content = sessionResult.result;
    fileSession = sessionResult.count;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.modifiedFiles++;
    stats.onlineFallback += fileOnline;
    stats.sessionChecklist += fileSession;
    if (process.argv.includes('--verbose')) {
      console.log(`  수정: ${path.basename(filePath)} (online=${fileOnline}, session=${fileSession})`);
    }
  }
}

function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`보일러플레이트 추출 시작${isDryRun ? ' (DRY RUN)' : ''}: ${STORIES_DIR}\n`);

  const files = fs.readdirSync(STORIES_DIR).filter(f => f.endsWith('.md'));
  stats.totalFiles = files.length;

  if (isDryRun) {
    // Count matches without writing
    let dryOnline = 0;
    let drySession = 0;
    for (const file of files) {
      const content = fs.readFileSync(path.join(STORIES_DIR, file), 'utf8');
      if (content.includes('%%online-fallback%%') || content.includes('%%session-checklist%%')) continue;
      const { count: o } = replaceOnlineFallback(content);
      const { result, count: s } = replaceSessionChecklist(replaceOnlineFallback(content).result);
      if (o > 0 || s > 0) { stats.modifiedFiles++; }
      dryOnline += o;
      drySession += s;
      void result;
    }
    console.log(`[DRY RUN] 수정 예정 파일: ${stats.modifiedFiles} / ${files.length}`);
    console.log(`[DRY RUN] online-fallback 교체 예정: ${dryOnline}건`);
    console.log(`[DRY RUN] session-checklist 교체 예정: ${drySession}건`);
    return;
  }

  for (const file of files) {
    processFile(path.join(STORIES_DIR, file));
  }

  console.log(`완료:`);
  console.log(`  전체 파일: ${stats.totalFiles}`);
  console.log(`  수정된 파일: ${stats.modifiedFiles}`);
  console.log(`  online-fallback 교체: ${stats.onlineFallback}건`);
  console.log(`  session-checklist 교체: ${stats.sessionChecklist}건`);
}

run();
