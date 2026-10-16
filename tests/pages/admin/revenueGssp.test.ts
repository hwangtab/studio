/** @jest-environment node */
/** 매출 현황 서버 쪽 — 인증, 쿼리 정규화, 결제+수기 합산, 수기 표가 없을 때의 부분 성공. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
const authMock = jest.fn();
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminRequest: (...a: unknown[]) => authMock(...a) }));

/* eslint-disable import/first */
import type { GetServerSidePropsContext } from 'next';
import { getServerSideProps } from '../../../pages/admin/revenue';
import { kstYearMonth } from '../../../lib/ops/revenueReport';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
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
  for (const t of ['manual_revenues', 'refunds', 'payments', 'orders']) await client.execute(`DELETE FROM ${t}`);
  authMock.mockReset().mockResolvedValue({ ok: true, actor: 'kyungha' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

type Props = { summary: { totals: { net: number; count: number }; year: number; month: number | 'all' } | null; manualError: string | null; manualEntries: unknown[]; years: number[]; error?: string };
const run = async (query: Record<string, unknown> = {}) => {
  const r = (await getServerSideProps({ query } as unknown as GetServerSidePropsContext)) as { props?: Props; redirect?: { destination: string } };
  return r;
};

const now = kstYearMonth(new Date());
const thisMonthIso = () => `${now.year}-${String(now.month).padStart(2, '0')}-05T03:00:00Z`;
const seedPayment = async () => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES ('o1','SNB-1','session','paid','x','010','a@b.c','tok',100000,10000,110000)`,
    args: [],
  });
  await client.execute({ sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES ('p1','o1','pk1','카드',?)`, args: [Math.floor(new Date(thisMonthIso()).getTime() / 1000)] });
};
const seedManual = (receivedOn: string) =>
  client.execute({
    sql: `INSERT INTO manual_revenues (id, received_on, type, description, total_amount, vat_amount, method) VALUES ('m1', ?, 'other', '현금 판매', 50000, 4545, '현금')`,
    args: [receivedOn],
  });

it('세션이 없으면 로그인으로 보낸다', async () => {
  authMock.mockResolvedValue({ ok: false });
  expect((await run()).redirect?.destination).toBe('/admin/login');
});

it('이번 달 결제와 수기 매출을 합산하고, 이번 달 수기 기록을 따로 싣는다', async () => {
  await seedPayment();
  await seedManual(`${now.year}-${String(now.month).padStart(2, '0')}-04`);
  const { props } = await run();
  expect(props?.summary).toMatchObject({ year: now.year, month: now.month, totals: { net: 160000, count: 2 } });
  expect(props?.manualEntries).toHaveLength(1);
  expect(props?.manualError).toBeNull();
});

it('엉뚱한 연·월·유형 쿼리는 이번 달로 정규화한다', async () => {
  const { props } = await run({ year: '2099', month: '13', type: 'nope' });
  expect(props?.summary).toMatchObject({ year: now.year, month: now.month });
  expect((await run({ year: String(now.year), month: 'all' })).props?.summary?.month).toBe('all');
});

it('수기 매출 표를 못 읽어도 나머지 매출은 보여 주고, 빠졌다는 경고를 싣는다', async () => {
  await seedPayment();
  await client.execute('ALTER TABLE manual_revenues RENAME TO manual_revenues_off');
  try {
    const { props } = await run();
    expect(props?.summary?.totals.net).toBe(110000);
    expect(props?.manualError).toMatch(/직접 받은 매출 표를 읽지 못했습니다/);
  } finally {
    await client.execute('ALTER TABLE manual_revenues_off RENAME TO manual_revenues');
  }
});

it('결제 표 조회가 실패하면 오류 안내만 싣는다(500으로 죽지 않는다)', async () => {
  await client.execute('ALTER TABLE payments RENAME TO payments_off');
  try {
    const { props } = await run();
    expect(props?.summary).toBeNull();
    expect(props?.error).toMatch(/불러오지 못했습니다/);
  } finally {
    await client.execute('ALTER TABLE payments_off RENAME TO payments');
  }
});
