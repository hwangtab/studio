#!/usr/bin/env node
// 본문 한 줄에 30+ 마크다운 링크가 chained된 SEO spam 라인을 일괄 제거.
// 일부 자동 보일러플레이트 스크립트가 글 끝에 200+ 링크 줄을 삽입한 잔존을 정리.
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'content/stories');
const THRESHOLD = 30;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'));
let removed = 0;
const affected = [];

for (const f of files) {
  const fp = path.join(DIR, f);
  const txt = fs.readFileSync(fp, 'utf8');
  const lines = txt.split('\n');
  const cleaned = [];
  let stripped = false;

  for (const line of lines) {
    const linkCount = (line.match(/\]\(/g) || []).length;
    if (linkCount >= THRESHOLD) {
      stripped = true;
      continue; // skip this line entirely
    }
    cleaned.push(line);
  }

  if (stripped) {
    // trailing empty lines 정리
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') {
      cleaned.pop();
    }
    cleaned.push(''); // EOF newline
    fs.writeFileSync(fp, cleaned.join('\n'), 'utf8');
    removed++;
    affected.push(f);
  }
}

console.log(`처리 완료: ${removed}개 글에서 link spam line 제거`);
affected.slice(0, 20).forEach((f) => console.log('  ' + f));
if (affected.length > 20) console.log('  ... 외 ' + (affected.length - 20) + '개');
