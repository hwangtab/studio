/** @jest-environment node */
/**
 * 캘린더 재시도가 **gcal_error 없이** 이벤트 id만 비어 있는 예약에도 동작해야 한다.
 *
 * 확정 후처리 센티널을 선점한 실행이 ensureBookingEvent 전에 죽으면 gcal_event_id·gcal_error가
 * 둘 다 NULL로 남는다. 화면이 이 예약에도 재시도 버튼을 띄우게 넓혔으므로(pages/admin/bookings/[id].tsx),
 * 눌렀을 때 API가 거절하면 버튼만 있고 복구는 안 되는 상태가 된다. 여기서 그 경로를 고정한다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock('../../../lib/booking/gcal', () => ({
  createBookingEvent: jest.fn(),
  deleteBookingEvent: jest.fn(),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../pages/api/admin/bookings/[id]';
// eslint-disable-next-line import/first
import { createBookingEvent, deleteBookingEvent } from '../../../lib/booking/gcal';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (d: string) => Math.floor(new Date(d).getTime() / 1000);
let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
});

afterAll(() => client.close());

beforeEach(async () => {
  for (const table of ['payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${table}`);
  (createBookingEvent as jest.Mock).mockReset().mockResolvedValue('ev-new');
  (deleteBookingEvent as jest.Mock).mockReset().mockResolvedValue(undefined);
});

const insert = async (bookingOver: Record<string, unknown> = {}) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
          item_amount, vat_amount, total_amount, manage_token, notification_error, created_at, updated_at)
          VALUES ('o1','SNB-1','session','paid','홍길동','010-0000-0000','a@b.c',250000,25000,275000,'tok',?,?,?)`,
    args: ['send_inflight', EPOCH('2026-09-01'), EPOCH('2026-09-01')],
  });
  const row = {
    id: 'b1', order_id: 'o1', product_id: 'recording-pro', service_type: 'recording',
    status: 'confirmed', start_at: EPOCH('2026-09-20T05:00:00Z'), end_at: EPOCH('2026-09-20T08:00:00Z'),
    duration_hours: 3, gcal_event_id: null, gcal_error: null,
    created_at: EPOCH('2026-09-01'), updated_at: EPOCH('2026-09-01'), ...bookingOver,
  };
  await client.execute({
    sql: `INSERT INTO bookings (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row).map(() => '?').join(', ')})`,
    args: Object.values(row) as never[],
  });
};

const retry = async () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: 'POST', query: { id: 'o1' }, body: { action: 'retry-gcal' }, headers: {} } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};

const bookingRow = async () =>
  (await client.execute('SELECT gcal_event_id, gcal_error FROM bookings WHERE id = ?', ['b1'])).rows[0];

it('gcal_error 없이 이벤트 id만 비어 있어도 재시도가 등록한다', async () => {
  await insert();
  const res = await retry();
  expect(res.status).toBe(200);
  expect(createBookingEvent).toHaveBeenCalledTimes(1);
  // 지울 옛 이벤트가 없으므로 삭제는 부르지 않는다.
  expect(deleteBookingEvent).not.toHaveBeenCalled();
  expect(await bookingRow()).toMatchObject({ gcal_event_id: 'ev-new', gcal_error: null });
});

it('기존 이벤트가 있으면 새로 만든 뒤 옛 이벤트를 지운다 (중복 방지 순서 유지)', async () => {
  await insert({ gcal_event_id: 'ev-old', gcal_error: 'retry: 500' });
  const res = await retry();
  expect(res.status).toBe(200);
  expect(deleteBookingEvent).toHaveBeenCalledWith('ev-old');
  expect(await bookingRow()).toMatchObject({ gcal_event_id: 'ev-new', gcal_error: null });
});

it('취소된 예약은 거절한다', async () => {
  await insert({ status: 'cancelled' });
  const res = await retry();
  expect(res.status).toBe(409);
  expect(createBookingEvent).not.toHaveBeenCalled();
});
