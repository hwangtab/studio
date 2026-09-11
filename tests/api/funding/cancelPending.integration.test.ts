/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/projects', () => ({ ...jest.requireActual('../../../lib/funding/projects'), getFundingProject: () => PROJECT }));

// eslint-disable-next-line import/first
import type { NextApiRequest, NextApiResponse } from 'next';
// eslint-disable-next-line import/first
import handler from '../../../pages/api/funding/cancel';
// eslint-disable-next-line import/first
import { createFundingPledge, findFundingOrderByOrderNo } from '../../../lib/funding/service';
// eslint-disable-next-line import/first
import { parseFundingProject } from '../../../lib/funding/projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from '../../../lib/funding/validation';

/**
 * 무통장 pending을 고객이 스스로 푸는 경로(항목 7).
 *
 * 같은 이메일+전화로 열어 둘 수 있는 무통장 홀드는 2건이고, 홀드는 12시간짜리다
 * (lib/funding/service.ts MAX_OPEN_HOLDS_PER_CUSTOMER). 예전에는 세 번째 신청이 막혀도
 * 후원자가 직접 풀 수단이 없어 12시간을 기다려야 했다 — 한정 리워드라면 그동안 재고도
 * 함께 묶인다. 이 테스트는 "취소하면 곧바로 다시 신청할 수 있다"를 실제 DB로 확인한다.
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

const payload = (): CreatePledgePayload => ({
  projectSlug: 'demo', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'bank_transfer',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: false, termsAgreed: true,
});
const reward = PROJECT.rewards[0];

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
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

it('입금 전 무통장 신청을 취소하면 expired가 되고, 막혀 있던 새 신청이 곧바로 통과한다', async () => {
  const first = await createFundingPledge(payload(), PROJECT, reward, NOW);
  const second = await createFundingPledge(payload(), PROJECT, reward, NOW);
  if (!first.ok || !second.ok) throw new Error('사전 조건');
  // 세 번째는 홀드 상한에 막힌다 — 지금까지는 12시간을 기다리는 수밖에 없었다.
  const blocked = await createFundingPledge(payload(), PROJECT, reward, NOW);
  expect(blocked).toEqual({ ok: false, code: 'too_many_bank_holds' });

  const r = await call({ orderNo: first.orderNo, token: first.manageToken });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, mode: 'pending_released' });
  expect((await findFundingOrderByOrderNo(first.orderNo))!.status).toBe('expired');

  // 홀드가 하나 풀렸으니 다시 신청할 수 있다.
  const retry = await createFundingPledge(payload(), PROJECT, reward, NOW);
  expect(retry.ok).toBe(true);
});

it('같은 신청을 두 번 취소하면 두 번째는 409 — 이미 처리된 건을 되돌리지 않는다', async () => {
  const created = await createFundingPledge(payload(), PROJECT, reward, NOW);
  if (!created.ok) throw new Error('사전 조건');
  expect((await call({ orderNo: created.orderNo, token: created.manageToken })).status).toBe(200);
  const again = await call({ orderNo: created.orderNo, token: created.manageToken });
  expect(again.status).toBe(409);
  expect(again.body).toMatchObject({ ok: false, code: 'invalid_state' });
});

it('토큰이 틀리면 404 — 주문 존재 여부를 흘리지 않는다', async () => {
  const created = await createFundingPledge(payload(), PROJECT, reward, NOW);
  if (!created.ok) throw new Error('사전 조건');
  const r = await call({ orderNo: created.orderNo, token: 'wrong-token' });
  expect(r.status).toBe(404);
  expect((await findFundingOrderByOrderNo(created.orderNo))!.status).toBe('pending');
});
