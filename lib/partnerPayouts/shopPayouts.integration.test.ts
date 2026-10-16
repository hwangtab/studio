/** @jest-environment node */

/**
 * 상점 아티스트 월 정산 기록 — 실제 SQLite(in-memory, 마이그레이션 전부 적용)로 고정한다.
 * 이 표의 값이 틀리면 운영자는 틀린 금액을 이체한다 — 그래서 계산식·불변 스냅샷·조정의 적용/해제·이중 기록을 데이터로 켜 본다.
 */
import { eq, sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { agreeShopArtistTermsForTest } from '../../tests/helpers/shopFixtures';
import {
  creatorBusinessProfiles, fundingCreators, partnerPayoutAdjustments, partnerPayouts, shopArtists, shopProducts, shopProductSkus,
} from '../../db/schema';
import { isMissingTableError } from '../dbErrors';
import { computeShopArtistPayout } from '../shop/artistPayout';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: [
    { slug: 'file-cd', category: 'album', title: '파일 앨범', description: ['소개'], images: [], skus: [{ id: 'file-cd-std', price: 10000 }], published: true, artist: 'fa' },
  ],
}));
jest.mock('../../data/artists', () => ({
  ...jest.requireActual('../../data/artists'),
  getSupportedArtist: (slug: string) => (slug === 'fa' ? { slug: 'fa', name: '파일 아티스트', taxType: 'invoice' } : jest.requireActual('../../data/artists').getSupportedArtist(slug)),
}));

/* eslint-disable import/first */
import { addManualAdjustment, deleteUnappliedManualAdjustment, insertAdjustmentIfAbsent, listUnappliedAdjustments } from './adjustments';
import { buildShopPayoutPreview, buildShopPayoutPreviews, listShopPayoutsAwaitingRecord, recordShopPayout } from './shop';
import { safeSyncShopLateRefundAdjustments, syncShopLateRefundAdjustments } from './shopLateRefund';
import { deletePartnerPayoutIfPending, findPartnerPayout, listPartnerPayouts, markPartnerPayoutPaid } from './store';
/* eslint-enable import/first */

const SKU_A = 'db-aaaaaaaaaa';
const OCT = '2026-10';
const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const RECORD_AT = new Date('2026-11-05T00:00:00Z'); // 10월분 기록 시각
const SHIPPED = sec('2026-10-15T03:00:00Z');
const NOW = new Date('2026-11-20T03:00:00Z');

let errorSpy: jest.SpyInstance;

const seedCreator = async (over: Partial<typeof fundingCreators.$inferInsert> = {}) => {
  await testDb.insert(fundingCreators).values({
    id: 'c1', email: 'c1@example.com', name: 'DB 아티스트', taxType: 'withholding', payoutAccountEnc: 'enc-account', ...over,
  });
  await testDb.insert(shopArtists).values({ creatorId: 'c1', slug: 'db-artist' });
  await testDb.insert(shopProducts).values({
    id: 'p1', creatorId: 'c1', slug: 'db-product', category: 'goods', title: 'DB 상품', description: '소개', images: '[]',
    reviewStatus: 'approved', published: true,
  });
  await testDb.insert(shopProductSkus).values({ id: SKU_A, productId: 'p1', optionLabel: 'A', price: 20000, lockedAt: 1 });
  await agreeShopArtistTermsForTest(testDb, 'c1');
};

