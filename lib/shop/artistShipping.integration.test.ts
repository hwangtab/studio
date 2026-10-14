/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../data/shop/policy', () => ({ ...jest.requireActual('../../data/shop/policy'), SHOP_SALES_OPEN: true }));
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

/* eslint-disable import/first */
import { listAdminShopOrders, listShopArtistSales } from './adminQueries';
import {
  ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS, ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS,
  countArtistShipments, isArtistShippingMasked, loadArtistShippingOrders, resolveOrderShipper,
} from './artistShipping';
import { setOwnSkuStock } from './creatorStock';
import { sendShopOrderConfirmedEmails } from './email';
import { markShopOrderDelivered, markShopOrderShipped } from './fulfillment';
import { loadProductFulfillmentMode, setProductFulfillmentMode } from './fulfillmentMode';
import { applyShopAdminAction } from './reviewDecision';
import { createShopOrder, findShopOrderByOrderNo } from './service';
import { findSellableSkuAsync } from './repository';
import ordersHandler from '../../pages/api/shop/orders';
import { sendEmail } from '../email/resend';
import { SHOP_SHIPPING_FEE } from '../../data/shop/policy';
import { SHOP_MIXED_SHIPPER_MESSAGE } from './shipper';
/* eslint-enable import/first */

const A_PHY = 'db-aaaaaaaaaa'; // 아티스트 A가 직접 보내는 실물
const A_PHY2 = 'db-aaaaaaaab2';
const B_PHY = 'db-bbbbbbbbbb'; // 아티스트 B가 직접 보내는 실물
const S_PHY = 'db-ssssssssss'; // 아티스트 A의 상품이지만 스튜디오가 보내는 실물
const D_DIG = 'db-dddddddddd'; // 디지털
const DAY = 86400;

const seed = async () => {
  await testDb.insert(fundingCreators).values([
    { id: 'cA', email: 'a@example.com', name: '아티스트A', taxType: 'invoice' },
    { id: 'cB', email: 'b@example.com', name: '아티스트B', taxType: 'withholding' },
  ]);
  await testDb.insert(shopArtists).values([{ creatorId: 'cA', slug: 'artist-a' }, { creatorId: 'cB', slug: 'artist-b' }]);
  const base = { category: 'goods' as const, description: '소개', images: '[]', reviewStatus: 'approved' as const, published: true };
  await testDb.insert(shopProducts).values([
    { id: 'pA', creatorId: 'cA', slug: 'a-goods', title: 'A 굿즈', ...base },
    { id: 'pA2', creatorId: 'cA', slug: 'a-goods-2', title: 'A 굿즈 2', ...base },
    { id: 'pB', creatorId: 'cB', slug: 'b-goods', title: 'B 굿즈', ...base },
    { id: 'pS', creatorId: 'cA', slug: 'a-studio', title: 'A 위탁 굿즈', ...base },
    { id: 'pD', creatorId: 'cA', slug: 'a-digital', title: 'A 디지털', ...base, kind: 'digital' as const, digitalFiles: JSON.stringify([{ label: '음원', key: 'shop/a/x.zip' }]) },
  ]);
  await testDb.insert(shopProductSkus).values([
    { id: A_PHY, productId: 'pA', price: 20000, lockedAt: 1 },
    { id: A_PHY2, productId: 'pA2', price: 10000, lockedAt: 1 },
    { id: B_PHY, productId: 'pB', price: 30000, lockedAt: 1 },
    { id: S_PHY, productId: 'pS', price: 15000, lockedAt: 1 },
    { id: D_DIG, productId: 'pD', price: 5000, lockedAt: 1 },
  ]);
  await testDb.insert(shopSkus).values([
    { id: A_PHY, productSlug: 'a-goods', stock: 50 }, { id: A_PHY2, productSlug: 'a-goods-2', stock: 50 },
    { id: B_PHY, productSlug: 'b-goods', stock: 50 }, { id: S_PHY, productSlug: 'a-studio', stock: 50 },
    { id: D_DIG, productSlug: 'a-digital', stock: 50 }, { id: 'test-cd-std', productSlug: 'test-cd', stock: 50 },
  ]);
  await testDb.run(sql`INSERT INTO shop_product_fulfillment (product_id, mode) VALUES ('pA', 'artist'), ('pA2', 'artist'), ('pB', 'artist'), ('pS', 'studio')`);
};

