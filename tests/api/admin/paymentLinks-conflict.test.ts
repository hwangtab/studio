/** @jest-environment node */
/**
 * 결제 링크를 "예약 불가 블록"과 함께 만들 때 이미 잡힌 예약과 겹치면 409(conflicts)로 멈추고, force일 때만 통과한다
 * (관리자 블록 등록 tests/api/admin/blocks-conflict.test.ts와 같은 규약).
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import handler from '../../../pages/api/admin/payment-links';
/* eslint-enable import/first */

const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const call = async (body: Record<string, unknown>) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'POST', body, headers: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};

let client: Awaited<ReturnType<typeof createTestDb>>['client'];

beforeEach(async () => {
  const t = await createTestDb();
  testDb = t.db;
  client = t.client;
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token)
          VALUES ('o1','SNB-1','session','paid','홍길동','010','a@b.c',100,10,110,'tok')`,
    args: [],
  });
  // KST 2026-12-20 14:00~17:00
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, room_number, status, start_at, end_at, duration_hours)
          VALUES ('b1','o1','recording-pro','recording',NULL,'confirmed',?,?,3)`,
    args: [EPOCH('2026-12-20T05:00:00Z'), EPOCH('2026-12-20T08:00:00Z')],
  });
});

const base = { action: 'create', itemName: '보컬 녹음', totalAmount: 250000, expiresOn: '', memo: '' };
// 15:00~17:00 KST — 위 예약과 겹친다.
const overlapping = { ...base, sessionAt: '2026-12-20T15:00', sessionHours: 2 };
const count = async (t: string) => Number((await client.execute(`SELECT COUNT(*) AS n FROM ${t}`)).rows[0].n);

it('겹치는 예약이 있으면 409와 주문번호를 주고 링크도 블록도 만들지 않는다', async () => {
  const r = await call(overlapping);
  expect(r.status).toBe(409);
  expect(r.body).toMatchObject({ code: 'conflicts', conflicts: [{ orderNo: 'SNB-1' }] });
  expect(await count('payment_links')).toBe(0);
  expect(await count('availability_blocks')).toBe(0);
});

it('force면 겹쳐도 링크와 블록을 만든다', async () => {
  const r = await call({ ...overlapping, force: true });
  expect(r.status).toBe(201);
  expect(r.body.blocked).toBe(true);
  expect(await count('availability_blocks')).toBe(1);
});

it('겹치지 않는 시간이거나 블록을 안 걸면 검사 없이 만든다', async () => {
  expect((await call({ ...base, sessionAt: '2026-12-20T17:00', sessionHours: 2 })).status).toBe(201);
  expect((await call({ ...overlapping, blockSlot: false })).status).toBe(201);
  expect(await count('availability_blocks')).toBe(1);
});
