/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { loadRevenueSnapshot } from './revenueSnapshot';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['manual_revenues', 'refunds', 'payments', 'funding_pledges', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const pay = async (id: string, type: string, total: number, iso: string) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, ?, 'paid', 'x', '010', 'a@b.c', ?, ?, ?, ?)`,
    args: [id, `NO-${id}`, type, `t-${id}`, Math.round(total / 1.1), total - Math.round(total / 1.1), total],
  });
  await client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '카드', ?)`, args: [`p-${id}`, id, `pk-${id}`, EPOCH(iso)] });
};

it('이번 달·전월 순매출과 분야별 구성, 수기 매출 합산을 한 번에 돌려준다', async () => {
  await pay('a', 'session', 110000, '2026-10-05T03:00:00Z'); // 이번 달 직접
  await pay('b', 'funding', 50000, '2026-10-06T03:00:00Z'); // 이번 달 중개 — 매출은 수수료 5.5%(2,750원)만
  await pay('c', 'session', 100000, '2026-09-20T03:00:00Z'); // 전월
  await pay('d', 'session', 999999, '2026-08-20T03:00:00Z'); // 전전월 — 읽지 않는다
  await client.execute(`INSERT INTO manual_revenues (id, received_on, type, description, total_amount, vat_amount, method) VALUES ('m1', '2026-10-10', 'mixing', '직접 입금', 30000, 2727, '계좌 입금')`);

  const snap = await loadRevenueSnapshot(new Date('2026-10-15T03:00:00Z'));

  expect(snap).toMatchObject({ year: 2026, month: 10, net: 142750, count: 3, previousNet: 100000, manualMissing: false });
  // 분야별: 세션(예약 행 없음 → 녹음·제작) 110,000 + 수기 믹싱 30,000 = 녹음·제작, 펀딩 수수료 2,750 = 플랫폼. 지출이 없어 수익 = 매출.
  expect(snap.lines.map((l) => [l.line, l.net, l.profit])).toEqual([['practice', 0, 0], ['recording', 140000, 140000], ['platform', 2750, 2750], ['other', 0, 0]]);
  expect(snap).toMatchObject({ commonExpense: 0, totalProfit: 142750 });
  expect(snap.changeRate).toBeCloseTo(42.75, 5);
});

it('수기 매출 표가 없으면 나머지로 계산하고 manualMissing을 켠다', async () => {
  await pay('a', 'session', 110000, '2026-10-05T03:00:00Z');
  await client.execute('DROP TABLE manual_revenues');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  try {
    const snap = await loadRevenueSnapshot(new Date('2026-10-15T03:00:00Z'));
    expect(snap).toMatchObject({ net: 110000, manualMissing: true });
  } finally {
    await client.execute(`CREATE TABLE manual_revenues (id text PRIMARY KEY NOT NULL, received_on text NOT NULL, type text NOT NULL, description text NOT NULL, total_amount integer NOT NULL, vat_amount integer DEFAULT 0 NOT NULL, refunded_amount integer DEFAULT 0 NOT NULL, method text NOT NULL, memo text, created_by text, created_at integer DEFAULT (unixepoch()) NOT NULL)`);
  }
});