const place = async (lines: Array<{ skuId: string; quantity: number }>, withShipping = true) => {
  const body = withShipping ? shopPayload(lines) : shopPayload(lines, { shipping: undefined });
  const r = await createShopOrder(body as never, new Date(), { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
  return r;
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seed();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

describe('한 주문 = 한 발송 주체 (서버)', () => {
  it('같은 아티스트의 직접 발송 상품끼리는 담을 수 있다', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: A_PHY, quantity: 1 }, { skuId: A_PHY2, quantity: 1 }]), new Date(), { salesOpen: true });
    expect(r.ok).toBe(true);
  });

  it.each([
    ['아티스트 직접 발송 + 스튜디오 발송(같은 아티스트의 위탁 상품)', [A_PHY, S_PHY]],
    ['아티스트 직접 발송 + 파일 카탈로그 상품(스튜디오)', [A_PHY, 'test-cd-std']],
    ['서로 다른 아티스트의 직접 발송', [A_PHY, B_PHY]],
  ])('섞이면 mixed_shipper로 거절하고 주문 행이 남지 않는다 — %s', async (_name, skuIds) => {
    const r = await createShopOrder(shopPayload(skuIds.map((skuId) => ({ skuId, quantity: 1 }))), new Date(), { salesOpen: true });
    expect(r).toEqual({ ok: false, code: 'mixed_shipper' });
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });

  it('디지털 상품은 어느 발송 주체의 실물과도 함께 담지 않는다(mixed_kind)', async () => {
    for (const phy of [A_PHY, B_PHY, S_PHY]) {
      expect(await createShopOrder(shopPayload([{ skuId: phy, quantity: 1 }, { skuId: D_DIG, quantity: 1 }]), new Date(), { salesOpen: true }))
        .toEqual({ ok: false, code: 'mixed_kind' });
    }
  });

  it('API가 사람이 읽는 400 메시지로 답한다', async () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const body = shopPayload([{ skuId: A_PHY, quantity: 1 }, { skuId: B_PHY, quantity: 1 }]);
    await ordersHandler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, { setHeader: jest.fn(), status } as unknown as NextApiResponse);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ ok: false, code: 'mixed_shipper', message: SHOP_MIXED_SHIPPER_MESSAGE });
    expect(SHOP_MIXED_SHIPPER_MESSAGE).toMatch(/같은 아티스트의 상품끼리만/);
  });

  it('공개 상품 객체가 발송 주체를 싣는다 — 아티스트 slug만, id는 싣지 않는다', async () => {
    const found = await findSellableSkuAsync(A_PHY);
    expect('found' in found && found.found?.product.shippedByArtist).toBe('artist-a');
    expect(JSON.stringify(found)).not.toContain('cA');
    const studio = await findSellableSkuAsync(S_PHY);
    expect('found' in studio && studio.found?.product.shippedByArtist).toBeUndefined();
  });
});

