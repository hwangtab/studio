#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STORIES_DIR = '/Users/hwang-gyeongha/studio/content/stories';

const targets = [
  { file: 'bulgwang-mixing-club-2nd.md', suffix: ' — 스튜디오 놀 믹싱클럽' },
  { file: 'busan-seomyeon1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'changwon-center1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'cheongju-center1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'collab-tools1.md', suffix: ' 협업 도구 가이드' },
  { file: 'daegu-dalseo1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'daejeon-yuseong1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'daw-comparison1.md', suffix: ' 완전 비교 가이드' },
  { file: 'gimpo-sauong1.md', suffix: ' 스튜디오 방문 안내' },
  { file: 'interview1.md', suffix: ' — 아티스트 인터뷰 시리즈' },
  { file: 'live-streaming-music1.md', suffix: ' 완전 가이드' },
  { file: 'pitchtool1.md', suffix: ' 피치 교정 도구 가이드' },
  { file: 'practice-room-piano-ear-training1.md', suffix: ' 완전 가이드' },
  { file: 'pyeongtaek-jisan1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'sample-rate1.md', suffix: ' 완전 가이드' },
  { file: 'streaming-release1.md', suffix: ' 완전 가이드' },
  { file: 'uijeongbu-minjak1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'ulsan-namgu1.md', suffix: ' 스튜디오 방문 가이드' },
  { file: 'yeongnam1.md', suffix: ' 지역 스튜디오 방문 가이드' },
];

let fixedCount = 0;

for (const { file, suffix } of targets) {
  const filePath = path.join(STORIES_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`NOT FOUND: ${file}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let titleLineIdx = -1;
  let inFrontmatter = false;
  let fmCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmCount++;
      if (fmCount === 1) inFrontmatter = true;
      if (fmCount === 2) { inFrontmatter = false; break; }
      continue;
    }
    if (inFrontmatter && lines[i].startsWith('title:')) {
      titleLineIdx = i;
      break;
    }
  }

  if (titleLineIdx === -1) {
    console.log(`NO TITLE FOUND: ${file}`);
    continue;
  }

  const titleLine = lines[titleLineIdx];
  const titleValue = titleLine.replace(/^title:\s*/, '');

  let newTitleValue;
  if (titleValue.startsWith('"') && titleValue.endsWith('"')) {
    // Quoted: insert suffix before closing quote
    const inner = titleValue.slice(1, -1);
    newTitleValue = `"${inner}${suffix}"`;
  } else if (titleValue.startsWith("'") && titleValue.endsWith("'")) {
    // Single-quoted
    const inner = titleValue.slice(1, -1);
    newTitleValue = `'${inner}${suffix}'`;
  } else {
    // Unquoted
    newTitleValue = titleValue + suffix;
  }

  const newTitleLine = `title: ${newTitleValue}`;
  const originalLength = titleValue.replace(/['"]/g, '').length;
  const newLength = newTitleValue.replace(/['"]/g, '').length;

  lines[titleLineIdx] = newTitleLine;
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

  console.log(`FIXED (${originalLength} -> ${newLength} chars): ${file}`);
  console.log(`  Before: title: ${titleValue}`);
  console.log(`  After:  ${newTitleLine}`);
  fixedCount++;
}

console.log(`\nTotal titles fixed: ${fixedCount}`);
