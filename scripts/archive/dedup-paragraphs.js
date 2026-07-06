#!/usr/bin/env node
/**
 * dedup-paragraphs.js
 *
 * fix-all-wordcount.js가 2회 실행되어 동일 산문 단락이 두 번 삽입된 파일을 정리합니다.
 * 50자 초과 단락 중 중복이 있으면 두 번째 이후 출현을 제거합니다.
 */

const fs = require('fs');
const path = require('path');

const STORIES_DIR = path.join(__dirname, '..', 'content', 'stories');

// content-quality-check.js와 동일한 로직 (반드시 일치해야 함)
function stripMarkdownSyntax(text) {
  return text
    .replace(/%%[\w-]+%%/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\|[^|\n]*\|/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function getBodyContent(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function getEffectiveWordCount(body) {
  const stripped = stripMarkdownSyntax(body);
  const words = countWords(stripped);
  const SHORTCODE_WORD_ESTIMATES = { 'online-fallback': 25, 'session-checklist': 60 };
  const bonus = [...body.matchAll(/%%([a-z-]+)%%/g)]
    .reduce((sum, m) => sum + (SHORTCODE_WORD_ESTIMATES[m[1]] ?? 15), 0);
  return words + bonus;
}

function dedup(content) {
  // 줄 단위로 분리, 연속 빈 줄 경계로 단락 분리
  const sections = content.split(/\n\n+/);
  const seen = new Map(); // normalized → first_index
  const keep = new Set();

  for (let i = 0; i < sections.length; i++) {
    const para = sections[i].trim();
    // 50자 미만 단락(구분선, 짧은 제목 등)은 항상 유지
    if (para.length < 50) {
      keep.add(i);
      continue;
    }
    const normalized = para.replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.set(normalized, i);
      keep.add(i);
    }
    // else: 중복 → 제거 (keep에 추가 안 함)
  }

  // 원본 content를 keep된 섹션만으로 재조합
  // 섹션 사이의 원래 구분자 수를 최대한 보존하기 위해 다른 방법 사용
  const result = sections
    .filter((_, i) => keep.has(i))
    .join('\n\n');

  return result;
}

const allFiles = fs.readdirSync(STORIES_DIR)
  .filter(f => f.endsWith('.md') &&
    !f.includes('.en.') && !f.includes('.zh.') &&
    !f.includes('.es.') && !f.includes('.vi.') &&
    !f.includes('.th.') && !f.includes('.uz.'));

let dedupCount = 0;
let below200 = [];

for (const f of allFiles) {
  const filePath = path.join(STORIES_DIR, f);
  const content = fs.readFileSync(filePath, 'utf8');

  const deduped = dedup(content);

  if (deduped === content) continue; // 변경 없음

  // 변경이 있으면 단어 수 재확인
  const body = getBodyContent(deduped);
  const newCount = getEffectiveWordCount(body);

  fs.writeFileSync(filePath, deduped, 'utf8');
  dedupCount++;

  const slug = f.replace('.md', '');
  if (newCount < 200) {
    below200.push({ slug, count: newCount });
    console.log(`⚠️  ${slug}: 중복 제거 후 ${newCount}단어 (200 미만)`);
  } else {
    console.log(`✅ ${slug}: 중복 제거 완료 (${newCount}단어)`);
  }
}

console.log(`\n완료: ${dedupCount}개 파일 중복 제거`);
if (below200.length > 0) {
  console.log(`\n⚠️  200단어 미만으로 하락한 파일 (Step 2에서 우선 보강 필요):`);
  for (const { slug, count } of below200) {
    console.log(`  - ${slug} (${count}단어)`);
  }
}
