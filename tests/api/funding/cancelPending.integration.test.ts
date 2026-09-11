/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';
import { generateManageToken, generateOrderNo } from '../../../lib/booking/token';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/projects', () => ({ ...jest.requireActual('../../../lib/funding/projects'), getFundingProject: () => PROJECT }));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../pages/api/funding/cancel';
// eslint-disable-next-line import/first
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../lib/funding/projects';

/**
 * 무통장(bank_transfer) 결제수단은 2026-09-11에 중단됐다 — 새 후원은 toss로만 만들어진다
 * (lib/funding/validation.ts). 그런데 중단 전에 만들어진 pending 무통장 행이 DB에 남아
 * 있을 수 있어, `pages/api/funding/cancel.ts`는 그 행을 셀프 해제(pending → expired)하는
 * 분기를 legacy 호환용으로 남겨 뒀다(cancel.ts 주석 참조).
 *
 * `createFundingPledge`는 이제 bank_transfer를 받지 않으므로(validation이 막는다), 이
 * 레거시 상태는 직접 행을 심어 재현한다 — 실제로 중단 전 DB에 남아 있는 모양 그대로다.
 */
const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const PROJECT = parseFundingProject(`---
slug: demo
title: 데모
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, 'demo');

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

/** 중단 전 DB에 남아 있을 법한 pending 무통장 행을 직접 심는다. */
const insertLegacyPendingBankTransfer = async () => {
  const manageToken = generateManageToken();
  const [order] = await mockDb.insert(schema.orders).values({
    orderNo: generateOrderNo(NOW), type: 'funding', status: 'pending',
    customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
    itemAmount: 4545, vatAmount: 455, totalAmount: 5000, manageToken,
  }).returning();
  await mockDb.insert(schema.fundingPledges).values({
    orderId: order.id, projectSlug: 'demo', rewardId: 'mail', rewardTitle: '감사 메일',
    unitAmount: 5000, quantity: 1, paymentMethod: 'bank_transfer',
    holdExpiresAt: new Date(NOW.getTime() + 12 * 3600 * 1000), displayNamePublic: false,
  });
  return { orderNo: order.orderNo, manageToken };
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
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
});
afterAll(() => client.close());

it('입금 전 무통장 레거시 행을 취소하면 expired가 된다', async () => {
  const { orderNo, manageToken } = await insertLegacyPendingBankTransfer();
  const r = await call({ orderNo, token: manageToken });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, mode: 'pending_released' });
  expect((await findFundingOrderByOrderNo(orderNo))!.status).toBe('expired');
});

it('같은 신청을 두 번 취소하면 두 번째는 409 — 이미 처리된 건을 되돌리지 않는다', async () => {
  const { orderNo, manageToken } = await insertLegacyPendingBankTransfer();
  expect((await call({ orderNo, token: manageToken })).status).toBe(200);
  const again = await call({ orderNo, token: manageToken });
  expect(again.status).toBe(409);
  expect(again.body).toMatchObject({ ok: false, code: 'invalid_state' });
});

it('토큰이 틀리면 404 — 주문 존재 여부를 흘리지 않는다', async () => {
  const { orderNo } = await insertLegacyPendingBankTransfer();
  const r = await call({ orderNo, token: 'wrong-token' });
  expect(r.status).toBe(404);
  expect((await findFundingOrderByOrderNo(orderNo))!.status).toBe('pending');
});
