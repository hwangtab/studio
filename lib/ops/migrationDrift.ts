import fs from 'node:fs';
import path from 'node:path';

import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';

/**
 * 로컬에 커밋된 마이그레이션과 운영 Turso에 실제로 적용된 마이그레이션의 개수를 비교한다.
 *
 * 2026-09-21 사고: 셀프 개설 1·2·4차 마이그레이션(0017·0018·0019)이 운영 DB에 하나도
 * 적용되지 않은 채 그 코드가 사흘간 배포돼 있었다. `funding_projects` 테이블이 없어
 * 관리자·개설자 경로는 500, 공개 경로는 `lib/funding/repository.ts`의 safeDb가 오류를
 * 삼켜 조용히 마크다운 폴백으로 돌았다 — 로그를 보지 않으면 며칠이 지나도 모른다.
 *
 * 이 저장소는 마이그레이션을 코드와 함께 배포하지 않는다(SQL은 생성·커밋만 하고 적용은
 * 운영자가 `npm run db:migrate`로 수동 실행 — package.json 참조). 그래서 "코드가 먼저
 * 나갔는데 스키마가 안 따라왔다"를 알려주는 장치가 없었다. 이 판정이 그 장치다.
 *
 * 비교 대상은 drizzle-kit이 만드는 두 산출물이다.
 * - 로컬: `drizzle/migrations/meta/_journal.json`의 entries 개수(=커밋된 마이그레이션 수).
 * - 운영: `__drizzle_migrations` 테이블의 행 수(=drizzle-kit migrate가 실제로 적용한 수).
 *
 * 운영이 로컬보다 **많은** 경우는 정상이다(운영자가 먼저 db:migrate를 돌리고 코드는 다음
 * 배포를 기다리는 상태 — 이 저장소가 권장하는 순서다). 밀린 방향, 즉 로컬이 운영보다
 * 많은 경우만 이상으로 본다.
 */

export type MigrationDriftStatus = 'ok' | 'drift' | 'unknown';

export interface MigrationDriftResult {
  status: MigrationDriftStatus;
  /** 로컬 저장소(_journal.json)에 커밋된 마이그레이션 수. */
  localCount: number;
  /**
   * 운영 DB에 적용된 마이그레이션 수. 판정 불가(status: 'unknown')일 때는 null —
   * "0개 밀렸다"와 "몰라서 못 쟀다"를 같은 값으로 두면 화면·메일에서 구분이 안 된다.
   */
  appliedCount: number | null;
  /** localCount - appliedCount. 운영이 앞서 있는 정상 상태는 0으로 표시한다. */
  pendingCount: number;
  /** 밀린 마이그레이션들의 tag. 저널 순서상 뒤에서 pendingCount개. */
  pendingTags: string[];
  /** status가 'unknown'일 때만 채워지는 사유 — 화면·로그에 그대로 노출해도 되는 문장. */
  reason?: string;
}

const DEFAULT_JOURNAL_PATH = path.join(
  process.cwd(),
  'drizzle/migrations/meta/_journal.json',
);

interface JournalEntry {
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

const readLocalMigrationTags = (journalPath: string): string[] => {
  const raw = fs.readFileSync(journalPath, 'utf-8');
  const parsed = JSON.parse(raw) as Journal;
  return parsed.entries.map((entry) => entry.tag);
};

/**
 * 운영 DB에 적용된 마이그레이션 수. `__drizzle_migrations` 자체가 없으면(한 번도
 * 마이그레이션을 안 돌린 완전히 새 DB) "no such table" 오류가 나는데, 그건 곧 적용 수
 * 0이라는 뜻이라 여기서 흡수한다. 그 밖의 오류(네트워크 등)는 판정 불가가 아니라
 * "점검 자체가 죽은 것"이므로 그대로 던져 runHealthCheck의 바깥 catch가 운영자에게
 * 알리게 둔다(runLeadRateCheck과 같은 방침).
 */
const defaultQueryAppliedCount = async (): Promise<number> => {
  const db = getDb();
  try {
    const row = await db.get<{ count: number }>(
      sql`select count(*) as count from __drizzle_migrations`,
    );
    return Number(row?.count ?? 0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('no such table')) return 0;
    throw error;
  }
};

export interface CheckMigrationDriftDeps {
  /** 테스트 주입용. 기본은 실제 운영 DB(getDb())를 센다. */
  queryAppliedCount?: () => Promise<number>;
  /** 테스트 주입용. 기본은 저장소의 실제 저널 파일. */
  journalPath?: string;
  /** 테스트 주입용. 기본은 process.env. */
  env?: NodeJS.ProcessEnv;
}

export const checkMigrationDrift = async (
  deps: CheckMigrationDriftDeps = {},
): Promise<MigrationDriftResult> => {
  const journalPath = deps.journalPath ?? DEFAULT_JOURNAL_PATH;
  const localTags = readLocalMigrationTags(journalPath);
  const localCount = localTags.length;

  const env = deps.env ?? process.env;
  const hasDbEnv = Boolean(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN);

  // queryAppliedCount를 테스트가 직접 주입했다면 env 유무와 무관하게 그것을 쓴다.
  if (!deps.queryAppliedCount && !hasDbEnv) {
    return {
      status: 'unknown',
      localCount,
      appliedCount: null,
      pendingCount: 0,
      pendingTags: [],
      reason:
        'TURSO_DATABASE_URL·TURSO_AUTH_TOKEN이 없어 운영 DB에 적용된 마이그레이션 수를 ' +
        '확인할 수 없습니다(로컬 빌드·시크릿 미등록 CI에서 정상적으로 발생).',
    };
  }

  const queryAppliedCount = deps.queryAppliedCount ?? defaultQueryAppliedCount;
  const appliedCount = await queryAppliedCount();

  const pendingCount = Math.max(localCount - appliedCount, 0);
  const pendingTags = pendingCount > 0 ? localTags.slice(localCount - pendingCount) : [];

  return {
    status: pendingCount > 0 ? 'drift' : 'ok',
    localCount,
    appliedCount,
    pendingCount,
    pendingTags,
  };
};
