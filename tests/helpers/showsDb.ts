import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as schema from '../../db/schema';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'drizzle', 'migrations');

export function applyMigrations(client: Client) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    const statements = sqlText.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      client.execute(stmt);
    }
  }
}

export async function createTestDb() {
  const client = createClient({ url: ':memory:' });
  applyMigrations(client);
  const db = drizzle(client, { schema });
  return { client, db };
}

/**
 * `createTestDb().db`의 타입 — 통합 테스트가 `jest.mock('../../db/client', ...)`로 주입하는
 * 모듈 스코프 변수(예: `let mockDb: ShowsTestDb`)와 시드 헬퍼 함수 인자에 쓴다.
 * `(global as any).__testDb` + `(t: any, {eq}: any) => ...` 패턴 대신 이 타입을 쓰면
 * drizzle의 관계 쿼리 콜백(`db.query.x.findFirst({ where: (t, {eq}) => ... })`)의 매개변수
 * 타입이 전부 자동으로 추론돼, `any` 주석을 달지 않아도 lint(`no-explicit-any`)를 통과한다
 * (lib/booking/confirm.integration.test.ts의 `mockDb: ReturnType<typeof drizzle<typeof schema>>`
 * 관행과 같다).
 */
export type ShowsTestDb = Awaited<ReturnType<typeof createTestDb>>['db'];

export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}
