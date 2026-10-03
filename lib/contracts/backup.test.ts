/** @jest-environment node */

/**
 * 계약 백업이 템플릿 사본까지 담는지 실제 SQLite(in-memory)로 확인한다.
 *
 * 사본이 빠진 백업으로 복구하면 서명 대기 계약의 본문이 서명 순간 현재 파일로 완성된다 — 고객이 읽은
 * 조항과 서명에 묶이는 조항이 달라진다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ pathname: 'contracts/backup/x.json' }),
  list: jest.fn().mockResolvedValue({ blobs: [] }),
  del: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/first
import { put } from '@vercel/blob';
// eslint-disable-next-line import/first
import { backupContracts } from './backup';
// eslint-disable-next-line import/first
import { hashTemplate } from './template-snapshot';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

afterAll(() => client.close());

const insertContract = async (id: string) => {
  await client.execute({
    sql: `INSERT INTO contracts (id, title, customer_name, customer_email, customer_phone, room_number,
            start_date, end_date, monthly_rent, deposit_amount, payment_day, content, status, sign_token, created_at, updated_at)
          VALUES (?, '계약', '홍길동', 'a@b.c', '010', '302', 0, 0, 1, 0, 1, '본문', 'sent', ?, 0, 0)`,
    args: [id, `secret-token-${id}`],
  });
};

const writtenBackup = () => JSON.parse((put as jest.Mock).mock.calls.at(-1)[1] as string);

it('템플릿 사본을 담고, 같은 원문은 한 번만 싣는다', async () => {
  await insertContract('c1');
  await insertContract('c2');
  const template = '# 이용계약서 {{customerName}}';
  for (const id of ['c1', 'c2']) {
    await client.execute({
      sql: 'INSERT INTO contract_template_snapshots (contract_id, template, template_hash) VALUES (?, ?, ?)',
      args: [id, template, hashTemplate(template)],
    });
  }

  const result = await backupContracts(new Date('2026-10-03T00:00:00Z'));
  const backup = writtenBackup();

  expect(result.templateSnapshots).toBe(2);
  expect(backup.templateSnapshots).toEqual([
    expect.objectContaining({ contractId: 'c1', templateHash: hashTemplate(template) }),
    expect.objectContaining({ contractId: 'c2', templateHash: hashTemplate(template) }),
  ]);
  expect(backup.templates).toEqual({ [hashTemplate(template)]: template });
  // 서명 토큰은 여전히 빼고 뜬다.
  expect(JSON.stringify(backup)).not.toContain('secret-token');
});
