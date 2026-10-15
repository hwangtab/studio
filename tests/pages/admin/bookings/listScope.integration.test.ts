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
  await client.execute('DELETE FROM work_orders');
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

/**
 * 계좌 입금 대기는 자동 취소가 없어 오래 열려 있다 — `?deposit=pending`은 200건 상한과 무관하게 전부 싣고,
 * 탭의 N은 목록 상한과 별개로 센다.
 */
it('?deposit=pending은 입금 대기 session·mixing만 상한 없이 싣고 건수를 센다', async () => {
  for (let i = 0; i < 205; i += 1) await insertOrder(`p${i}`, 'session', 'awaiting_deposit');
  await insertOrder('m1', 'mixing', 'awaiting_deposit');
  await insertOrder('x1', 'ticket', 'awaiting_deposit');
  await insertOrder('s1', 'session', 'deposit_cancelled');
  await insertOrder('s2', 'session', 'paid');

  const r = (await getServerSideProps({ query: { deposit: 'pending' } } as never)) as {
    props: { bookings: unknown[]; truncated: boolean; depositPendingCount: number };
  };
  expect(r.props.bookings).toHaveLength(206);
  expect(r.props.truncated).toBe(false);
  expect(r.props.depositPendingCount).toBe(206);

  const all = (await getServerSideProps({ query: {} } as never)) as { props: { depositPendingCount: number } };
  expect(all.props.depositPendingCount).toBe(206);
});

describe('?work= — 대시보드 믹싱 카드가 여는 목록', () => {
  const insertWork = async (orderId: string, status: string) => {
    await client.execute({
      sql: `INSERT INTO work_orders (id, order_id, product_id, service_type, song_count, status) VALUES (?, ?, 'mixing-level1', 'mixing', 1, ?)`,
      args: [`w-${orderId}`, orderId, status],
    });
  };
  const listed = async (work: string) => {
    const r = (await getServerSideProps({ query: { work } } as never)) as {
      props: { bookings: Array<{ orderNo: string }>; truncated: boolean };
    };
    return r.props;
  };

  it('그 단계의 믹싱 주문만, 건수 제한 없이 싣는다', async () => {
    await insertOrder('m1', 'mixing');
    await insertWork('m1', 'received');
    await insertOrder('m2', 'mixing');
    await insertWork('m2', 'in_progress');
    await insertOrder('m3', 'mixing');
    await insertWork('m3', 'received');
    await insertOrder('s1', 'session');

    expect((await listed('received')).bookings.map((b) => b.orderNo).sort()).toEqual(['NO-m1', 'NO-m3']);
    expect((await listed('in_progress')).bookings.map((b) => b.orderNo)).toEqual(['NO-m2']);
    expect((await listed('received')).truncated).toBe(false);
  });

  it('모르는 값은 무시하고 평소 목록을 연다', async () => {
    await insertOrder('s1', 'session');
    const r = (await getServerSideProps({ query: { work: 'x' } } as never)) as { props: { bookings: unknown[]; workFilter?: string } };
    expect(r.props.bookings).toHaveLength(1);
    expect(r.props.workFilter).toBeUndefined();
  });

  it('주문이 200건을 넘어도 오래된 착수 대기가 밀려나지 않는다', async () => {
    await insertOrder('old', 'mixing');
    await insertWork('old', 'received');
    await client.execute("UPDATE orders SET created_at = 1000 WHERE id = 'old'");
    for (let i = 0; i < 205; i++) await insertOrder(`s${i}`, 'session');

    expect((await listed('received')).bookings.map((b) => b.orderNo)).toEqual(['NO-old']);
  });
});