describe('아티스트 발송 목록 — 자기 주문만', () => {
  it('자기 직접 발송 주문의 받는 분 정보를 싣고, 남의 주문·스튜디오 주문은 안 보인다', async () => {
    const a = await place([{ skuId: A_PHY, quantity: 2 }]);
    await place([{ skuId: B_PHY, quantity: 1 }]);
    await place([{ skuId: S_PHY, quantity: 1 }]);
    await place([{ skuId: 'test-cd-std', quantity: 1 }]);

    const rowsA = await loadArtistShippingOrders('cA');
    expect(rowsA.map((r) => r.orderNo)).toEqual([a.orderNo]);
    expect(rowsA[0]).toMatchObject({
      items: [{ label: 'A 굿즈', quantity: 2, serials: null }],
      recipientName: '김구매', recipientPhone: '010-1234-5678', postcode: '03000', address1: '서울 종로구 어딘가 1', fulfillmentStatus: 'preparing', masked: false,
    });
    const rowsB = await loadArtistShippingOrders('cB');
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0].orderNo).not.toBe(a.orderNo);
    expect(await loadArtistShippingOrders('cNobody')).toEqual([]);
  });

  it('주문자 이메일·관리 토큰·결제 금액은 읽지 않는다', async () => {
    const a = await place([{ skuId: A_PHY, quantity: 1 }]);
    const token = (await findShopOrderByOrderNo(a.orderNo))!.manageToken;
    const json = JSON.stringify(await loadArtistShippingOrders('cA'));
    expect(json).not.toContain('buyer@example.com');
    expect(json).not.toContain(token);
    expect(json).not.toContain(String(a.totalAmount));
  });

  it('옛 섞인 주문(디지털 포함)에서는 자기 직접 발송 줄만 싣는다', async () => {
    // 지금은 주문 생성이 실물·디지털 섞임을 거절한다(mixed_kind) — 그 전 모양의 주문을 손으로 만든다.
    const r = await place([{ skuId: B_PHY, quantity: 1 }]);
    await testDb.run(sql`
      INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity)
      VALUES ('legacy-dig', ${r.orderNo}, ${D_DIG}, 'a-digital', 'A 디지털', 5000, 1)
    `);
    const rows = await loadArtistShippingOrders('cB');
    expect(rows).toHaveLength(1);
    expect(rows[0].items.map((i) => i.label)).toEqual(['B 굿즈']);
    // 디지털 상품의 주인(A)에게는 이 실물 주문이 보이지 않는다(A가 보내는 줄이 아니다).
    expect(await loadArtistShippingOrders('cA')).toEqual([]);
  });

  it('결제 전·환불·디지털만 주문은 목록에 없다', async () => {
    const pending = await createShopOrder(shopPayload([{ skuId: A_PHY, quantity: 1 }]), new Date(), { salesOpen: true });
    expect(pending.ok).toBe(true);
    const refunded = await place([{ skuId: A_PHY, quantity: 1 }]);
    await testDb.run(sql`UPDATE orders SET status = 'refunded' WHERE order_no = ${refunded.orderNo}`);
    await place([{ skuId: D_DIG, quantity: 1 }], false);
    expect(await loadArtistShippingOrders('cA')).toEqual([]);
  });

  it('일부 환불 주문은 partialRefund로 표시되고 아티스트는 발송 처리할 수 없다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    await testDb.run(sql`UPDATE orders SET status = 'partially_refunded' WHERE order_no = ${r.orderNo}`);
    expect((await loadArtistShippingOrders('cA'))[0].partialRefund).toBe(true);
    const out = await markShopOrderShipped({ orderNo: r.orderNo, courier: 'CJ대한통운', trackingNumber: '123', actor: { kind: 'artist', creatorId: 'cA' } });
    expect(out).toMatchObject({ ok: false });
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder!.fulfillmentStatus).toBe('preparing');
  });

  it('관리자 주문 목록이 아티스트 발송 주문에 아티스트 이름을 붙인다', async () => {
    const a = await place([{ skuId: A_PHY, quantity: 1 }]);
    const s = await place([{ skuId: S_PHY, quantity: 1 }]);
    const byNo = new Map((await listAdminShopOrders()).map((o) => [o.orderNo, o.artistShipper]));
    expect(byNo.get(a.orderNo)).toBe('아티스트A');
    expect(byNo.get(s.orderNo)).toBeNull();
  });

  it('countArtistShipments — 직접 발송 상품이 있는 아티스트에게만 건수를 준다', async () => {
    await place([{ skuId: A_PHY, quantity: 1 }]);
    await place([{ skuId: A_PHY, quantity: 1 }]);
    expect(await countArtistShipments('cA')).toEqual({ hasProducts: true, pending: 2 });
    expect(await countArtistShipments('cB')).toEqual({ hasProducts: true, pending: 0 });
    expect(await countArtistShipments('cNobody')).toEqual({ hasProducts: false, pending: 0 });
  });
});