interface PlaceOpts { status?: string; shippedAt?: number | null; qty?: number; skuId?: string; unitPrice?: number; shippingFee?: number }
const placeOrder = async (orderNo: string, opts: PlaceOpts = {}) => {
  const { status = 'paid', shippedAt = SHIPPED, qty = 2, skuId = SKU_A, unitPrice = 20000, shippingFee = 0 } = opts;
  await testDb.run(sql`
    INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES (${`id-${orderNo}`}, ${orderNo}, 'merch', ${status}, '김구매', '010', 'b@e.c', ${`tok-${orderNo}`}, ${unitPrice * qty}, 0, ${unitPrice * qty})
  `);
  await testDb.run(sql`
    INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, subtotal_amount, shipping_fee, hold_expires_at, fulfillment_status, shipped_at)
    VALUES (${orderNo}, '김구매', '010', '03000', '서울', ${unitPrice * qty}, ${shippingFee}, 0, ${shippedAt === null ? 'preparing' : 'shipped'}, ${shippedAt})
  `);
  await testDb.run(sql`
    INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity)
    VALUES (${`it-${orderNo}`}, ${orderNo}, ${skuId}, 'db-product', 'DB 상품', ${unitPrice}, ${qty})
  `);
  await testDb.run(sql`
    INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (${`pay-${orderNo}`}, ${`id-${orderNo}`}, ${`pk-${orderNo}`}, 'card', ${SHIPPED - 86400})
  `);
};

