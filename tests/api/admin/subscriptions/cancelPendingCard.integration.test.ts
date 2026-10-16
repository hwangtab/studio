/** @jest-environment node */
/**
 * 카드 등록 대기(pending_card) 구독을 관리자가 닫을 수 있어야 한다 — 잘못 만든 구독을 못 닫으면 같은 계약에 다시 만들 수도 없다.
 * 한 번도 시작하지 않은 구독이라 고객에게 "이용 가능 기한" 해지 메일은 보내지 않고, 운영자 알림만 나간다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

const sendCustomer = jest.fn().mockResolvedValue(null);
const sendOperator = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../lib/billing/email', () => ({
  ...jest.requireActual('../../../../lib/billing/email'),
  sendSubscriptionCancelledEmail: (...a: unknown[]) => sendCustomer(...a),
  sendSubscriptionOperatorAlert: (...a: unknown[]) => sendOperator(...a),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/admin/subscriptions/[id]';
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
  jest.clearAllMocks();
  await client.execute('DELETE FROM subscriptions');
});

const seed = (status: string) =>
  client.execute({
    sql: `INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key,
            item_amount, vat_amount, total_amount, billing_day, status, manage_token)
          VALUES ('sub1', 'lesson', '김수강', '010', 'wrong@example.com', 'ck1', 350000, 35000, 385000, 5, ?, 'mt1')`,
    args: [status],
  });

const cancel = async () => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'POST', query: { id: 'sub1' }, body: { action: 'cancel', reason: '이메일을 잘못 적음' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return res.status.mock.calls[0][0] as number;
};
const statusOf = async () => (await client.execute(`SELECT status FROM subscriptions WHERE id = 'sub1'`)).rows[0].status;

it('카드 등록 대기 구독을 닫으면 해지되고, 고객 메일 없이 운영자 알림만 간다', async () => {
  await seed('pending_card');
  expect(await cancel()).toBe(200);
  expect(await statusOf()).toBe('cancelled');
  expect(sendCustomer).not.toHaveBeenCalled();
  expect(sendOperator).toHaveBeenCalledTimes(1);
});

it('이미 시작한 구독을 해지하면 고객에게 해지 메일이 간다(기존 동작)', async () => {
  await seed('active');
  expect(await cancel()).toBe(200);
  expect(sendCustomer).toHaveBeenCalledTimes(1);
});
