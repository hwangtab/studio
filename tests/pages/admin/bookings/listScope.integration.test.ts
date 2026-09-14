/** @jest-environment node */
/**
 * 예약 관리 목록의 **모집단**을 실 DB로 고정한다.
 *
 * orders 테이블에는 후원(type='funding')·구독 월 청구(type='subscription') 행도 들어온다.
 * where 절이 없던 동안 그 행들이 '세션' 배지로 목록에 섞였고, 상태 카운트·배너가 함께 셌으며,
 * 200건 상한을 잠식해 후원 200건짜리 캠페인에서는 실제 예약이 통째로 밀려났다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({
  authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true }),
}));

// eslint-disable-next-line import/first
import { getServerSideProps } from '../../../../pages/admin/bookings/index';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const insertOrder = async (id: string, type: string, status = 'paid') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
            manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
          VALUES (?,?,?,?, '홍길동','010-0000-0000','a@example.com', ?, 10000, 1000, 11000, unixepoch(), unixepoch())`,
    args: [id, `NO-${id}`, type, status, `tok-${id}`],
  });
};

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
  await client.execute('DELETE FROM orders');
});

const listedTypes = async (): Promise<string[]> => {
  const r = (await getServerSideProps({ query: {} } as never)) as { props: { bookings: Array<{ orderType: string }> } };
  return r.props.bookings.map((b) => b.orderType);
};

it('funding·subscription 주문은 예약 목록에 실리지 않는다', async () => {
  await insertOrder('s1', 'session');
  await insertOrder('m1', 'mixing');
  await insertOrder('f1', 'funding');
  await insertOrder('b1', 'subscription');

  expect([...(await listedTypes())].sort()).toEqual(['mixing', 'session']);
});

/**
 * 상한을 잠식하던 것이 가장 실질적인 피해다 — 후원이 200건을 넘으면 실제 예약이 목록에서
 * 밀려나고, 그 상태에서 미정합·메일실패 배너는 '최근 200개 주문 안의 예약'만 보게 된다.
 */
it('후원 200건이 있어도 예약이 목록에서 밀려나지 않는다', async () => {
  for (let i = 0; i < 205; i += 1) await insertOrder(`f${i}`, 'funding');
  await insertOrder('s1', 'session');

  const types = await listedTypes();
  expect(types).toEqual(['session']);
});

it('예약이 201건을 넘으면 truncated가 켜진다', async () => {
  for (let i = 0; i < 201; i += 1) await insertOrder(`s${i}`, 'session');
  const r = (await getServerSideProps({ query: {} } as never)) as { props: { truncated: boolean } };
  expect(r.props.truncated).toBe(true);
});
