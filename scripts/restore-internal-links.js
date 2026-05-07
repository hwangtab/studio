#!/usr/bin/env node
// Link spam 제거(scripts/strip-link-spam.js) 후 internal link 0개가 된 글에
// 카테고리 기반 표준 footer를 자동 추가. 200+ spam이 아닌 의미 있는 5개로 교체.
const fs = require('fs');
const path = require('path');

const DIR = path.join(process.cwd(), 'content/stories');

// categoryKey → footer 마크다운 (5개 sibling/hub 링크)
const FOOTERS = {
  production: '[작곡·작사 실전 가이드](/stories/songwriting1) | [코드 진행 완전 가이드](/stories/chord-progression1) | [비트 메이킹 입문](/stories/beatmaking1) | [음악연습실 안내](/practice-room) | [요금 안내](/pricing)',
  recording: '[처음 보컬 녹음하는 법](/stories/vocal-recording-guide1) | [홈레코딩 vs 스튜디오 녹음](/stories/home-vs-studio1) | [데모 녹음 완전 가이드](/stories/demo-tape1) | [음악연습실 안내](/practice-room) | [요금 안내](/pricing)',
  vocal: '[보컬 호흡법 완전 가이드](/stories/breathing1) | [보컬 워밍업 루틴](/stories/warmup1) | [처음 보컬 녹음하는 법](/stories/vocal-recording-guide1) | [음악연습실 안내](/practice-room) | [요금 안내](/pricing)',
  mixing: '[믹싱 완전 가이드](/stories/mixing-complete-guide) | [EQ 완전 가이드](/stories/eq-guide1) | [컴프레서 완전 가이드](/stories/compression-guide1) | [요금 안내](/pricing) | [문의하기](/contact)',
  business: '[가수 데뷔 준비](/stories/debut1) | [가수 지망생 가이드](/stories/aspiring1) | [인디 뮤지션 녹음실](/stories/indie-musician-studio1) | [음악연습실 안내](/practice-room) | [요금 안내](/pricing)',
  lesson: '[연신내 보컬 레슨](/stories/lesson1) | [보컬 레슨 선택 가이드](/stories/lessonguide1) | [음악연습실 안내](/practice-room) | [레슨 안내](/lesson) | [문의하기](/contact)',
  instrument: '[음악연습실 안내](/practice-room) | [연신내 음악연습실](/stories/practice-room-yeonsinnae1) | [드럼 연습실 가이드](/stories/practice-room-drum1) | [기타 연습실 가이드](/stories/practice-room-guitar1) | [요금 안내](/pricing)',
  region: '[연신내 음악연습실](/stories/practice-room-yeonsinnae1) | [불광 음악연습실](/stories/practice-room-bulgwang1) | [은평구 음악연습실](/stories/practice-room-eunpyeong1) | [음악연습실 안내](/practice-room) | [요금 안내](/pricing)',
  feedback: '[음악연습실 안내](/practice-room) | [요금 안내](/pricing) | [스토리](/stories) | [문의하기](/contact) | [연신내 음악연습실](/stories/practice-room-yeonsinnae1)',
  event: '[음악연습실 안내](/practice-room) | [요금 안내](/pricing) | [스토리](/stories) | [문의하기](/contact) | [연신내 음악연습실](/stories/practice-room-yeonsinnae1)',
};

const FALLBACK = FOOTERS.feedback; // 매칭 안 되는 카테고리

const NORMALIZE = {
  '악기 연습': 'instrument', '지역 가이드': 'region', '강좌': 'lesson',
  '음악 제작': 'production', '녹음 가이드': 'recording', '보컬 가이드': 'vocal',
  '후기': 'feedback', '믹싱·마스터링': 'mixing', '음악 비즈니스': 'business',
  '이벤트': 'event', 'event': 'event', 'notice': 'event', 'interview': 'feedback', 'lesson': 'lesson',
};

function categoryKey(category) {
  if (!category) return 'recording';
  const trimmed = category.trim();
  return NORMALIZE[trimmed] || trimmed.toLowerCase();
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && !/\.(en|es|zh|vi|th|uz)\.md$/.test(f));
let added = 0;
const affected = [];

for (const f of files) {
  const fp = path.join(DIR, f);
  const txt = fs.readFileSync(fp, 'utf8');

  // 본문에 internal link 1개 이상이면 skip
  const linkCount = (txt.match(/\]\(\/stories\//g) || []).length + (txt.match(/\]\(\/(practice-room|pricing|contact|lesson|stories)\b/g) || []).length;
  if (linkCount > 0) continue;

  // frontmatter에서 category 추출
  const catMatch = txt.match(/^category:\s*(.+)$/m);
  const cat = catMatch ? categoryKey(catMatch[1].replace(/^['"]|['"]$/g, '').trim()) : 'recording';
  const footer = FOOTERS[cat] || FALLBACK;

  // 본문 끝에 footer 추가 (trailing newlines 정리 후)
  const lines = txt.split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(footer);
  lines.push('');

  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  added++;
  affected.push({ slug: f.replace(/\.md$/, ''), cat });
}

console.log(`처리 완료: ${added}개 글에 카테고리 기반 footer 추가`);
const byCat = {};
for (const a of affected) byCat[a.cat] = (byCat[a.cat] || 0) + 1;
console.log('카테고리별 분포:', byCat);
