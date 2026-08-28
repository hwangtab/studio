#!/usr/bin/env node
/**
 * 섹션 단위 중복 검사 — 파일 간 바이트 동일한 본문 섹션이 늘어나는 것을 막는다.
 *
 * 왜 별도 검사가 필요한가:
 * scripts/scan-near-duplicates.mjs는 "문서 전체" Jaccard 0.45로 판정한다. 2,400자 글에서
 * 380자 섹션이 겹치는 정도는 문서 유사도로는 절대 임계에 닿지 않아, 워드카운트 패딩
 * 스크립트가 심어둔 동일 섹션이 수백 편에 쌓이는 동안 게이트에 한 번도 걸리지 않았다
 * (2026-08-28에 290편 12.1만자를 걷어냈다). 그 부채가 다시 쌓이지 않게 하는 것이 이 검사다.
 *
 * 판정 방식:
 * 절대 임계로 하면 아직 정리되지 않은 기존 중복 때문에 CI가 계속 빨갛다. 그래서
 * 기준선(baseline) 대비로 본다 — 새 중복 그룹이 생기거나 기존 그룹이 커지면 실패.
 * 정리해서 줄어드는 것은 언제나 통과이고, `--update`로 기준선을 낮춰 고정한다.
 *
 * AUTO-EXPAND-V1 블록은 제외한다. 그건 의도적으로 분리 노출되는 boilerplate라
 * lib/storyContentPolicy.ts가 이미 본문에서 떼어내고 있다.
 *
 * 사용:
 *   node scripts/check-duplicate-sections.mjs            # 검사 (CI)
 *   node scripts/check-duplicate-sections.mjs --update   # 기준선 갱신
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = 'content/stories';
const BASELINE = 'content/duplicate-sections.baseline.json';
const AUTO_EXPAND = /<!--\s*AUTO-EXPAND-V1\s*-->[\s\S]*?<!--\s*\/AUTO-EXPAND-V1\s*-->/g;

/** 이 크기 미만 섹션은 무시 — 짧은 공통 문구까지 잡으면 신호 대비 잡음이 커진다. */
const MIN_CHARS = 80;
/** 이 편수 이상 같은 섹션이 반복되면 중복 그룹으로 등재한다. 부채는 2편에서 시작하므로 2로 둔다. */
const MIN_FILES = 2;

const update = process.argv.includes('--update');

const normalize = (s) => s.replace(/\s+/g, ' ').trim();
const hash = (s) => crypto.createHash('md5').update(normalize(s)).digest('hex').slice(0, 12);

const koStories = () =>
  fs.readdirSync(DIR)
    .filter((f) => f.endsWith('.md') && !/\.(en|zh|es|vi|th|uz)\.md$/.test(f))
    .sort();

const indexedBody = (file) => {
  const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
  const withoutFrontmatter = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  return withoutFrontmatter.replace(AUTO_EXPAND, '');
};

const sectionsOf = (body) =>
  body
    .split(/\n(?=#{2,3} )/)
    .map((chunk) => {
      const heading = chunk.match(/^#{2,3} (.+)/);
      return { title: heading ? heading[1].trim() : null, chars: chunk.replace(/\s/g, '').length, hash: hash(chunk) };
    })
    .filter((s) => s.title && s.chars >= MIN_CHARS);

const collect = () => {
  const groups = new Map();
  for (const file of koStories()) {
    for (const section of sectionsOf(indexedBody(file))) {
      if (!groups.has(section.hash)) groups.set(section.hash, { title: section.title, chars: section.chars, files: [] });
      groups.get(section.hash).files.push(file);
    }
  }
  return [...groups.entries()]
    .filter(([, g]) => g.files.length >= MIN_FILES)
    .map(([h, g]) => ({ hash: h, title: g.title, chars: g.chars, count: g.files.length }))
    .sort((a, b) => b.count * b.chars - a.count * a.chars);
};

const current = collect();

if (update) {
  const payload = {
    note: '섹션 단위 중복 기준선. scripts/check-duplicate-sections.mjs --update 로 갱신한다.',
    minChars: MIN_CHARS,
    minFiles: MIN_FILES,
    groups: Object.fromEntries(current.map((g) => [g.hash, { title: g.title, chars: g.chars, count: g.count }])),
  };
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`);
  const waste = current.reduce((sum, g) => sum + g.chars * (g.count - 1), 0);
  console.log(`기준선 갱신 — 중복 그룹 ${current.length}종 / 낭비 ${waste.toLocaleString()}자`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error(`기준선 파일이 없다: ${BASELINE}\n먼저 --update 로 생성할 것.`);
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).groups ?? {};
const problems = [];
for (const group of current) {
  const before = baseline[group.hash];
  if (!before) {
    problems.push(`신규 중복 ${group.count}편 × ${group.chars}자 — "${group.title}"`);
  } else if (group.count > before.count) {
    problems.push(`중복 증가 ${before.count} → ${group.count}편 — "${group.title}"`);
  }
}

const waste = current.reduce((sum, g) => sum + g.chars * (g.count - 1), 0);
console.log(`섹션 중복 검사 — 그룹 ${current.length}종 / 낭비 ${waste.toLocaleString()}자 (기준선 ${Object.keys(baseline).length}종)`);

if (problems.length) {
  console.error(`\n❌ 중복 섹션이 늘었다 (${problems.length}건):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  console.error('\n같은 문단을 여러 글에 붙여넣는 대신 글마다 다시 쓰거나, 공용 안내라면');
  console.error('숏코드 컴포넌트로 만들 것 (예: %%session-checklist%%, %%studio-more%%).');
  console.error('의도한 증가라면 --update 로 기준선을 갱신하고 이유를 커밋 메시지에 남길 것.');
  process.exit(1);
}
console.log('✅ 신규·증가한 중복 섹션 없음');
