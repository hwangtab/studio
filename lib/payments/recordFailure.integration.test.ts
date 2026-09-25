/**
 * @jest-environment node
 *
 * L18 — 실패 비콘이 `orders.updated_at`을 밀면 그 주문의 5년 파기가 무한히 연기된다
 * (`lib/privacy/orderRetention.ts`가 그 컬럼을 기준선으로 읽는다). 방어가 Origin 헤더
 * 하나뿐이라, 남의 주문번호로 반복해 쏘는 것만으로 성립했다.
 */
import { createClient, type Client } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { recordPaymentFailure } from './recordFailure';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
let seq = 0;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});
afterEach(() => client.close());

const OLD = new Date('2021-01-01T00:00:00Z');

const seedOrder = async (status: typeof schema.orderStatusEnum[number]): Promise<string> => {
  seq += 1;
  const orderNo = `FND-2026091${seq}-BAB88F6${seq}`;
  await mockDb.insert(schema.orders).values({
    orderNo,
    type: 'funding',
    customerName: '후원자',
    customerPhone: '010-0000-0000',
    customerEmail: `b${seq}@example.com`,
    itemAmount: 30_000,
    vatAmount: 0,
    totalAmount: 30_000,
    status,
    manageToken: `tok-${seq}`,
    createdAt: OLD,
    updatedAt: OLD,
  });
  return orderNo;
};

const readOrder = async (orderNo: string) => {
  const [row] = await mockDb.select().from(schema.orders).where(eq(schema.orders.orderNo, orderNo));
  return row;
};

const input = (orderNo: string) => ({ orderNo, code: 'PAY_PROCESS_CANCELED', message: '사용자가 결제를 취소했습니다' });

it('pending 주문에 사유를 남기되 updated_at은 건드리지 않는다', async () => {
  const orderNo = await seedOrder('pending');
  expect(await recordPaymentFailure(input(orderNo))).toBe(true);

  const row = await readOrder(orderNo);
  expect(row.paymentFailCode).toBe('PAY_PROCESS_CANCELED');
  expect(row.paymentFailedAt).not.toBeNull();
  expect(row.updatedAt.getTime()).toBe(OLD.getTime());
});

it('failed 주문에도 남긴다 — 결제가 안 된 주문이라 사유가 남을 자리다', async () => {
  const orderNo = await seedOrder('failed');
  expect(await recordPaymentFailure(input(orderNo))).toBe(true);
  expect((await readOrder(orderNo)).updatedAt.getTime()).toBe(OLD.getTime());
});

it.each(['paid', 'refunded', 'partially_refunded'] as const)(
  '%s 주문에는 아예 쓰지 않는다 — updated_at도 그대로다',
  async (status) => {
    const orderNo = await seedOrder(status);
    expect(await recordPaymentFailure(input(orderNo))).toBe(false);

    const row = await readOrder(orderNo);
    expect(row.paymentFailCode).toBeNull();
    expect(row.paymentFailedAt).toBeNull();
    expect(row.updatedAt.getTime()).toBe(OLD.getTime());
  },
);

it('없는 주문번호는 아무것도 하지 않는다', async () => {
  expect(await recordPaymentFailure(input('FND-20260919-BAB88F67'))).toBe(false);
});
