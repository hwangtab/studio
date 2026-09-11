/** @jest-environment node */

/**
 * 관리자 구독 API 통합 테스트. lib/billing/service.integration.test.ts와 같은 방식으로
 * 진짜 SQLite(in-memory)를 쓰고 토스 클라이언트만 모킹한다 — 목록·생성·수동 결제 각 1개 이상.
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

const issueBillingKey = jest.fn();
const chargeBillingKey = jest.fn();
jest.mock('../../../../lib/billing/toss-billing', () => ({
  issueBillingKey: (...args: unknown[]) => issueBillingKey(...args),
  chargeBillingKey: (...args: unknown[]) => chargeBillingKey(...args),
}));

const sendEmail = jest.fn().mockResolvedValue({ ok: true });
jest.mock('../../../../lib/email/resend', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import listHandler from '../../../../pages/api/admin/subscriptions/index';
// eslint-disable-next-line import/first
import detailHandler from '../../../../pages/api/admin/subscriptions/[id]';
// eslint-disable-next-line import/first
import { completeCardSetup, createSubscription } from '../../../../lib/billing/service';
import { subscriptionAmounts } from '../../../../lib/billing/amounts';

const LESSON_TOTAL = subscriptionAmounts('lesson').totalAmount;

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
  sendEmail.mockResolvedValue({ ok: true });
  await client.execute('DELETE FROM subscription_payments');
  await client.execute('DELETE FROM billing_keys');
  await client.execute('DELETE FROM subscriptions');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
});

const call = async (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  init: { method: string; body?: unknown; query?: Record<string, string> },
) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler(
    { method: init.method, body: init.body ?? {}, query: init.query ?? {}, headers: {}, socket: {} } as unknown as NextApiRequest,
    res,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const lessonInput = {
  kind: 'lesson' as const,
  customerName: '김수강',
  customerPhone: '010-1234-5678',
  customerEmail: 'student@example.com',
  billingDay: 5,
};

describe('POST /api/admin/subscriptions (생성)', () => {
  it('구독을 만들고 카드 등록 안내 메일을 보낸다', async () => {
    const { status, body } = await call(listHandler, { method: 'POST', body: lessonInput });

    expect(status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.id).toBeTruthy();
    expect(body.setupUrl).toContain(body.id);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('student@example.com');
  });

  it('필수 정보가 없으면 400을 준다', async () => {
    const { status, body } = await call(listHandler, {
      method: 'POST',
      body: { ...lessonInput, customerName: '' },
    });
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});

describe('GET /api/admin/subscriptions (목록)', () => {
  it('생성한 구독을 목록에서 돌려준다', async () => {
    await createSubscription(lessonInput, new Date('2026-03-05T00:00:00Z'));

    const { status, body } = await call(listHandler, { method: 'GET' });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0].customerName).toBe('김수강');
    expect(body.subscriptions[0].failedCount).toBe(0);
  });
});

describe('POST /api/admin/subscriptions/[id] (수동 결제)', () => {
  it('카드가 등록된 구독을 수동 결제하고 결제 완료 메일을 보낸다', async () => {
    const now = new Date('2026-03-05T00:00:00Z');
    const created = await createSubscription(lessonInput, now);
    if (!created.ok) throw new Error('unreachable');

    issueBillingKey.mockResolvedValue({
      ok: true,
      billingKey: 'bkey_1',
      card: { company: '신한', numberMasked: '433012******1234', cardType: '신용' },
      raw: {},
    });
    chargeBillingKey.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pay_1', orderId: 'x', status: 'DONE', totalAmount: LESSON_TOTAL, approvedAt: now.toISOString() },
    });
    await completeCardSetup({ id: created.id, token: created.setupToken, authKey: 'auth', customerKey: (await mockDb.query.subscriptions.findFirst({ where: (t, { eq }) => eq(t.id, created.id) }))!.customerKey }, now);

    sendEmail.mockClear();
    chargeBillingKey.mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pay_2', orderId: 'x', status: 'DONE', totalAmount: LESSON_TOTAL, approvedAt: '2026-04-05T00:00:00.000Z' },
    });

    const { status, body } = await call(detailHandler, {
      method: 'POST',
      query: { id: created.id },
      body: { action: 'charge' },
    });

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('active');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('존재하지 않는 구독이면 404를 준다', async () => {
    const { status, body } = await call(detailHandler, {
      method: 'POST',
      query: { id: 'nope' },
      body: { action: 'pause' },
    });
    expect(status).toBe(404);
    expect(body.ok).toBe(false);
  });
});