describe('받는 분 정보 가림', () => {
  it('판정 — 배송 완료 30일 뒤, 완료 표시가 없으면 발송 60일 뒤', () => {
    const now = 10_000 * DAY;
    expect(isArtistShippingMasked({ deliveredAt: null, shippedAt: null }, now)).toBe(false);
    expect(isArtistShippingMasked({ deliveredAt: now - (ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS * DAY - 1), shippedAt: 1 }, now)).toBe(false);
    expect(isArtistShippingMasked({ deliveredAt: now - ARTIST_SHIPPING_MASK_AFTER_DELIVERED_DAYS * DAY, shippedAt: 1 }, now)).toBe(true);
    expect(isArtistShippingMasked({ deliveredAt: null, shippedAt: now - (ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS * DAY - 1) }, now)).toBe(false);
    expect(isArtistShippingMasked({ deliveredAt: null, shippedAt: now - ARTIST_SHIPPING_MASK_AFTER_SHIPPED_DAYS * DAY }, now)).toBe(true);
  });

  it('가려진 행은 이름·연락처·주소·메모를 서버에서 비워 싣는다(주문번호·상품·운송장은 남는다)', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    const nowSec = Math.floor(Date.now() / 1000);
    await testDb.run(sql`
      UPDATE shop_orders SET fulfillment_status = 'delivered', courier = 'CJ대한통운', tracking_number = '777', shipping_memo = '문 앞에',
        shipped_at = ${nowSec - 40 * DAY}, delivered_at = ${nowSec - 31 * DAY} WHERE order_no = ${r.orderNo}`);
    const [row] = await loadArtistShippingOrders('cA');
    expect(row).toMatchObject({ orderNo: r.orderNo, masked: true, recipientName: '', recipientPhone: '', postcode: '', address1: '', address2: '', shippingMemo: '', trackingNumber: '777' });
    expect(JSON.stringify(row)).not.toMatch(/김구매|010-1234|서울 종로구|문 앞에/);
  });

  it('배송 완료 29일째까지는 보인다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    const nowSec = Math.floor(Date.now() / 1000);
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'delivered', shipped_at = ${nowSec - 35 * DAY}, delivered_at = ${nowSec - 29 * DAY} WHERE order_no = ${r.orderNo}`);
    expect((await loadArtistShippingOrders('cA'))[0]).toMatchObject({ masked: false, recipientName: '김구매' });
  });
});

describe('발송 처리 — 소유 판정', () => {
  it('자기 주문은 발송 처리되고 고객에게 발송 메일이 간다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    const out = await markShopOrderShipped({ orderNo: r.orderNo, courier: 'CJ대한통운', trackingNumber: '123456', actor: { kind: 'artist', creatorId: 'cA' } });
    expect(out).toEqual({ ok: true });
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder).toMatchObject({ fulfillmentStatus: 'shipped', courier: 'CJ대한통운', trackingNumber: '123456' });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'buyer@example.com' }));
    expect(await markShopOrderDelivered(r.orderNo, { kind: 'artist', creatorId: 'cA' })).toEqual({ ok: true });
  });

  it('남의 주문·스튜디오 주문은 거부 — 존재를 알리지 않는 같은 문구, 상태는 그대로', async () => {
    const mine = await place([{ skuId: A_PHY, quantity: 1 }]);
    const studio = await place([{ skuId: S_PHY, quantity: 1 }]);
    const file = await place([{ skuId: 'test-cd-std', quantity: 1 }]);
    const input = { courier: 'CJ대한통운', trackingNumber: '123' };
    const asB = { kind: 'artist' as const, creatorId: 'cB' };
    const denied = { ok: false, message: '주문을 찾을 수 없어요.' };
    expect(await markShopOrderShipped({ orderNo: mine.orderNo, ...input, actor: asB })).toEqual(denied);
    expect(await markShopOrderShipped({ orderNo: studio.orderNo, ...input, actor: { kind: 'artist', creatorId: 'cA' } })).toEqual(denied);
    expect(await markShopOrderShipped({ orderNo: file.orderNo, ...input, actor: { kind: 'artist', creatorId: 'cA' } })).toEqual(denied);
    expect(await markShopOrderShipped({ orderNo: 'SHP-20261014-DEADBEEF', ...input, actor: asB })).toEqual(denied);
    for (const o of [mine, studio, file]) expect((await findShopOrderByOrderNo(o.orderNo))!.shopOrder!.fulfillmentStatus).toBe('preparing');
    expect(sendEmail).not.toHaveBeenCalled();
    // 배송 완료 표시도 같다.
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped' WHERE order_no = ${mine.orderNo}`);
    expect(await markShopOrderDelivered(mine.orderNo, asB)).toEqual(denied);
    expect((await findShopOrderByOrderNo(mine.orderNo))!.shopOrder!.fulfillmentStatus).toBe('shipped');
  });

  it('관리자는 아티스트 발송 주문도 대신 처리할 수 있다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    expect(await markShopOrderShipped({ orderNo: r.orderNo, courier: '로젠택배', trackingNumber: '9' })).toEqual({ ok: true });
  });

  it('resolveOrderShipper — 실물 줄이 전부 한 아티스트의 직접 발송일 때만 artist', async () => {
    const a = await place([{ skuId: A_PHY, quantity: 1 }, { skuId: A_PHY2, quantity: 1 }]);
    expect(await resolveOrderShipper(a.orderNo)).toMatchObject({ kind: 'artist', creatorId: 'cA', creatorName: '아티스트A', artistSlug: 'artist-a' });
    const s = await place([{ skuId: S_PHY, quantity: 1 }]);
    expect(await resolveOrderShipper(s.orderNo)).toEqual({ kind: 'studio' });
    // 옛 섞인 주문(지금은 mixed_kind로 막힌다) — 디지털 줄은 발송 주체 판정에서 빠진다.
    const withDigital = await place([{ skuId: B_PHY, quantity: 1 }]);
    await testDb.run(sql`
      INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity)
      VALUES ('legacy-dig-2', ${withDigital.orderNo}, ${D_DIG}, 'a-digital', 'A 디지털', 5000, 1)
    `);
    expect(await resolveOrderShipper(withDigital.orderNo)).toMatchObject({ kind: 'artist', creatorId: 'cB' });
  });
});

