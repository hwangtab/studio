/** @jest-environment node */
/** 수기 예약 등록 API — 인증·입력 검증·등록·시간대 충돌(409). 도메인 규칙은 lib/booking/manualEntry.integration.test.ts. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
const authMock = jest.fn();
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...a: unknown[]) => authMock(...a) }));
jest.mock('../../../lib/booking/calendarGuard', () => ({
  ...jest.requireActual('../../../lib/booking/calendarGuard'),
  calendarBlockedRooms: jest.fn().mockResolvedValue({ blocked: false, excludeRooms: [] }),
}));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  createBookingEvent: jest.fn().mockResolvedValue('evt'),
  deleteBookingEvent: jest.fn().mockResolvedValue(undefined),
  renameBookingEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/booking/email', () => ({
  ...jest.requireActual('../../../lib/booking/email'),
  sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderConfirmedEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/admin/bookings/manual';
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
  for (const t of ['refunds', 'payments', 'work_orders', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  authMock.mockReset().mockResolvedValue({ ok: true, actor: 'kyungha' });
});

const call = async (method: string, body?: unknown) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method, body, headers: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};
const future = () => new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);
const VALID = () => ({
  kind: 'session', productId: 'recording-pro', date: future(), startHour: 14,
  customerName: '김전화', customerPhone: '', customerEmail: '', received: true, method: '현금',
});

it('세션이 없으면 401, POST 외에는 405', async () => {
  authMock.mockResolvedValue({ ok: false });
  expect((await call('POST', VALID())).status).toBe(401);
  authMock.mockResolvedValue({ ok: true, actor: 'kyungha' });
  expect((await call('GET')).status).toBe(405);
});

it('입력이 틀리면 400 — 주문을 만들지 않는다', async () => {
  expect((await call('POST', { ...VALID(), customerName: '' })).status).toBe(400);
  expect((await call('POST', { ...VALID(), totalAmount: 25 })).status).toBe(400);
  expect(Number((await client.execute('SELECT COUNT(*) AS n FROM orders')).rows[0].n)).toBe(0);
});

it('받은 돈으로 등록하면 201과 주문번호, 같은 시간대를 또 넣으면 409다', async () => {
  const first = await call('POST', VALID());
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({ ok: true, status: 'paid', orderNo: expect.stringMatching(/^SNB-/) });
  expect(await client.execute(`SELECT method FROM payments`)).toMatchObject({ rows: [{ method: '현금' }] });

  const second = await call('POST', { ...VALID(), customerName: '박둘째' });
  expect(second.status).toBe(409);
  expect(second.body.message).toContain('이미 예약');
});
