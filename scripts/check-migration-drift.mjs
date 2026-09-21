#!/usr/bin/env node
/**
 * 로컬에 커밋된 마이그레이션이 운영 Turso DB에 실제로 적용됐는지 CI에서 확인한다.
 *
 * lib/ops/migrationDrift.ts가 하는 판정과 같은 판정이다(로컬 저널 entries 수 vs
 * `__drizzle_migrations` 테이블 행 수). 그 모듈은 Next.js 서버리스 런타임에서 도는
 * TypeScript라 이 스크립트에서 그대로 import하지 않는다 — CI는 빌드 전 단계에서 빠르게
 * 돌아야 하고, ts-node/tsx 없이 plain Node로 실행할 수 있어야 한다. 로직은 반드시
 * 같은 판정을 유지할 것 — 어긋나면 화면·메일·CI가 서로 다른 답을 말하게 된다.
 *
 * ⚠️ 이 스크립트가 실패해도 배포는 막히지 않는다. Vercel은 GitHub Actions와 무관하게
 * push에 반응해 배포하므로, 이 CI가 빨간불이어도 그 push는 이미 프로덕션에 올라가
 * 있다. 이 검사는 탐지기일 뿐이고, 진짜 방어선은 lib/ops/healthCheck.ts의 매일 크론
 * (운영자 이메일)이다.
 */
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

const JOURNAL_PATH = path.join(process.cwd(), 'drizzle/migrations/meta/_journal.json');

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.log(
    '[check-migration-drift] TURSO_DATABASE_URL·TURSO_AUTH_TOKEN이 없어 건너뜁니다 ' +
      '(GitHub Secrets에 등록되기 전까지는 정상 skip입니다).',
  );
  process.exit(0);
}

const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf-8'));
const localTags = journal.entries.map((entry) => entry.tag);

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

let appliedCount;
try {
  const res = await client.execute('select count(*) as count from __drizzle_migrations');
  appliedCount = Number(res.rows[0].count ?? 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes('no such table')) {
    appliedCount = 0;
  } else {
    console.error('[check-migration-drift] 운영 DB 조회 실패:', message);
    process.exit(1);
  }
} finally {
  client.close();
}

const pendingCount = Math.max(localTags.length - appliedCount, 0);

if (pendingCount === 0) {
  const note = appliedCount > localTags.length ? ' (운영이 앞서 있음 — 정상)' : '';
  console.log(
    `[check-migration-drift] 이상 없음 — 로컬 ${localTags.length}개, 운영 적용 ${appliedCount}개${note}.`,
  );
  process.exit(0);
}

const pendingTags = localTags.slice(localTags.length - pendingCount);
console.error(
  `[check-migration-drift] 운영 DB에 적용되지 않은 마이그레이션 ${pendingCount}건: ${pendingTags.join(', ')}\n` +
    `로컬 ${localTags.length}개, 운영 적용 ${appliedCount}개. ` +
    '이 push가 이 스키마 변경을 전제로 한 코드를 포함한다면 이미 배포됐을 수 있습니다 — ' +
    '\`npm run db:migrate\`로 지금 바로 적용해 주세요.',
);
process.exit(1);
