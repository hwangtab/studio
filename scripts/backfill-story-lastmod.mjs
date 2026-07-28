#!/usr/bin/env node
/* eslint-disable no-console */
// content/stories/*.md의 frontmatter에 lastmod(최종 수정일)를 채워 넣는 1회성 스크립트.
//
// 왜 필요한가: lib/stories.ts가 예전에 파일 mtime으로 dateModified를 만들었는데,
// git은 mtime을 보존하지 않아 Vercel이 배포할 때마다 1,500편 전체가 "방금 수정됨"으로
// 찍혔다. 사실과 다르고, 균일한 가짜 최신성이라 신호 가치도 없다.
//
// 이 스크립트는 git 이력에서 파일별 마지막 커밋 시각을 읽어, 그 값이 발행일(date)보다
// 늦을 때만 lastmod을 써넣는다. 발행 후 손대지 않은 글에는 아무것도 추가하지 않는다.
//
// 사용:
//   node scripts/backfill-story-lastmod.mjs --dry-run   # 무엇이 바뀔지만 출력
//   node scripts/backfill-story-lastmod.mjs             # 실제 기록
//
// 주의: Vercel·GitHub Actions는 얕은 클론이라 빌드 중에는 git 이력을 신뢰할 수 없다.
// 반드시 전체 이력이 있는 로컬에서 실행하고 결과를 커밋할 것.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const STORIES_DIR = path.join(process.cwd(), 'content/stories');
const DRY_RUN = process.argv.includes('--dry-run');

/** "2026-07-25T20:34:30+09:00" → "2026-07-25" */
const toDateOnly = (iso) => iso.slice(0, 10);

const lastCommitDate = (filePath) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], {
      encoding: 'utf-8',
    }).trim();
    return out || null;
  } catch {
    return null;
  }
};

/** frontmatter 블록만 최소 파싱한다 — gray-matter로 재직렬화하면 따옴표·순서·
 *  줄바꿈이 전부 재작성돼 1,500개 파일에 무의미한 diff가 생긴다. */
const readFrontmatter = (raw) => {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = raw.slice(4, end);
  const bodyStart = raw.indexOf('\n', end + 1) + 1;
  return { block, bodyStart, endIndex: end };
};

const fieldValue = (block, key) => {
  const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const files = fs
  .readdirSync(STORIES_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

let written = 0;
let skippedUnchanged = 0;
let skippedNoHistory = 0;
let skippedExisting = 0;
let skippedMalformed = 0;

for (const file of files) {
  const filePath = path.join(STORIES_DIR, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fm = readFrontmatter(raw);

  if (!fm) {
    skippedMalformed += 1;
    continue;
  }

  if (fieldValue(fm.block, 'lastmod')) {
    skippedExisting += 1;
    continue;
  }

  const publishedRaw = fieldValue(fm.block, 'date');
  if (!publishedRaw) {
    skippedMalformed += 1;
    continue;
  }

  const commitIso = lastCommitDate(filePath);
  if (!commitIso) {
    skippedNoHistory += 1;
    continue;
  }

  const published = toDateOnly(publishedRaw);
  const modified = toDateOnly(commitIso);

  // 발행일과 같거나 이르면 개정된 적이 없다는 뜻 — 아무것도 쓰지 않는다.
  if (modified <= published) {
    skippedUnchanged += 1;
    continue;
  }

  if (DRY_RUN) {
    console.log(`${file}: ${published} → lastmod ${modified}`);
    written += 1;
    continue;
  }

  // date 줄 바로 뒤에 넣어 두 날짜가 나란히 읽히게 한다.
  const updatedBlock = fm.block.replace(
    /^(date:\s*.+)$/m,
    (line) => `${line}\nlastmod: ${modified}`
  );
  const updated = `---\n${updatedBlock}\n---\n${raw.slice(fm.bodyStart)}`;
  fs.writeFileSync(filePath, updated, 'utf-8');
  written += 1;
}

const label = DRY_RUN ? '[dry-run] ' : '';
console.log(
  `${label}lastmod ${DRY_RUN ? '기록 예정' : '기록'}: ${written}편 / ` +
    `개정 이력 없음 ${skippedUnchanged} · lastmod 이미 있음 ${skippedExisting} · ` +
    `git 이력 없음 ${skippedNoHistory} · frontmatter 이상 ${skippedMalformed} ` +
    `(전체 ${files.length})`
);

if (skippedNoHistory > files.length / 2) {
  console.warn(
    '\n⚠️  절반 이상이 git 이력을 못 찾았다. 얕은 클론(Vercel·CI)에서 실행했을 가능성이 높다.\n' +
      '   전체 이력이 있는 로컬 저장소에서 다시 실행할 것.'
  );
  process.exitCode = 1;
}
