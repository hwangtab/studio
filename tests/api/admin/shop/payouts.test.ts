/** @jest-environment node */
/**
 * POST /api/admin/shop/payouts — 인증·검증·기록/지급 완료/취소/조정 액션. 계산·불변식 자체는
 * lib/partnerPayouts/shopPayouts.integration.test.ts가 데이터로 고정한다 — 여기서는 라우트 계약만 본다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../../helpers/showsDb';
import { agreeShopArtistTermsForTest } from '../../../helpers/shopFixtures';
import { fundingCreators, partnerPayouts, shopArtists, shopProducts, shopProductSkus } from '../../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../../data/shop/catalog', () => ({ ...jest.requireActual('../../../../data/shop/catalog'), SHOP_PRODUCTS: [] }));
const mockAuth = jest.fn();
jest.mock('../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: (...args: unknown[]) => mockAuth(...args) }));

/* eslint-disable import/first */
import handler from '../../../../pages/api/admin/shop/payouts';
import { buildShopPayoutPreview } from '../../../../lib/partnerPayouts/shop';
import { findPartnerPayout } from '../../../../lib/partnerPayouts/store';
import { listUnappliedAdjustments } from '../../../../lib/partnerPayouts/adjustments';
/* eslint-enable import/first */

const SKU = 'db-aaaaaaaaaa';
const SHIPPED = Math.floor(new Date('2026-10-15T03:00:00Z').getTime() / 1000);

function call(req: Partial<NextApiRequest>) {
  return new Promise<{ status: number; body: Record<string, unknown>; headers: Record<string, string> }>((resolve) => {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (k: string, v: string) => { headers[k] = v; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: Record<string, unknown>) { resolve({ status: this.statusCode, body, headers }); return this; },
    };
    Promise.resolve(handler({ method: 'POST', headers: {}, socket: {}, ...req } as NextApiRequest, res as unknown as NextApiResponse));
  });
}

