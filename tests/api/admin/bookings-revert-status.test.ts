/** @jest-environment node */
/**
 * 완료·노쇼는 환불 경로(cancelSessionBooking)를 닫는다. 잘못 누르면 토스 콘솔에서 직접 환불해야 했으므로
 * 관리자 PATCH가 'confirmed'로 되돌릴 수 있어야 하고, 되돌리면 환불 폼이 다시 열려야 한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/admin/bookings/[id]';
import { canAdminRefund } from '../../../lib/booking/admin-serialize';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (d: string) => Math.floor(new Date(d).getTime() / 1000);
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
  for (const t of ['payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const seed = async (bookingStatus: string) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token, created_at, updated_at)
          VALUES ('o1','SNB-1','session','paid','홍길동','010','a@b.c',250000,25000,275000,'tok',?,?)`,
    args: [EPOCH('2026-09-01'), EPOCH('2026-09-01')],
  });
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, status, start_at, end_at, duration_hours, created_at, updated_at)
          VALUES ('b1','o1','recording-pro','recording',?,?,?,3,?,?)`,
    args: [bookingStatus, EPOCH('2026-09-20T05:00:00Z'), EPOCH('2026-09-20T08:00:00Z'), EPOCH('2026-09-01'), EPOCH('2026-09-01')],
  });
};

const patch = async (status: string) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'PATCH', query: { id: 'o1' }, body: { status }, headers: {} } as unknown as NextApiRequest, res);
  return res.status.mock.calls[0][0] as number;
};
const statusOf = async () => (await client.execute(`SELECT status FROM bookings WHERE id = 'b1'`)).rows[0].status;

it.each(['completed', 'no_show'])('%s로 처리한 예약을 확정으로 되돌리면 환불 폼이 다시 열린다', async (done) => {
  await seed('confirmed');
  expect(await patch(done)).toBe(200);
  expect(await statusOf()).toBe(done);
  expect(canAdminRefund({ orderType: 'session', orderStatus: 'paid', entityStatus: done, refundableAmount: 275000 })).toBe(false);

  expect(await patch('confirmed')).toBe(200);
  expect(await statusOf()).toBe('confirmed');
  expect(canAdminRefund({ orderType: 'session', orderStatus: 'paid', entityStatus: 'confirmed', refundableAmount: 275000 })).toBe(true);
});

it('이미 확정인 예약, 취소된 예약은 되돌릴 수 없다(409) — 상태를 덮어쓰지 않는다', async () => {
  await seed('confirmed');
  expect(await patch('confirmed')).toBe(409);
  await client.execute(`UPDATE bookings SET status = 'cancelled' WHERE id = 'b1'`);
  expect(await patch('confirmed')).toBe(409);
  expect(await statusOf()).toBe('cancelled');
});

it('완료·노쇼 처리는 여전히 확정 예약에서만 된다', async () => {
  await seed('completed');
  expect(await patch('no_show')).toBe(409);
  expect(await statusOf()).toBe('completed');
});
