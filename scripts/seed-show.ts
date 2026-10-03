#!/usr/bin/env -S npx tsx
/**
 * 공연 등록 — data/shows의 정의를 DB에 slug 기준으로 멱등하게 맞춘다.
 *
 *   npx tsx scripts/seed-show.ts <slug>            # dry-run: 무엇을 쓸지만 보여 준다
 *   npx tsx scripts/seed-show.ts <slug> --apply    # 실제로 쓴다
 *   npx tsx scripts/seed-show.ts --all [--apply]   # 등록부(data/shows/index.ts)의 전부
 *
 * DB는 TURSO_DATABASE_URL·TURSO_AUTH_TOKEN으로 연다. `--apply`는 두 값이 없으면 시작 전에 실패한다.
 * dry-run은 두 값이 있으면 DB를 읽어 생성/갱신 여부까지 보여 주고, 없으면 정의 검증만 한다(DB를 만들지 않는다).
 *
 * 운영 DB에 쓰려면 CLAUDE.md "운영 DB 마이그레이션 적용 방법"과 같이 Turso CLI로 1일짜리 토큰을 만들어
 * 명령 안에서만 환경변수로 넘긴다. 마이그레이션 0045가 먼저 적용돼 있어야 한다.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from '../db/schema';
import { SHOW_DEFINITIONS } from '../data/shows';
import { seedShow, validateShowDefinition, ShowSeedError } from '../lib/shows/seed';

async function main(argv: string[]): Promise<number> {
  const apply = argv.includes('--apply');
  const all = argv.includes('--all');
  const slugs = argv.filter((a) => !a.startsWith('--'));

  if (!all && slugs.length === 0) {
    console.error('사용법: npx tsx scripts/seed-show.ts <slug> [--apply] | --all [--apply]');
    console.error(`등록된 공연: ${SHOW_DEFINITIONS.map((d) => d.slug).join(', ') || '(없음)'}`);
    return 2;
  }
  const targets = all ? [...SHOW_DEFINITIONS] : SHOW_DEFINITIONS.filter((d) => slugs.includes(d.slug));
  const unknown = slugs.filter((s) => !SHOW_DEFINITIONS.some((d) => d.slug === s));
  if (unknown.length > 0) {
    console.error(`정의가 없는 slug: ${unknown.join(', ')}`);
    return 2;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (apply && (!url || !authToken)) {
    console.error('--apply에는 TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN이 필요합니다. 둘 다 설정하지 않았거나 하나가 비었습니다.');
    return 2;
  }

  let failed = false;
  const db = url && authToken ? drizzle(createClient({ url, authToken }), { schema }) : null;
  if (!db) console.log('(TURSO_* 없음 — DB를 읽지 않고 정의 검증만 합니다)');

  for (const def of targets) {
    console.log(`\n== ${def.slug} ==`);
    if (!db) {
      const errors = validateShowDefinition(def);
      if (errors.length > 0) {
        failed = true;
        console.error(`정의 오류:\n- ${errors.join('\n- ')}`);
      } else {
        console.log(`정의 OK — 구역 ${def.zones.length} · 회차 ${def.showtimes.length} · 티켓타입 ${def.ticketTypes.length}`);
      }
      continue;
    }
    try {
      const report = await seedShow(db, def, { apply });
      console.log(report.created ? '새 공연입니다.' : '이미 있는 공연입니다.');
      if (report.actions.length === 0) console.log('변경 없음 — 이미 최신입니다.');
      for (const a of report.actions) console.log(`${apply ? '적용' : '예정'}: ${a}`);
      for (const w of report.warnings) console.warn(`경고: ${w}`);
      if (!apply && report.actions.length > 0) console.log('\n(dry-run) 쓰려면 --apply를 붙이세요.');
    } catch (error: unknown) {
      failed = true;
      console.error(error instanceof ShowSeedError ? error.message : error);
    }
  }
  return failed ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
