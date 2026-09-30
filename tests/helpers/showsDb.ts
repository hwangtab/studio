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

export function rowsAffectedOf(result: unknown): number {
  const r = result as { rowsAffected?: number } | undefined;
  return r?.rowsAffected ?? 0;
}
