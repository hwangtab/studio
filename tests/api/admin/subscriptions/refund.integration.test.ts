/** @jest-environment node */

/**
 * 관리자 구독 API의 refund_payment 액션 — 입력 검증과 서비스 결과의 HTTP 매핑만 본다.
 * 돈이 실제로 움직이는 규칙은 lib/billing/refund.integration.test.ts가 지킨다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../../lib/contracts/admin-auth', () => ({
  authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }),
}));

const cancelPayment = jest.fn();
jest.mock('../../../../lib/booking/toss', () => ({
  ...jest.requireActual('../../../../lib/booking/toss'),
  cancelPayment: (...args: unknown[]) => cancelPayment(...args),
}));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../../pages/api/admin/subscriptions/[id]';

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
  cancelPayment.mockReset();
  for (const t of ['refunds', 'payments', 'subscription_payments', 'subscriptions', 'orders']) {
    await client.execute(`DELETE FROM ${t}`);
  }
  await client.execute(`INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key,
      item_amount, vat_amount, total_amount, billing_day, status, manage_token)
    VALUES ('sub1', 'lesson', '김수강', '010-1234-5678', 's@example.com', 'ck_1', 350000, 35000, 385000, 5, 'active', 'mt_1')`);
  await client.execute(`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
      manage_token, item_amount, vat_amount, total_amount)
    VALUES ('o1', 'SNB-1', 'subscription', 'paid', '김수강', '010-1234-5678', 's@example.com', 'tok1', 350000, 35000, 385000)`);
  await client.execute(`INSERT INTO payments (id, order_id, payment_key, method) VALUES ('p1', 'o1', 'pay_1', '카드')`);
  await client.execute(`INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status, payment_key)
    VALUES ('sp1', 'sub1', 'o1', '2026-09', 1, 385000, 'paid', 'pay_1')`);
});

const post = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, query: { id: 'sub1' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

it('사유 없이 부르면 400이고 토스를 부르지 않는다', async () => {
  const r = await post({ action: 'refund_payment', paymentId: 'sp1' });
  expect(r.status).toBe(400);
  expect(cancelPayment).not.toHaveBeenCalled();
});

it('금액을 생략하면 잔액 전액을 환불하고 주문번호·금액을 돌려준다', async () => {
  cancelPayment.mockResolvedValue({
    ok: true,
    payment: { paymentKey: 'pay_1', orderId: 'SNB-1', status: 'CANCELED', totalAmount: 385000, cancels: [{ transactionKey: 'tx', cancelAmount: 385000 }] },
  });
  const r = await post({ action: 'refund_payment', paymentId: 'sp1', reason: '이중 청구' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, refundAmount: 385000, orderNo: 'SNB-1' });
});

it('토스가 거절하면 502로 사유를 그대로 전달한다', async () => {
  cancelPayment.mockResolvedValue({ ok: false, code: 'ALREADY_CANCELED_PAYMENT', message: '이미 취소된 결제입니다.' });
  const r = await post({ action: 'refund_payment', paymentId: 'sp1', reason: 'x', amount: 1000 });
  expect(r.status).toBe(502);
  expect(r.body).toMatchObject({ ok: false, code: 'toss_failed', message: '이미 취소된 결제입니다.' });
});