/** 전액 환불 — 주문을 refunded로 옮기고 완료된 환불 행을 `at` 시각으로 남긴다. */
const refundOrder = async (orderNo: string, at: number, amount = 40000) => {
  await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = ${orderNo}`);
  await testDb.run(sql`INSERT INTO refunds (id, payment_id, amount, reason, requested_by, status, created_at) VALUES (${`rf-${orderNo}`}, ${`pay-${orderNo}`}, ${amount}, '테스트', 'admin', 'done', ${at})`);
};

const record = async (key = 'creator:c1', period = OCT, at = RECORD_AT) => {
  const preview = await buildShopPayoutPreview(key, period);
  if (!preview) throw new Error('preview null');
  return recordShopPayout(key, period, at, { netAmount: preview.netAmount, adjustmentAmount: preview.adjustmentAmount });
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe('미리보기 — 계산은 computeShopArtistPayout 그대로', () => {
  it('원천징수 아티스트: 판매액·몫·부가세 상당·원천징수·실이체액이 순수 계산과 같다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    const p = await buildShopPayoutPreview('creator:c1', OCT);
    const expected = computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding' });
    expect(p).toMatchObject({
      payeeName: 'DB 아티스트', creatorId: 'c1', taxType: 'withholding', itemCount: 2, salesAmount: 40000,
      storeAmount: expected.storeAmount, vatDeductionAmount: expected.vatDeductionAmount, shareAmount: expected.shareAmount,
      withholdingAmount: expected.withholdingAmount, netAmount: expected.netAmount, adjustmentAmount: 0, carryOverAmount: 0,
      blockers: [], recorded: null,
    });
    // 주민등록번호가 없으면 막지 않고 경고만 한다(설계 §6).
    expect(p?.warnings).toContain('no_resident_number');
  });

  it('막는 조건: 세금 구분·계좌·약관·사업자 정보 — 각각 따로', async () => {
    await seedCreator({ taxType: null, payoutAccountEnc: null });
    await placeOrder('SHP-1');
    await testDb.run(sql`DELETE FROM shop_artist_terms_agreements`);
    let p = await buildShopPayoutPreview('creator:c1', OCT);
    expect(p?.blockers).toEqual(expect.arrayContaining(['no_tax_type', 'no_payout_account', 'terms_not_agreed']));
    expect(p?.taxType).toBeNull();

    await testDb.update(fundingCreators).set({ taxType: 'invoice', payoutAccountEnc: 'enc' }).where(eq(fundingCreators.id, 'c1'));
    await agreeShopArtistTermsForTest(testDb, 'c1');
    p = await buildShopPayoutPreview('creator:c1', OCT);
    expect(p?.blockers).toEqual(['no_business_number']);

    await testDb.insert(creatorBusinessProfiles).values({ creatorId: 'c1', businessNumber: '7537400653', businessName: 'a', representativeName: 'b' });
    p = await buildShopPayoutPreview('creator:c1', OCT);
    expect(p?.blockers).toEqual([]);
    expect(p?.withholdingAmount).toBe(0);
  });

  it('파일 갈래(file:<slug>)는 계정이 없어 계좌·약관 막음이 없고 기록할 수 있다(creator_id는 null)', async () => {
    await placeOrder('SHP-F', { skuId: 'file-cd-std', unitPrice: 10000, qty: 3 });
    const p = await buildShopPayoutPreview('file:fa', OCT);
    expect(p).toMatchObject({ payeeName: '파일 아티스트', creatorId: null, taxType: 'invoice', salesAmount: 30000, blockers: [] });
    const result = await record('file:fa');
    expect(result.ok).toBe(true);
    const row = await findPartnerPayout('shop', 'file:fa', OCT);
    expect(row).toMatchObject({ creatorId: null, payeeName: '파일 아티스트', taxType: 'invoice', netAmount: computeShopArtistPayout({ salesAmount: 30000, refundAmount: 0, taxType: 'invoice' }).netAmount });
  });

  it('형식이 틀린 키·달은 null', async () => {
    expect(await buildShopPayoutPreview('x:1', OCT)).toBeNull();
    expect(await buildShopPayoutPreview('creator:c1', '2026-13')).toBeNull();
  });
});

describe('기록 — 불변 스냅샷·이중 기록', () => {
  it('기록하면 그 시점의 숫자가 고정된다(이후 판매·세금 구분이 바뀌어도 그대로)', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    const result = await record();
    expect(result.ok).toBe(true);
    const before = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    const expected = computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding' });
    expect(before).toMatchObject({
      kind: 'shop', creatorId: 'c1', payeeName: 'DB 아티스트', taxType: 'withholding', grossAmount: 40000, studioAmount: expected.storeAmount,
      shareAmount: expected.shareAmount, withholdingAmount: expected.withholdingAmount, vatDeductionAmount: expected.vatDeductionAmount,
      netAmount: expected.netAmount, itemCount: 2, status: 'pending', adjustmentAmount: 0, shortfallAmount: 0,
    });

    await placeOrder('SHP-2');
    await testDb.update(fundingCreators).set({ taxType: 'invoice', name: '바뀐 이름' }).where(eq(fundingCreators.id, 'c1'));
    const after = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    expect(after).toEqual(before);
    const preview = await buildShopPayoutPreview('creator:c1', OCT);
    expect(preview?.recorded?.id).toBe(before.id);
    expect(preview?.blockers).toContain('already_recorded');
    expect(preview?.recorded?.grossAmount).toBe(40000); // 새 주문(SHP-2)이 들어왔어도 기록은 그대로
    expect(preview?.salesAmount).toBe(80000);
  });

  it('같은 (아티스트, 달)을 두 번 기록하면 already_recorded — 동시에 눌러도 한 건만', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    const preview = (await buildShopPayoutPreview('creator:c1', OCT))!;
    const expected = { netAmount: preview.netAmount, adjustmentAmount: 0 };
    const results = await Promise.all([
      recordShopPayout('creator:c1', OCT, RECORD_AT, expected),
      recordShopPayout('creator:c1', OCT, RECORD_AT, expected),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)[0]).toMatchObject({ ok: false, code: 'already_recorded' });
    expect(await listPartnerPayouts('shop', OCT)).toHaveLength(1);
    expect(await record()).toMatchObject({ ok: false, code: 'already_recorded' });
  });

  it('막는 조건이 있으면 기록하지 않는다', async () => {
    await seedCreator({ payoutAccountEnc: null });
    await placeOrder('SHP-1');
    const result = await recordShopPayout('creator:c1', OCT, RECORD_AT, { netAmount: 0, adjustmentAmount: 0 });
    expect(result).toMatchObject({ ok: false, code: 'no_payout_account' });
    expect(await listPartnerPayouts('shop')).toHaveLength(0);
  });

  it('판매가 없는 달은 nothing_to_pay', async () => {
    await seedCreator();
    expect(await buildShopPayoutPreview('creator:c1', OCT)).toMatchObject({ blockers: expect.arrayContaining(['nothing_to_pay']) });
    expect(await record()).toMatchObject({ ok: false });
  });

  it('화면이 본 금액과 지금 계산이 다르면 amount_changed — 기록하지 않는다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    const result = await recordShopPayout('creator:c1', OCT, RECORD_AT, { netAmount: 1, adjustmentAmount: 0 });
    expect(result).toMatchObject({ ok: false, code: 'amount_changed', expectedNetAmount: 1 });
    expect(await listPartnerPayouts('shop')).toHaveLength(0);
  });
});

describe('지급 완료 vs 기록 취소', () => {
  it('지급 완료는 한 번만 되고, 지급한 기록은 지울 수 없다. 이체 전 기록은 지우고 다시 기록할 수 있다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await record();
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;

    expect(await markPartnerPayoutPaid(row.id, '10/30 이체', NOW)).toBe(true);
    expect(await markPartnerPayoutPaid(row.id, '또', NOW)).toBe(false);
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('already_paid');
    expect(await findPartnerPayout('shop', 'creator:c1', OCT)).toMatchObject({ status: 'paid', memo: '10/30 이체' });
    expect(await deletePartnerPayoutIfPending('없는-id')).toBe('not_found');

    await testDb.run(sql`DELETE FROM partner_payouts`);
    await record();
    const second = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    expect(await deletePartnerPayoutIfPending(second.id)).toBe('ok');
    expect(await findPartnerPayout('shop', 'creator:c1', OCT)).toBeNull();
    expect((await record()).ok).toBe(true);
  });
});

describe('이월 조정 — 적용·해제·음수 이월', () => {
  it('미적용 조정은 몫을 줄이고, 기록하면 그 정산에 실리고, 기록을 취소하면 풀린다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: -5000, memo: '선지급 상계' });
    const preview = (await buildShopPayoutPreview('creator:c1', OCT))!;
    const expected = computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding', adjustmentAmount: -5000 });
    expect(preview).toMatchObject({ adjustmentAmount: -5000, carryOverAmount: 0, netAmount: expected.netAmount });
    expect(preview.netAmount).toBeLessThan(computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding' }).netAmount);

    expect((await record()).ok).toBe(true);
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    expect(row.adjustmentAmount).toBe(-5000);
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
    const applied = (await buildShopPayoutPreview('creator:c1', OCT))!.appliedAdjustments;
    expect(applied.map((a) => a.amount)).toEqual([-5000]);

    expect(await deletePartnerPayoutIfPending(row.id)).toBe('ok');
    const freed = await listUnappliedAdjustments('shop', 'creator:c1');
    expect(freed.map((a) => [a.amount, a.appliedPayoutId])).toEqual([[-5000, null]]);
  });

  it('조정이 몫을 넘으면 실이체 0원 + 남은 음수는 다음 정산으로 이월(조정 행으로 남는다)', async () => {
    await seedCreator();
    await placeOrder('SHP-1'); // 몫 22,000 (40,000 × 55%)
    await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: -30000, memo: '큰 차감' });
    const preview = (await buildShopPayoutPreview('creator:c1', OCT))!;
    expect(preview).toMatchObject({ netAmount: 0, carryOverAmount: -8000, shareAmount: 0, withholdingAmount: 0 });

    expect((await record()).ok).toBe(true);
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    expect(row).toMatchObject({ netAmount: 0, adjustmentAmount: -30000, shortfallAmount: 8000, status: 'pending' });
    const carried = await listUnappliedAdjustments('shop', 'creator:c1');
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({ amount: -8000, sourceRef: `carryover:${row.id}`, reason: 'manual' });

    // 다음 달 정산은 이 이월분을 먼저 차감한다.
    await placeOrder('SHP-NOV', { shippedAt: sec('2026-11-10T03:00:00Z') });
    const nov = (await buildShopPayoutPreview('creator:c1', '2026-11'))!;
    expect(nov.adjustmentAmount).toBe(-8000);
    expect(nov.netAmount).toBe(computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding', adjustmentAmount: -8000 }).netAmount);

    // 이월 조정이 다음 정산에 실린 뒤에는 앞 정산을 취소할 수 없다.
    expect((await record('creator:c1', '2026-11', new Date('2026-12-05T00:00:00Z'))).ok).toBe(true);
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('adjustment_applied');
  });

  it('이월분이 있는 정산을 취소하면 이월 조정도 지워지고 해제된 조정이 돌아온다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: -30000, memo: '큰 차감' });
    await record();
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('ok');
    const rows = await testDb.select().from(partnerPayoutAdjustments);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: -30000, appliedPayoutId: null });
  });

  it('기록하는 사이 조정이 늘면 amount_changed로 막힌다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    const preview = (await buildShopPayoutPreview('creator:c1', OCT))!;
    await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: -1000, memo: '그사이' });
    const result = await recordShopPayout('creator:c1', OCT, RECORD_AT, { netAmount: preview.netAmount, adjustmentAmount: 0 });
    expect(result).toMatchObject({ ok: false, code: 'amount_changed' });
    expect(await listPartnerPayouts('shop')).toHaveLength(0);
  });

  it('수기 조정만 지울 수 있다 — 시스템이 만든 조정·이미 실린 조정은 거부', async () => {
    await seedCreator();
    await insertAdjustmentIfAbsent({ kind: 'shop', payeeKey: 'creator:c1', amount: -100, reason: 'late_refund', sourceRef: 'SHP-X' });
    await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: -200, memo: '수기' });
    const [system, manual] = (await listUnappliedAdjustments('shop', 'creator:c1')).sort((a, b) => a.amount - b.amount).reverse();
    expect(system.reason).toBe('late_refund');
    expect(await deleteUnappliedManualAdjustment(system.id)).toBe(false);
    expect(await deleteUnappliedManualAdjustment(manual.id)).toBe(true);
    expect(await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: 0, memo: 'x' })).toBe('invalid');
    expect(await addManualAdjustment({ kind: 'shop', payeeKey: 'creator:c1', amount: 5, memo: '  ' })).toBe('invalid');
  });

  it('같은 사건(주문번호)의 조정은 한 번만 쌓인다', async () => {
    expect(await insertAdjustmentIfAbsent({ kind: 'shop', payeeKey: 'creator:c1', amount: -100, reason: 'late_refund', sourceRef: 'SHP-X' })).toBe('inserted');
    expect(await insertAdjustmentIfAbsent({ kind: 'shop', payeeKey: 'creator:c1', amount: -100, reason: 'late_refund', sourceRef: 'SHP-X' })).toBe('exists');
    expect(await insertAdjustmentIfAbsent({ kind: 'shop', payeeKey: 'creator:c1', amount: 0, reason: 'late_refund', sourceRef: 'SHP-Y' })).toBe('zero');
    expect(await testDb.select().from(partnerPayoutAdjustments)).toHaveLength(1);
  });
});

describe('정산 뒤 환불 → late_refund 조정', () => {
  const AFTER_RECORD = sec('2026-11-10T00:00:00Z');

  it('기록된 정산의 주문이 환불되면 −(판매가×55%) 조정이 쌓이고, 몇 번 불러도 한 번만', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await record();
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    await refundOrder('SHP-1', AFTER_RECORD);

    expect(await syncShopLateRefundAdjustments({ orderNo: 'SHP-1' })).toEqual({ created: 1, existing: 0 });
    expect(await syncShopLateRefundAdjustments({ orderNo: 'SHP-1' })).toEqual({ created: 0, existing: 1 });
    await safeSyncShopLateRefundAdjustments('SHP-1');
    const adj = await listUnappliedAdjustments('shop', 'creator:c1');
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ amount: -22000, reason: 'late_refund', sourceRef: 'SHP-1', originPayoutId: row.id });

    // 다음 달 정산에서 빠진다.
    await placeOrder('SHP-NOV', { shippedAt: sec('2026-11-12T03:00:00Z') });
    const nov = (await buildShopPayoutPreview('creator:c1', '2026-11'))!;
    expect(nov.adjustmentAmount).toBe(-22000);
    expect(nov.netAmount).toBe(computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding', adjustmentAmount: -22000 }).netAmount);
  });

  it('아티스트가 직접 보낸 주문은 배송비 전액도 함께 뺀다', async () => {
    await seedCreator();
    await testDb.run(sql`INSERT INTO shop_product_fulfillment (product_id, mode) VALUES ('p1', 'artist')`);
    await placeOrder('SHP-1', { shippingFee: 4000 });
    await record();
    await refundOrder('SHP-1', AFTER_RECORD, 44000);
    await syncShopLateRefundAdjustments({ orderNo: 'SHP-1' });
    expect((await listUnappliedAdjustments('shop', 'creator:c1'))[0].amount).toBe(-(22000 + 4000));
  });

  it('기록보다 먼저 환불됐거나, 기록 뒤에 발송된 주문, 부분 환불, 기록이 없는 달은 만들지 않는다', async () => {
    await seedCreator();
    const MID_RECORD = new Date('2026-10-20T00:00:00Z'); // 10월 중간에 기록 — 그 뒤 발송된 주문은 스냅샷에 없다
    await placeOrder('SHP-EARLY'); // 기록 전에 환불 → 스냅샷에 애초에 없다
    await refundOrder('SHP-EARLY', sec('2026-10-18T00:00:00Z'));
    await placeOrder('SHP-PART', { status: 'partially_refunded' });
    await placeOrder('SHP-OK');
    await placeOrder('SHP-LATE', { shippedAt: sec('2026-10-25T00:00:00Z') });
    expect((await record('creator:c1', OCT, MID_RECORD)).ok).toBe(true);
    await refundOrder('SHP-LATE', AFTER_RECORD);
    for (const o of ['SHP-EARLY', 'SHP-PART', 'SHP-LATE']) expect(await syncShopLateRefundAdjustments({ orderNo: o })).toEqual({ created: 0, existing: 0 });
    // 기록 안 된 달(11월)에 발송된 환불 주문 — 뺄 정산이 없다.
    await placeOrder('SHP-NOVREF', { shippedAt: sec('2026-11-12T00:00:00Z') });
    await refundOrder('SHP-NOVREF', AFTER_RECORD);
    expect(await syncShopLateRefundAdjustments({ orderNo: 'SHP-NOVREF' })).toEqual({ created: 0, existing: 0 });
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
    // 대조: 스냅샷에 있던 주문은 환불되면 만들어진다.
    await refundOrder('SHP-OK', AFTER_RECORD);
    expect(await syncShopLateRefundAdjustments({ orderNo: 'SHP-OK' })).toEqual({ created: 1, existing: 0 });
  });

  it('기록 직전 보충이 빠진 조정을 메운다 — subjectKey 모드', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await record();
    await refundOrder('SHP-1', AFTER_RECORD); // 환불 경로가 조정을 못 쌓았다고 치자
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
    expect(await syncShopLateRefundAdjustments({ subjectKey: 'creator:c1' })).toEqual({ created: 1, existing: 0 });
    // 기록 시각 이후 환불이 여럿이어도 다른 아티스트 키는 건드리지 않는다.
    expect(await syncShopLateRefundAdjustments({ subjectKey: 'creator:other' })).toEqual({ created: 0, existing: 0 });
  });

  it('이체 전 기록을 취소하면 그 정산을 바로잡던 환불 조정도 지워진다(이중 공제 방지) — 다시 기록해도 보충이 되살리지 않는다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await placeOrder('SHP-2');
    await record();
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    await refundOrder('SHP-1', AFTER_RECORD);
    await syncShopLateRefundAdjustments({ orderNo: 'SHP-1' });
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toHaveLength(1);

    expect(await deletePartnerPayoutIfPending(row.id)).toBe('ok');
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
    // 다시 기록 — 스냅샷이 환불을 이미 반영한다(SHP-2만 센다). 기록 직전 보충이 SHP-1을 되살리지 않아야 한다.
    const again = await recordShopPayout('creator:c1', OCT, new Date('2026-11-12T00:00:00Z'), {
      netAmount: computeShopArtistPayout({ salesAmount: 40000, refundAmount: 0, taxType: 'withholding' }).netAmount, adjustmentAmount: 0,
    });
    expect(again.ok).toBe(true);
    await syncShopLateRefundAdjustments({ subjectKey: 'creator:c1' });
    expect(await listUnappliedAdjustments('shop', 'creator:c1')).toEqual([]);
  });

  it('이 정산을 바로잡는 환불 조정이 다른 달 정산에 이미 실렸으면 취소할 수 없다', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await record();
    const row = (await findPartnerPayout('shop', 'creator:c1', OCT))!;
    await refundOrder('SHP-1', AFTER_RECORD);
    await syncShopLateRefundAdjustments({ orderNo: 'SHP-1' });
    await placeOrder('SHP-NOV', { shippedAt: sec('2026-11-12T03:00:00Z') });
    expect((await record('creator:c1', '2026-11', new Date('2026-12-05T00:00:00Z'))).ok).toBe(true);
    expect(await deletePartnerPayoutIfPending(row.id)).toBe('adjustment_applied');
    expect(await findPartnerPayout('shop', 'creator:c1', OCT)).not.toBeNull();
  });

  it('fail-soft: 조정 표를 못 읽어도 던지지 않는다(환불이 이 때문에 실패하면 안 된다)', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await record();
    await refundOrder('SHP-1', AFTER_RECORD);
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await expect(safeSyncShopLateRefundAdjustments('SHP-1')).resolves.toBeUndefined();
    await testDb.run(sql`DROP TABLE partner_payouts`);
    await expect(safeSyncShopLateRefundAdjustments('SHP-1')).resolves.toBeUndefined();
  });
});

describe('표가 없는 DB(마이그레이션 0067 전)', () => {
  it('정산 표 조회는 "no such table"로 던져 화면이 안내를 띄운다 — 판매 집계는 그대로', async () => {
    await seedCreator();
    await placeOrder('SHP-1');
    await testDb.run(sql`DROP TABLE partner_payout_adjustments`);
    await testDb.run(sql`DROP TABLE partner_payouts`);
    const missing = (e: unknown) => isMissingTableError(e, 'partner_payouts');
    const caught = await buildShopPayoutPreviews(OCT).then(() => null, (e: unknown) => e);
    expect(missing(caught)).toBe(true);
    const caught2 = await listShopPayoutsAwaitingRecord(NOW).then(() => null, (e: unknown) => e);
    expect(missing(caught2)).toBe(true);
  });
});

describe('listShopPayoutsAwaitingRecord — 이번 달 이전, 기록 안 된 달', () => {
  it('지난 달 판매가 있고 기록이 없으면 센다. 기록하면 빠지고, 이번 달 판매는 세지 않는다', async () => {
    await seedCreator();
    await placeOrder('SHP-1'); // 10월 발송
    await placeOrder('SHP-NOV', { shippedAt: sec('2026-11-10T03:00:00Z') }); // 이번 달(NOW=11월)
    expect(await listShopPayoutsAwaitingRecord(NOW)).toEqual([{ subjectKey: 'creator:c1', payeeName: 'DB 아티스트', period: OCT }]);
    await record();
    expect(await listShopPayoutsAwaitingRecord(NOW)).toEqual([]);
  });

  it('기록 시작 달(2026-10) 이전은 독촉하지 않는다', async () => {
    await seedCreator();
    await placeOrder('SHP-SEP', { shippedAt: sec('2026-09-10T03:00:00Z') });
    expect(await listShopPayoutsAwaitingRecord(NOW)).toEqual([]);
  });
});

describe('열람 범위', () => {
  it('미리보기에는 계좌·주민등록번호 값이 없다(존재 여부만)', async () => {
    await seedCreator({ residentNumberEnc: 'enc-rrn-secret' });
    await placeOrder('SHP-1');
    const json = JSON.stringify(await buildShopPayoutPreview('creator:c1', OCT));
    expect(json).not.toContain('enc-account');
    expect(json).not.toContain('enc-rrn-secret');
    expect(await testDb.select().from(partnerPayouts)).toEqual([]);
  });
});
