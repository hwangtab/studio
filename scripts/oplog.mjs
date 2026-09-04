#!/usr/bin/env node
/**
 * oplog.mjs — 운영 로그 한 줄 append.
 *
 * 왜 스크립트인가: 기록은 마찰이 조금만 있어도 끊긴다. 파일을 열고 헤더를 맞추고
 * 쉼표를 세는 순간 안 적게 된다. 명령 한 줄로 끝내고, 헤더·필드 검증은 여기서 한다.
 *
 * 원시 CSV는 docs/oplog/.gitignore가 제외한다(저장소가 공개라서). 자세한 규칙과
 * 필드 정의는 docs/oplog/README.md.
 *
 *   node scripts/oplog.mjs session --service vocal --minutes 95 --prep high
 *   node scripts/oplog.mjs mixing  --type single --rounds 2 --days 6
 *   node scripts/oplog.mjs quote   --channel kakao --service recording --outcome won --days 3
 *   node scripts/oplog.mjs show    [session|mixing|quote]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'docs/oplog');

// 스키마 단일 소스. 필드를 늘리면 README의 "필드 정의"도 같이 고칠 것.
const SCHEMA = {
  session: {
    file: 'sessions.csv',
    columns: ['date', 'service', 'duration_min', 'prep_level', 'notes'],
    map: { service: 'service', minutes: 'duration_min', prep: 'prep_level', notes: 'notes' },
    required: ['service', 'duration_min'],
    enums: {
      service: ['vocal', 'voiceover', 'instrument', 'mixing'],
      prep_level: ['high', 'mid', 'low'],
    },
    numeric: ['duration_min'],
  },
  mixing: {
    file: 'mixing-revisions.csv',
    columns: ['date', 'project_type', 'rounds', 'days_total', 'notes'],
    map: { type: 'project_type', rounds: 'rounds', days: 'days_total', notes: 'notes' },
    required: ['project_type', 'rounds'],
    enums: { project_type: ['single', 'ep', 'album', 'voiceover'] },
    numeric: ['rounds', 'days_total'],
  },
  quote: {
    file: 'quotes.csv',
    columns: ['date', 'channel', 'service', 'outcome', 'days_to_close', 'notes'],
    map: {
      channel: 'channel', service: 'service', outcome: 'outcome',
      days: 'days_to_close', notes: 'notes',
    },
    required: ['channel', 'outcome'],
    enums: {
      // channel은 '연락 수단'이 아니라 '어떻게 알고 왔는가'다(2026-09-04 확장). 믹싱은 ChatGPT,
      // 녹음·연습실은 플레이스 경유가 주 경로인데 둘 다 GA4 밖이라 여기서만 잡힌다.
      // 첫 응대에서 "어떻게 알고 오셨어요?" 한 문장을 고정으로 묻고 그 답을 적는다.
      // 옛 값(kakao·email·phone)은 수단이라 유지하되, 경로를 들었으면 경로를 우선 적는다.
      channel: [
        'kakao', 'email', 'naver', 'phone', 'referral',
        'chatgpt', 'other_ai', 'naver_place', 'naver_search', 'naver_blog',
        'google_map', 'google_search', 'instagram', 'marketplace',
      ],
      outcome: ['won', 'lost', 'pending'],
    },
    numeric: ['days_to_close'],
  },
};

// 고객 식별 정보가 notes로 새는 걸 막는 최소 방어. 완벽할 수 없으니 경고만 하고
// 기록은 진행한다 — 여기서 막아버리면 기록 자체를 안 하게 된다.
const PII_HINTS = [/01[016789]-?\d{3,4}-?\d{4}/, /@[\w.-]+\.\w+/, /\b010\d{8}\b/];

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) die(`--${key} 값이 없다`);
    out[key] = next;
    i += 1;
  }
  return out;
};

// RFC 4180 최소 준수 — 쉼표·따옴표·줄바꿈이 있으면 감싸고 따옴표는 두 번.
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const show = (kind) => {
  const kinds = kind ? [kind] : Object.keys(SCHEMA);
  for (const k of kinds) {
    const spec = SCHEMA[k];
    if (!spec) die(`알 수 없는 종류: ${k}`);
    const p = path.join(DIR, spec.file);
    if (!fs.existsSync(p)) {
      console.log(`${spec.file}: 아직 없음`);
      continue;
    }
    const rows = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1).filter(Boolean);
    console.log(`${spec.file}: ${rows.length}건`);
    for (const r of rows.slice(-3)) console.log(`  ${r}`);
  }
};

const main = () => {
  const [kind, ...rest] = process.argv.slice(2);
  if (!kind || kind === '--help' || kind === '-h') {
    console.log('사용법: node scripts/oplog.mjs <session|mixing|quote|show> [--필드 값 ...]');
    console.log('필드 정의는 docs/oplog/README.md');
    return;
  }
  if (kind === 'show') return show(rest[0]);

  const spec = SCHEMA[kind];
  if (!spec) die(`알 수 없는 종류: ${kind} (session|mixing|quote|show)`);

  const args = parseArgs(rest);
  const row = { date: args.date ?? new Date().toISOString().slice(0, 10) };

  for (const [flag, column] of Object.entries(spec.map)) {
    if (args[flag] === undefined) continue;
    let value = args[flag];
    if (spec.enums?.[column] && !spec.enums[column].includes(value)) {
      die(`--${flag} 는 ${spec.enums[column].join(' | ')} 중 하나여야 한다 (받은 값: ${value})`);
    }
    if (spec.numeric.includes(column)) {
      if (!/^\d+$/.test(value)) die(`--${flag} 는 숫자여야 한다 (받은 값: ${value})`);
      value = Number(value);
    }
    row[column] = value;
  }

  for (const req of spec.required) {
    if (row[req] === undefined) {
      const flag = Object.entries(spec.map).find(([, c]) => c === req)?.[0];
      die(`--${flag} 는 필수다`);
    }
  }

  if (row.notes && PII_HINTS.some((re) => re.test(row.notes))) {
    console.warn('⚠ notes에 연락처로 보이는 문자열이 있다. 고객 식별 정보는 적지 않는다.');
  }

  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, spec.file);
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${spec.columns.join(',')}\n`);
  fs.appendFileSync(file, `${spec.columns.map((c) => csvCell(row[c])).join(',')}\n`);

  const total = fs.readFileSync(file, 'utf8').trim().split('\n').length - 1;
  console.log(`✓ ${spec.file} ← ${spec.columns.map((c) => row[c] ?? '').join(' / ')}`);
  console.log(`  누적 ${total}건. 5건을 넘겨야 집계를 낼 수 있다.`);
};

main();
