/** @jest-environment node */

/**
 * 열람 기록을 실제 SQLite(in-memory)에서 확인한다.
 *
 * COALESCE로 "처음 값은 덮지 않는다"를 SQL 안에서 처리하므로, 모킹으로는 그 동작이
 * 맞는지 알 수 없다. 마이그레이션을 그대로 적용해 컬럼 정의까지 함께 검증한다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { contracts } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { recordContractView } from './view-log';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const CONTRACT_ID = 'c-view';
const TOKEN = 'tok-view';

let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM contracts');
  const now = new Date();
  await mockDb.insert(contracts).values({
    id: CONTRACT_ID,
    title: '홍길동 계약',
    customerName: '홍길동',
    customerEmail: 'a@studionol.co.kr',
    customerPhone: '010-1234-5678',
    roomNumber: '302',
    startDate: now,
    endDate: now,
    monthlyRent: 360000,
    depositAmount: 360000,
    content: '본문',
    status: 'sent',
    signToken: TOKEN,
    createdAt: now,
    updatedAt: now,
  });
});

afterAll(() => client.close());

const read = async () => {
  const row = await mockDb.query.contracts.findFirst({
    where: (table, { eq }) => eq(table.id, CONTRACT_ID),
  });
  if (!row) throw new Error('계약이 없다');
  return row;
};

describe('열람 기록', () => {
  it('처음 열면 최초·마지막 열람 시각과 IP를 남긴다', async () => {
    const at = new Date('2026-09-01T10:00:00.000Z');
    await recordContractView(CONTRACT_ID, TOKEN, '203.0.113.9', at);

    const row = await read();
    expect(row.firstViewedAt?.getTime()).toBe(at.getTime());
    expect(row.lastViewedAt?.getTime()).toBe(at.getTime());
    expect(row.viewCount).toBe(1);
    expect(row.firstViewedIp).toBe('203.0.113.9');
  });

  /** 처음 열린 시각이 증거다. 나중 접속이 그것을 밀어내면 "받자마자 열었다"가 사라진다. */
  it('다시 열어도 최초 열람 시각과 IP는 덮어쓰지 않는다', async () => {
    const first = new Date('2026-09-01T10:00:00.000Z');
    const later = new Date('2026-09-02T11:30:00.000Z');

    await recordContractView(CONTRACT_ID, TOKEN, '203.0.113.9', first);
    await recordContractView(CONTRACT_ID, TOKEN, '198.51.100.4', later);

    const row = await read();
    expect(row.firstViewedAt?.getTime()).toBe(first.getTime());
    expect(row.firstViewedIp).toBe('203.0.113.9');
    expect(row.lastViewedAt?.getTime()).toBe(later.getTime());
    expect(row.viewCount).toBe(2);
  });

  it('IP를 얻지 못해도 시각과 횟수는 남는다', async () => {
    await recordContractView(CONTRACT_ID, TOKEN, null, new Date('2026-09-01T10:00:00.000Z'));

    const row = await read();
    expect(row.firstViewedIp).toBeNull();
    expect(row.viewCount).toBe(1);
  });

  /** 계약 id만 알면 남의 계약에 열람 기록을 심을 수 있어서는 안 된다. */
  it('토큰이 맞지 않으면 아무것도 기록하지 않는다', async () => {
    await recordContractView(CONTRACT_ID, 'wrong-token', '203.0.113.9');

    const row = await read();
    expect(row.viewCount).toBe(0);
    expect(row.firstViewedAt).toBeNull();
  });
});