describe('발송할 주문 메일', () => {
  it('아티스트 직접 발송 주문이 접수되면 아티스트에게 메일이 가고 주소·연락처는 싣지 않는다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    await sendShopOrderConfirmedEmails(r.orderNo);
    const calls = (sendEmail as jest.Mock).mock.calls.map((c) => c[0] as { to: string; subject: string; html: string; text: string });
    const toArtist = calls.filter((c) => c.to === 'a@example.com');
    expect(toArtist).toHaveLength(1);
    expect(toArtist[0].subject).toContain('발송할 주문');
    const body = `${toArtist[0].html}\n${toArtist[0].text}`;
    expect(body).toContain('/ko/funding/creator/shop/shipping');
    expect(body).toContain(r.orderNo);
    expect(body).not.toMatch(/서울 종로구|010-1234-5678|김구매|03000/);
    // 고객·운영자 메일은 그대로.
    expect(calls.some((c) => c.to === 'buyer@example.com')).toBe(true);
  });

  it('스튜디오 발송 주문이면 아티스트에게 메일이 가지 않는다', async () => {
    const r = await place([{ skuId: S_PHY, quantity: 1 }]);
    await sendShopOrderConfirmedEmails(r.orderNo);
    expect((sendEmail as jest.Mock).mock.calls.some((c) => c[0].to === 'a@example.com')).toBe(false);
  });

  it('아티스트 메일이 실패하면 notification_error에 남는다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    (sendEmail as jest.Mock).mockImplementation(async ({ to }: { to: string }) => (to === 'a@example.com' ? { ok: false, errorCode: 'bounced' } : { ok: true }));
    await sendShopOrderConfirmedEmails(r.orderNo);
    const order = await findShopOrderByOrderNo(r.orderNo);
    expect(order!.notificationError).toContain('아티스트 메일 실패');
    (sendEmail as jest.Mock).mockResolvedValue({ ok: true });
  });
});

