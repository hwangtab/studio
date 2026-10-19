/** @jest-environment node */
/** POST /api/admin/payment-links — 인증·검증·발급·닫기. 조회·만료 규칙 자체는 lib/payments/paymentLinks.integration.test.ts. */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
const mockAuth = jest.fn();
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...a: unknown[]) => mockAuth(...a) }));

/* eslint-disable import/first */
import handler from '../../../pages/api/admin/payment-links';
import { findPaymentLink } from '../../../lib/payments/paymentLinks';
/* eslint-enable import/first */

function call(req: Partial<NextApiRequest>) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      status(code: number) { this.statusCode = code; return this; },
      json(body: Record<string, unknown>) { resolve({ status: this.statusCode, body }); return this; },
    };
    Promise.resolve(handler({ method: 'POST', headers: {}, socket: {}, ...req } as NextApiRequest, res as unknown as NextApiResponse));
  });
}

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  mockAuth.mockResolvedValue({ ok: true });
});

const body = { action: 'create', itemName: '보컬 녹음 3시간 (10/17 11:00)', totalAmount: 250000, expiresOn: '', memo: '김준호님' };

it('관리자 인증이 없으면 401이고 아무것도 만들지 않는다', async () => {
  mockAuth.mockResolvedValue({ ok: false });
  expect((await call({ body })).status).toBe(401);
  expect(await testDb.query.paymentLinks.findMany()).toHaveLength(0);
});

it('만들면 201과 주소를 돌려주고 그 링크가 바로 열린다', async () => {
  const r = await call({ body });
  expect(r.status).toBe(201);
  expect(r.body.path).toBe(`/ko/pay/${r.body.slug}`);
  expect(await findPaymentLink(r.body.slug)).toEqual({ itemName: body.itemName, totalAmount: 250000 });
});

it('검증에 걸리면 400 — 금액 자릿수 실수', async () => {
  const r = await call({ body: { ...body, totalAmount: 250 } });
  expect(r.status).toBe(400);
  expect(await testDb.query.paymentLinks.findMany()).toHaveLength(0);
});

it('닫으면 열리지 않고, 다시 닫기는 409', async () => {
  const slug = (await call({ body })).body.slug as string;
  expect((await call({ body: { action: 'close', slug } })).status).toBe(200);
  expect(await findPaymentLink(slug)).toBeNull();
  expect((await call({ body: { action: 'close', slug } })).status).toBe(409);
});

it('금액을 고치는 액션은 없다 — 알 수 없는 작업은 400', async () => {
  expect((await call({ body: { action: 'update', slug: 'x', totalAmount: 1 } })).status).toBe(400);
});

it('이용 일시를 넣어 만들면 슬롯이 막히고(blocked), 결제 없이 닫으면 풀린다(blockReleased)', async () => {
  const at = new Date(Date.now() + 3 * 24 * 3600 * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 13) + ':00';
  const created = await call({ body: { ...body, sessionAt: at, sessionHours: 3 } });
  expect(created.status).toBe(201);
  expect(created.body.blocked).toBe(true);
  expect(await testDb.query.availabilityBlocks.findMany()).toHaveLength(1);
  const closed = await call({ body: { action: 'close', slug: created.body.slug } });
  expect(closed.body).toMatchObject({ ok: true, blockReleased: true });
  expect(await testDb.query.availabilityBlocks.findMany()).toHaveLength(0);
});
