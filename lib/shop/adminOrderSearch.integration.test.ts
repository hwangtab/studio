/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { listAdminShopOrders } from './adminQueries';

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
  for (const t of ['shop_order_items', 'shop_orders', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const seed = async (orderNo: string, name: string, phone: string, createdAt: number) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount, created_at)
          VALUES (?, ?, 'merch', 'paid', ?, ?, 'a@b.c', ?, 100, 10, 110, ?)`,
    args: [`id-${orderNo}`, orderNo, name, phone, `tok-${orderNo}`, createdAt],
  });
  await client.execute({
    sql: `INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, subtotal_amount, shipping_fee, hold_expires_at, fulfillment_status)
          VALUES (?, ?, ?, '12345', '서울', 100, 0, 9999999999, 'preparing')`,
    args: [orderNo, name, phone],
  });
};

it('검색(q)은 주문번호·이름·연락처로 걸러내고 %·_는 글자 그대로 취급한다', async () => {
  await seed('SHP-1', '김철수', '010-1111-2222', 1000);
  await seed('SHP-2', '박영희', '010-3333-4444', 2000);

  expect((await listAdminShopOrders(200)).map((o) => o.orderNo)).toEqual(['SHP-2', 'SHP-1']);
  expect((await listAdminShopOrders(200, '철수')).map((o) => o.orderNo)).toEqual(['SHP-1']);
  expect((await listAdminShopOrders(200, '3333-4444')).map((o) => o.orderNo)).toEqual(['SHP-2']);
  expect((await listAdminShopOrders(200, 'shp-2')).map((o) => o.orderNo)).toEqual(['SHP-2']);
  expect(await listAdminShopOrders(200, '없는')).toEqual([]);
  expect(await listAdminShopOrders(200, '%')).toEqual([]);
  expect((await listAdminShopOrders(200, '   ')).map((o) => o.orderNo)).toEqual(['SHP-2', 'SHP-1']);
});