describe('발송 주체 정하기 — 승인 전에만', () => {
  beforeEach(async () => {
    await testDb.insert(shopProducts).values({ id: 'pNew', creatorId: 'cA', slug: 'draft-x', category: 'goods', title: '새 상품', description: '소개', images: '[]', reviewStatus: 'draft' });
  });

  it('승인 전에는 정하고 바꿀 수 있다', async () => {
    expect(await loadProductFulfillmentMode('pNew')).toEqual({ mode: 'studio', tableMissing: false });
    expect(await setProductFulfillmentMode('pNew', 'artist')).toEqual({ ok: true });
    expect((await loadProductFulfillmentMode('pNew')).mode).toBe('artist');
    expect(await setProductFulfillmentMode('pNew', 'studio')).toEqual({ ok: true });
    expect((await loadProductFulfillmentMode('pNew')).mode).toBe('studio');
  });

  it('승인된 상품은 어느 쪽으로도 바꿀 수 없다', async () => {
    expect(await setProductFulfillmentMode('pA', 'studio')).toMatchObject({ ok: false, code: 'conflict' });
    expect(await setProductFulfillmentMode('pS', 'artist')).toMatchObject({ ok: false, code: 'conflict' });
    expect((await loadProductFulfillmentMode('pA')).mode).toBe('artist');
    expect((await loadProductFulfillmentMode('pS')).mode).toBe('studio');
  });

  it('읽은 뒤 승인이 끼어들면 쓰기 문장이 0행이다(경합)', async () => {
    // 사전 검사를 지나친 뒤 승인되는 상황을 흉내 낸다 — 쓰기 문장 자체의 WHERE가 승인 상품을 거른다.
    await testDb.update(shopProducts).set({ reviewStatus: 'approved' }).where(eq(shopProducts.id, 'pNew'));
    const result = await testDb.run(sql`
      INSERT INTO shop_product_fulfillment (product_id, mode)
      SELECT 'pNew', 'artist' WHERE EXISTS (SELECT 1 FROM shop_products WHERE id = 'pNew' AND review_status <> 'approved')
      ON CONFLICT(product_id) DO UPDATE SET mode = excluded.mode`);
    expect(result.rowsAffected).toBe(0);
    expect((await loadProductFulfillmentMode('pNew')).mode).toBe('studio');
  });

  it('디지털 상품·스튜디오 상품·등재 안 된 계정은 아티스트 발송으로 못 정한다', async () => {
    await testDb.insert(shopProducts).values({ id: 'pDig', creatorId: 'cA', slug: 'draft-d', category: 'album', kind: 'digital', title: '디지털', description: '소개', images: '[]', reviewStatus: 'draft' });
    expect(await setProductFulfillmentMode('pDig', 'artist')).toMatchObject({ ok: false, code: 'invalid' });
    await testDb.insert(fundingCreators).values({ id: 'cX', email: 'x@example.com', name: '미등재' });
    await testDb.insert(shopProducts).values({ id: 'pX', creatorId: 'cX', slug: 'draft-xx', category: 'goods', title: 'X', description: '소개', images: '[]', reviewStatus: 'draft' });
    expect(await setProductFulfillmentMode('pX', 'artist')).toMatchObject({ ok: false, code: 'invalid' });
    await testDb.insert(fundingCreators).values({ id: 'cS', email: 'studio@example.com', name: '스튜디오 놀' });
    await testDb.insert(shopArtists).values({ creatorId: 'cS', slug: 'studio-nol' });
    await testDb.insert(shopProducts).values({ id: 'pStudio', creatorId: 'cS', slug: 'draft-st', category: 'goods', title: 'S', description: '소개', images: '[]', reviewStatus: 'draft' });
    expect(await setProductFulfillmentMode('pStudio', 'artist')).toMatchObject({ ok: false, code: 'invalid' });
    expect(await setProductFulfillmentMode('nope', 'artist')).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('관리자 액션 set_fulfillment_mode가 같은 규칙을 지난다', async () => {
    expect(await applyShopAdminAction('pNew', { type: 'set_fulfillment_mode', mode: 'artist' })).toMatchObject({ ok: true });
    expect(await applyShopAdminAction('pA', { type: 'set_fulfillment_mode', mode: 'studio' })).toMatchObject({ ok: false, code: 'conflict' });
  });
});

describe('정산 — 아티스트 직접 발송 주문의 배송비', () => {
  const ship = async (orderNo: string) => {
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'shipped', shipped_at = ${Date.UTC(2026, 9, 15) / 1000} WHERE order_no = ${orderNo}`);
  };

  it('주문당 한 번 배송비 전액을 아티스트 몫에 더한다(상품 55% + 배송비 100%)', async () => {
    const o1 = await place([{ skuId: A_PHY, quantity: 1 }]);
    const o2 = await place([{ skuId: A_PHY, quantity: 1 }, { skuId: A_PHY2, quantity: 1 }]); // 한 주문에 두 상품 — 배송비는 한 번
    await ship(o1.orderNo);
    await ship(o2.orderNo);
    const rows = await listShopArtistSales('2026-10');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ artistSlug: 'creator:cA', quantity: 3, salesAmount: 20000 + 20000 + 10000, shippingAmount: SHOP_SHIPPING_FEE * 2, shippingOrderCount: 2 });
    // 사업자(invoice): 상품 55% + 배송비 전액.
    expect(rows[0].payout).toMatchObject({ shippingAmount: SHOP_SHIPPING_FEE * 2, shareAmount: Math.round(50000 * 0.55) + SHOP_SHIPPING_FEE * 2 });
  });

  it('스튜디오가 보낸 주문의 배송비는 아티스트 몫이 아니다', async () => {
    const o = await place([{ skuId: S_PHY, quantity: 1 }]);
    await ship(o.orderNo);
    const [row] = await listShopArtistSales('2026-10');
    expect(row).toMatchObject({ artistSlug: 'creator:cA', salesAmount: 15000, shippingAmount: 0, shippingOrderCount: 0 });
    expect(row.payout?.shareAmount).toBe(Math.round(15000 * 0.55));
  });

  it('무료 배송 주문은 배송비 줄이 0이다', async () => {
    await testDb.update(shopSkus).set({ stock: 500 });
    const o = await place([{ skuId: B_PHY, quantity: 7 }]); // 210,000원 — 무료 배송 기준 이상
    await ship(o.orderNo);
    const [row] = await listShopArtistSales('2026-10');
    expect(row).toMatchObject({ artistSlug: 'creator:cB', shippingAmount: 0, shippingOrderCount: 0 });
  });

  it('아직 발송 전이거나 다른 달이면 센 건이 없다', async () => {
    await place([{ skuId: A_PHY, quantity: 1 }]);
    expect(await listShopArtistSales('2026-10')).toEqual([]);
  });
});

describe('아티스트 재고 입력', () => {
  it('자기가 직접 보내는 상품의 잠긴 옵션만 정한다', async () => {
    expect(await setOwnSkuStock('cA', A_PHY, 7)).toEqual({ ok: true });
    expect((await testDb.select().from(shopSkus).where(eq(shopSkus.id, A_PHY)))[0].stock).toBe(7);
  });

  it('남의 상품·스튜디오가 보내는 상품·잠기지 않은 옵션은 거절한다', async () => {
    const no = { ok: false, message: '재고를 직접 정할 수 있는 상품이 아니에요.' };
    expect(await setOwnSkuStock('cB', A_PHY, 7)).toEqual(no);
    expect(await setOwnSkuStock('cA', S_PHY, 7)).toEqual(no);
    expect(await setOwnSkuStock('cA', 'test-cd-std', 7)).toEqual(no);
    await testDb.update(shopProductSkus).set({ lockedAt: null }).where(eq(shopProductSkus.id, A_PHY2));
    expect(await setOwnSkuStock('cA', A_PHY2, 7)).toEqual(no);
    expect((await testDb.select().from(shopSkus).where(eq(shopSkus.id, S_PHY)))[0].stock).toBe(50);
  });

  it('한정 수량 상한은 관리자와 같다', async () => {
    await testDb.update(shopProducts).set({ editionSize: 10 }).where(eq(shopProducts.id, 'pA'));
    await testDb.insert(shopProductSkus).values({ id: 'db-aaaaaaaac3', productId: 'pA', optionLabel: '다른 옵션', price: 20000, lockedAt: 1 });
    expect(await setOwnSkuStock('cA', A_PHY, 6)).toEqual({ ok: true });
    expect(await setOwnSkuStock('cA', 'db-aaaaaaaac3', 5)).toMatchObject({ ok: false });
  });
});

describe('발송 주체 표가 없는 DB (마이그레이션 0057 전) — 기존 주문 경로는 전부 스튜디오 발송', () => {
  beforeEach(async () => {
    await testDb.run(sql`DROP TABLE shop_product_fulfillment`);
  });

  it('주문 생성은 그대로 되고 섞임 판정은 없다(전부 studio)', async () => {
    expect((await createShopOrder(shopPayload([{ skuId: A_PHY, quantity: 1 }, { skuId: B_PHY, quantity: 1 }, { skuId: 'test-cd-std', quantity: 1 }]), new Date(), { salesOpen: true })).ok).toBe(true);
    const found = await findSellableSkuAsync(A_PHY);
    expect('found' in found && found.found?.product.shippedByArtist).toBeUndefined();
  });

  it('발송 처리·메일·관리자 주문 목록·정산·콘솔 목록이 모두 정상이다', async () => {
    const r = await place([{ skuId: A_PHY, quantity: 1 }]);
    expect(await resolveOrderShipper(r.orderNo)).toEqual({ kind: 'studio' });
    await sendShopOrderConfirmedEmails(r.orderNo);
    expect((sendEmail as jest.Mock).mock.calls.some((c) => c[0].to === 'a@example.com')).toBe(false);
    expect(await markShopOrderShipped({ orderNo: r.orderNo, courier: '로젠택배', trackingNumber: '1' })).toEqual({ ok: true });
    expect((await listAdminShopOrders()).map((o) => [o.orderNo, o.artistShipper])).toEqual([[r.orderNo, null]]);
    await testDb.run(sql`UPDATE shop_orders SET shipped_at = ${Date.UTC(2026, 9, 15) / 1000} WHERE order_no = ${r.orderNo}`);
    const [row] = await listShopArtistSales('2026-10');
    expect(row).toMatchObject({ salesAmount: 20000, shippingAmount: 0 });
    expect(await loadArtistShippingOrders('cA')).toEqual([]);
    expect(await countArtistShipments('cA')).toBeNull();
    // 아티스트 경로는 열리지 않는다.
    expect(await markShopOrderShipped({ orderNo: r.orderNo, courier: 'x', trackingNumber: '1', actor: { kind: 'artist', creatorId: 'cA' } })).toMatchObject({ ok: false });
  });

  it('발송 주체를 정하려 하면 마이그레이션 안내와 함께 거절한다', async () => {
    await testDb.insert(shopProducts).values({ id: 'pNew', creatorId: 'cA', slug: 'draft-x', category: 'goods', title: '새 상품', description: '소개', images: '[]', reviewStatus: 'draft' });
    expect(await loadProductFulfillmentMode('pNew')).toEqual({ mode: 'studio', tableMissing: true });
    expect(await setProductFulfillmentMode('pNew', 'artist')).toMatchObject({ ok: false, code: 'storage_unavailable' });
  });
});

describe('표가 있지만 읽기에 실패하면 주문 생성은 조회 실패로 닫는다', () => {
  it('섞임을 못 거르는 채 통과시키지 않는다(lookup_failed)', async () => {
    await testDb.run(sql`DROP TABLE shop_artists`);
    const r = await createShopOrder(shopPayload([{ skuId: A_PHY, quantity: 1 }]), new Date(), { salesOpen: true });
    expect(r).toEqual({ ok: false, code: 'lookup_failed' });
  });
});