const seed = async () => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트', taxType: 'invoice', payoutAccountEnc: 'enc' });
  await testDb.run(sql`INSERT INTO creator_business_profiles (creator_id, business_number, business_name, representative_name) VALUES ('c1', '7537400653', 'a', 'b')`);
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'a' });
  await agreeShopArtistTermsForTest(testDb, 'c1');
  await testDb.insert(shopProducts).values({ id: 'p1', creatorId: 'c1', slug: 'p1', category: 'goods', title: '상품', description: '소개', images: '[]', reviewStatus: 'approved', published: true });
  await testDb.insert(shopProductSkus).values({ id: SKU, productId: 'p1', optionLabel: 'A', price: 20000, lockedAt: 1 });
  await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES ('o1', 'SHP-1', 'merch', 'paid', 'x', '010', 'b@e.c', 'tok', 40000, 0, 40000)`);
  await testDb.run(sql`INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, subtotal_amount, shipping_fee, hold_expires_at, fulfillment_status, shipped_at)
    VALUES ('SHP-1', 'x', '010', '03000', '서울', 40000, 0, 0, 'shipped', ${SHIPPED})`);
  await testDb.run(sql`INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity) VALUES ('i1', 'SHP-1', ${SKU}, 'p1', '상품', 20000, 2)`);
};

const recordBody = async () => {
  const p = (await buildShopPayoutPreview('creator:c1', '2026-10'))!;
  return { action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: p.netAmount, adjustmentAmount: p.adjustmentAmount } };
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  mockAuth.mockResolvedValue({ ok: true, actor: 'admin' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await seed();
});
afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('인증·메서드·검증', () => {
  it('인증이 없으면 401, GET은 405, 모든 응답은 no-store', async () => {
    mockAuth.mockResolvedValueOnce({ ok: false });
    const unauth = await call({ body: await recordBody() });
    expect(unauth.status).toBe(401);
    expect(unauth.headers['Cache-Control']).toBe('no-store');
    expect((await call({ method: 'GET' })).status).toBe(405);
  });

  it('필수 값이 없거나 알 수 없는 작업이면 400', async () => {
    expect((await call({ body: { action: 'record', subjectKey: 'creator:c1' } })).status).toBe(400);
    expect((await call({ body: { action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: 'x', adjustmentAmount: 0 } } })).status).toBe(400);
    expect((await call({ body: { action: 'nope' } })).status).toBe(400);
    expect((await call({ body: { action: 'mark_paid' } })).status).toBe(400);
    expect((await call({ body: { action: 'add_adjustment', subjectKey: 'bad', amount: -5, memo: 'x' } })).status).toBe(400);
    expect((await call({ body: { action: 'add_adjustment', subjectKey: 'creator:c1', amount: 0, memo: 'x' } })).status).toBe(400);
    expect((await call({ body: { action: 'add_adjustment', subjectKey: 'creator:c1', amount: -5, memo: '  ' } })).status).toBe(400);
  });
});

describe('record · mark_paid · delete', () => {
  it('기록 → 이중 기록 409 → 지급 완료 → 지급한 기록 취소 409', async () => {
    const ok = await call({ body: await recordBody() });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ ok: true });
    const row = (await findPartnerPayout('shop', 'creator:c1', '2026-10'))!;
    expect(row.id).toBe(ok.body.payoutId);

    const dup = await call({ body: await recordBody() });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ code: 'already_recorded' });

    expect((await call({ body: { action: 'mark_paid', id: row.id, memo: '  10/30 이체  ' } })).status).toBe(200);
    expect(await findPartnerPayout('shop', 'creator:c1', '2026-10')).toMatchObject({ status: 'paid', memo: '10/30 이체' });
    expect((await call({ body: { action: 'mark_paid', id: row.id } })).status).toBe(409);
    const del = await call({ body: { action: 'delete', id: row.id } });
    expect(del.status).toBe(409);
    expect(await findPartnerPayout('shop', 'creator:c1', '2026-10')).not.toBeNull();
  });

  it('이체 전 기록은 취소할 수 있고 다시 기록된다', async () => {
    await call({ body: await recordBody() });
    const row = (await findPartnerPayout('shop', 'creator:c1', '2026-10'))!;
    expect((await call({ body: { action: 'delete', id: row.id } })).status).toBe(200);
    expect(await findPartnerPayout('shop', 'creator:c1', '2026-10')).toBeNull();
    expect((await call({ body: await recordBody() })).status).toBe(200);
  });

  it('막는 조건은 409와 사유 문구 — 계좌 미등록', async () => {
    await testDb.run(sql`UPDATE funding_creators SET payout_account_enc = NULL WHERE id = 'c1'`);
    const r = await call({ body: { action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: 22000, adjustmentAmount: 0 } } });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ ok: false, code: 'no_payout_account' });
    expect(String(r.body.message)).toContain('정산 계좌');
    expect(await findPartnerPayout('shop', 'creator:c1', '2026-10')).toBeNull();
  });

  it('화면과 다른 금액은 409 amount_changed, 형식이 틀린 대상은 400', async () => {
    const changed = await call({ body: { action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: 1, adjustmentAmount: 0 } } });
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({ code: 'amount_changed', expectedNetAmount: 1 });
    const bad = await call({ body: { action: 'record', subjectKey: 'x:1', period: '2026-10', expected: { netAmount: 1, adjustmentAmount: 0 } } });
    expect(bad.status).toBe(400);
  });

  it('공연(P2) 정산 기록은 상점 라우트로 지급·취소할 수 없다', async () => {
    const [show] = await testDb.insert(partnerPayouts).values({
      kind: 'show', subjectKey: 'show-1', period: 'all', creatorId: 'c1', payeeName: 'x', taxType: 'invoice', netAmount: 1,
    }).returning();
    expect((await call({ body: { action: 'mark_paid', id: show.id } })).status).toBe(404);
    expect((await call({ body: { action: 'delete', id: show.id } })).status).toBe(404);
  });

  it('표가 없는 DB(0066 전)는 503 migration_needed', async () => {
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await testDb.run(sql`DROP TABLE partner_payouts`);
    const r = await call({ body: { action: 'record', subjectKey: 'creator:c1', period: '2026-10', expected: { netAmount: 1, adjustmentAmount: 0 } } });
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ code: 'migration_needed' });
    expect(String(r.body.message)).toContain('0066');
  });
});

describe('add_adjustment · delete_adjustment', () => {
  it('수기 조정을 쌓고 지울 수 있다. 기록하면 정산에 실린다', async () => {
    expect((await call({ body: { action: 'add_adjustment', subjectKey: 'creator:c1', amount: -3000, memo: '선지급 상계' } })).status).toBe(200);
    const [adj] = await listUnappliedAdjustments('shop', 'creator:c1');
    expect(adj).toMatchObject({ amount: -3000, reason: 'manual', memo: '선지급 상계' });
    expect((await call({ body: { action: 'delete_adjustment', id: adj.id } })).status).toBe(200);
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);

    await call({ body: { action: 'add_adjustment', subjectKey: 'creator:c1', amount: -3000, memo: '다시' } });
    expect((await call({ body: await recordBody() })).status).toBe(200);
    const [applied] = await testDb.all<{ id: string }>(sql`SELECT id FROM partner_payout_adjustments`);
    // 이미 정산에 실린 조정은 지울 수 없다.
    expect((await call({ body: { action: 'delete_adjustment', id: applied.id } })).status).toBe(409);
  });

  it('너무 큰 금액은 400', async () => {
    expect((await call({ body: { action: 'add_adjustment', subjectKey: 'creator:c1', amount: -1_000_000_000, memo: 'x' } })).status).toBe(400);
  });
});
