/** @jest-environment node */
/**
 * 아티스트 상점 플랫폼 점검(2026-10-14)에서 나온 결함의 재현 테스트 — 결함마다 describe 하나.
 * 각 테스트는 고치기 전 코드에서 실패하는 모양으로 썼다.
 */
import { eq, sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { agreeShopArtistTermsForTest, shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopArtists, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../../data/shop/policy', () => ({ ...jest.requireActual('../../data/shop/policy'), SHOP_SALES_OPEN: true }));
jest.mock('../funding/r2', () => ({
  fundingDownloadObjectExists: jest.fn(async () => true),
  presignFundingDownload: jest.fn(async () => 'https://r2.example/signed'),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  confirmPayment: jest.fn(),
  fetchPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../funding/creatorAuth', () => ({ authenticateCreatorApi: jest.fn(async () => ({ ok: true, creatorId: 'c1' })) }));
jest.mock('../contact/origin', () => ({ isAllowedContactRequestOrigin: () => true }));
jest.mock('./revalidate', () => ({ revalidateShopArtistPages: jest.fn(async () => null) }));

/* eslint-disable import/first */
import { approveShopProductNow, saveProductAsAdmin } from './adminProductWrite';
import { countShopAwaitingShipment, listAdminShopOrders, listShopArtistSales, setSkuStock } from './adminQueries';
import { countArtistShipments, loadArtistShippingOrders } from './artistShipping';
import { cancelShopOrder } from './cancel';
import { confirmShopOrder } from './confirm';
import { loadCreatorSales } from './creatorStats';
import { saveProduct } from './creatorProductWrite';
import { setOwnSkuStock } from './creatorStock';
import { recordFirstDownload } from './downloads';
import { sendShopOrderConfirmedEmails } from './email';
import { markShopOrderShipped } from './fulfillment';
import { loadProductFulfillmentMode } from './fulfillmentMode';
import { SHOP_DIGITAL_RULES, SHOP_TERMS_SECTIONS } from './policyCopy';
import { applyShopAdminAction, decideShopProduct } from './reviewDecision';
import { revalidateShopArtistPages } from './revalidate';
import { createShopOrder, getRemainingStock } from './service';
import { SHOP_MIXED_KIND_MESSAGE } from './shipper';
import ordersHandler from '../../pages/api/shop/orders';
import downloadHandler from '../../pages/api/shop/download';
import creatorProductHandler from '../../pages/api/funding/creator/shop/products/[id]';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { sendEmail } from '../email/resend';
/* eslint-enable import/first */

const IMG = '/api/funding/media/c1-11111111-1111-1111-1111-111111111111.webp?w=800&h=600';

const seedCreators = async () => {
  await testDb.insert(fundingCreators).values([
    { id: 'c1', email: 'c1@example.com', name: '아티스트일', taxType: 'invoice' },
    { id: 'c2', email: 'c2@example.com', name: '아티스트이', taxType: 'invoice' },
  ]);
  await testDb.insert(shopArtists).values([{ creatorId: 'c1', slug: 'artist-c1' }, { creatorId: 'c2', slug: 'artist-c2' }]);
  await agreeShopArtistTermsForTest(testDb, 'c1', 'c2');
};

type ProductOver = Partial<typeof shopProducts.$inferInsert>;
const product = async (id: string, over: ProductOver = {}) => {
  await testDb.insert(shopProducts).values({
    id, creatorId: 'c1', slug: id, category: 'goods', title: `상품 ${id}`, description: '첫 문단입니다.', images: JSON.stringify([IMG]),
    reviewStatus: 'approved', published: true, updatedAt: 1000, ...over,
  });
};
const sku = async (id: string, productId: string, over: Partial<typeof shopProductSkus.$inferInsert> = {}, stock: number | null = 50) => {
  await testDb.insert(shopProductSkus).values({ id, productId, price: 10000, lockedAt: 1, ...over });
  if (stock !== null) await testDb.insert(shopSkus).values({ id, productSlug: productId, stock });
};
const fulfillment = (productId: string, mode: 'studio' | 'artist') =>
  testDb.run(sql`INSERT INTO shop_product_fulfillment (product_id, mode) VALUES (${productId}, ${mode})`);

let seq = 0;
/** 주문 행을 직접 만든다(주문 생성 게이트가 지금은 막는 "옛 모양"의 주문을 재현할 때). */
const rawOrder = async (
  lines: Array<{ skuId: string; productId: string; quantity?: number; price?: number }>,
  over: { status?: string; postcode?: string; fulfillment?: string; shippingFee?: number; shippedAt?: number | null; customerName?: string } = {},
) => {
  seq += 1;
  const orderNo = `SHP-20261014-${seq.toString(16).toUpperCase().padStart(8, '0')}`;
  const total = lines.reduce((n, l) => n + (l.price ?? 10000) * (l.quantity ?? 1), 0) + (over.shippingFee ?? 0);
  await testDb.run(sql`
    INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token)
    VALUES (${`oid-${seq}`}, ${orderNo}, 'merch', ${over.status ?? 'paid'}, ${over.customerName ?? '김구매'}, '010-1234-5678', 'buyer@example.com', ${total}, 0, ${total}, ${`tok-${seq}`})
  `);
  const postcode = over.postcode ?? '03000';
  await testDb.run(sql`
    INSERT INTO shop_orders (order_no, recipient_name, recipient_phone, postcode, address1, subtotal_amount, shipping_fee, hold_expires_at, fulfillment_status, shipped_at)
    VALUES (${orderNo}, ${postcode ? '받는분' : ''}, ${postcode ? '010-9999-9999' : ''}, ${postcode}, ${postcode ? '서울 어딘가' : ''}, ${total}, ${over.shippingFee ?? 0}, 0,
            ${over.fulfillment ?? 'preparing'}, ${over.shippedAt ?? null})
  `);
  for (const l of lines) {
    await testDb.run(sql`
      INSERT INTO shop_order_items (id, order_no, sku_id, product_slug, product_title, unit_price, quantity)
      VALUES (lower(hex(randomblob(8))), ${orderNo}, ${l.skuId}, ${l.productId}, ${`상품 ${l.productId}`}, ${l.price ?? 10000}, ${l.quantity ?? 1})
    `);
  }
  return orderNo;
};

const done = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'DONE', totalAmount, method: '카드', approvedAt: new Date().toISOString() },
});
const cancelledToss = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

const mockRes = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status, revalidate: jest.fn(), redirect: jest.fn() };
  return { res: res as unknown as NextApiResponse, status, json, redirect: res.redirect };
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seedCreators();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

// ─── 1 ──────────────────────────────────────────────────────────────────────────
describe('1. 새 옵션 승인은 운영자가 화면에서 본 옵션만 잠근다', () => {
  const N1 = 'db-n100000001';
  const N2 = 'db-n200000002';
  beforeEach(async () => {
    await product('p1');
    await sku('db-l000000001', 'p1', { optionLabel: 'A' });
    await sku(N1, 'p1', { optionLabel: 'B', price: 12000, lockedAt: null }, null);
  });
  const lockedOf = async (id: string) => (await testDb.select().from(shopProductSkus).where(eq(shopProductSkus.id, id)))[0].lockedAt;

  it('본 목록과 지금이 같으면 그 옵션을 잠근다', async () => {
    const r = await applyShopAdminAction('p1', { type: 'lock_new_skus', skus: [{ id: N1, price: 12000, optionLabel: 'B' }] });
    expect(r).toMatchObject({ ok: true, locked: 1 });
    expect(await lockedOf(N1)).not.toBeNull();
  });

  it('여러 옵션도 한 번에 잠근다', async () => {
    await sku(N2, 'p1', { optionLabel: 'C', price: 13000, lockedAt: null }, null);
    const r = await applyShopAdminAction('p1', {
      type: 'lock_new_skus', skus: [{ id: N1, price: 12000, optionLabel: 'B' }, { id: N2, price: 13000, optionLabel: 'C' }],
    });
    expect(r).toMatchObject({ ok: true, locked: 2 });
  });

  it('그사이 아티스트가 옵션을 더했으면 아무것도 잠그지 않는다', async () => {
    await sku(N2, 'p1', { optionLabel: 'C', price: 13000, lockedAt: null }, null);
    const r = await applyShopAdminAction('p1', { type: 'lock_new_skus', skus: [{ id: N1, price: 12000, optionLabel: 'B' }] });
    expect(r).toMatchObject({ ok: false, code: 'conflict' });
    if (!r.ok) expect(r.message).toContain('그사이 옵션이 바뀌었어요');
    expect(await lockedOf(N1)).toBeNull();
    expect(await lockedOf(N2)).toBeNull();
  });

  it('그사이 가격·옵션명이 바뀌었으면 잠그지 않는다', async () => {
    expect(await applyShopAdminAction('p1', { type: 'lock_new_skus', skus: [{ id: N1, price: 11000, optionLabel: 'B' }] }))
      .toMatchObject({ ok: false, code: 'conflict' });
    expect(await applyShopAdminAction('p1', { type: 'lock_new_skus', skus: [{ id: N1, price: 12000, optionLabel: 'B2' }] }))
      .toMatchObject({ ok: false, code: 'conflict' });
    expect(await lockedOf(N1)).toBeNull();
  });
});

// ─── 2 ──────────────────────────────────────────────────────────────────────────
describe('2. 디지털 상품에는 아티스트 발송이 붙지 않는다', () => {
  const PHY = 'db-p000000001'; // c1의 상품, 스튜디오 발송 실물
  const DIG = 'db-d000000001'; // c1의 디지털 상품 — 옛 상태로 발송 주체 'artist' 행이 남아 있다
  beforeEach(async () => {
    await product('pPhy');
    await sku(PHY, 'pPhy');
    await fulfillment('pPhy', 'studio');
    await product('pDig', { kind: 'digital', digitalFiles: JSON.stringify([{ label: '음원', key: 'shop/c1/a.zip' }, { label: '미리', key: 'shop/c1/p.mp3', preview: true }]) });
    await sku(DIG, 'pDig');
    await fulfillment('pDig', 'artist');
  });

  it('아티스트 발송 목록·건수·관리자 목록이 그 주문을 아티스트 발송으로 보지 않는다', async () => {
    const no = await rawOrder([{ skuId: PHY, productId: 'pPhy' }, { skuId: DIG, productId: 'pDig' }]);
    expect(await loadArtistShippingOrders('c1')).toEqual([]);
    expect(await countArtistShipments('c1')).toEqual({ hasProducts: false, pending: 0 });
    const rows = await listAdminShopOrders();
    expect(rows.find((r) => r.orderNo === no)?.artistShipper).toBeNull();
  });

  it('정산에 그 주문의 배송비를 아티스트 몫으로 넣지 않는다', async () => {
    await rawOrder([{ skuId: PHY, productId: 'pPhy' }, { skuId: DIG, productId: 'pDig' }], {
      fulfillment: 'shipped', shippedAt: Math.floor(Date.UTC(2026, 9, 10) / 1000), shippingFee: 4000,
    });
    const [row] = await listShopArtistSales('2026-10');
    expect(row).toMatchObject({ artistName: '아티스트일', shippingAmount: 0, shippingOrderCount: 0 });
  });

  it('아티스트가 디지털 옵션의 재고를 넣지 못한다', async () => {
    expect((await loadCreatorSales('c1')).find((s) => s.skuId === DIG)?.canSetStock).toBe(false);
    expect(await setOwnSkuStock('c1', DIG, 5)).toMatchObject({ ok: false });
  });

  it('디지털 상품을 아티스트 발송으로 승인하지 않는다', async () => {
    await testDb.update(shopProducts).set({ reviewStatus: 'submitted', submittedAt: 5, published: false }).where(eq(shopProducts.id, 'pDig'));
    await testDb.update(shopProductSkus).set({ lockedAt: null }).where(eq(shopProductSkus.id, DIG));
    const r = await decideShopProduct('pDig', 'approve', { expectedSubmittedAt: 5 });
    expect(r.ok).toBe(false);
    expect((await testDb.select().from(shopProducts).where(eq(shopProducts.id, 'pDig')))[0].reviewStatus).toBe('submitted');
  });

  it('종류를 디지털로 바꿔 저장하면 아티스트 발송 행을 걷는다', async () => {
    await product('pDraft', { reviewStatus: 'draft', published: false });
    await sku('db-r000000001', 'pDraft', { lockedAt: null }, null);
    await fulfillment('pDraft', 'artist');
    const saved = await saveProduct('c1', 'pDraft', {
      title: '상품 pDraft', subtitle: null, description: '첫 문단입니다.', images: [IMG], category: 'goods', kind: 'digital',
      slug: 'p-draft', shipsOn: null, editionSize: null, skus: [{ id: 'db-r000000001', optionLabel: null, price: 10000, retired: false }],
    });
    expect(saved.ok).toBe(true);
    expect((await loadProductFulfillmentMode('pDraft')).mode).toBe('studio');
  });
});

// ─── 3 ──────────────────────────────────────────────────────────────────────────
describe('3. 승인된 상품의 소개·사진은 비울 수 없다', () => {
  const input = (over: Record<string, unknown> = {}) => ({
    title: '상품 p3', subtitle: null, description: '첫 문단입니다.', images: [IMG], category: 'goods' as const, kind: 'physical' as const,
    slug: 'p3', shipsOn: null, editionSize: null, skus: [{ id: 'db-a000000003', optionLabel: null, price: 10000, retired: false }], ...over,
  });
  beforeEach(async () => {
    await product('p3', { slug: 'p3' });
    await sku('db-a000000003', 'p3');
  });

  it('소개를 비우면 거부한다', async () => {
    expect(await saveProduct('c1', 'p3', input({ description: '' }))).toMatchObject({ ok: false, code: 'incomplete' });
    expect((await testDb.select().from(shopProducts).where(eq(shopProducts.id, 'p3')))[0].description).toBe('첫 문단입니다.');
  });

  it('사진을 모두 지우면 거부한다', async () => {
    expect(await saveProduct('c1', 'p3', input({ images: [] }))).toMatchObject({ ok: false, code: 'incomplete' });
  });

  it('작성 중에는 비운 채 임시 저장할 수 있다', async () => {
    await testDb.update(shopProducts).set({ reviewStatus: 'draft' }).where(eq(shopProducts.id, 'p3'));
    expect((await saveProduct('c1', 'p3', input({ description: '', images: [] }))).ok).toBe(true);
  });
});

// ─── 5 ──────────────────────────────────────────────────────────────────────────
describe('5. 실물과 디지털은 한 주문에 담지 않는다', () => {
  const PHY = 'db-p000000005';
  const DIG = 'db-d000000005';
  beforeEach(async () => {
    await product('pPhy5');
    await sku(PHY, 'pPhy5');
    await product('pDig5', { kind: 'digital', digitalFiles: JSON.stringify([{ label: '음원', key: 'shop/c1/b.zip' }]) });
    await sku(DIG, 'pDig5');
  });

  it('섞이면 mixed_kind로 거절하고 주문 행이 남지 않는다', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: PHY, quantity: 1 }, { skuId: DIG, quantity: 1 }]), new Date(), { salesOpen: true });
    expect(r).toEqual({ ok: false, code: 'mixed_kind' });
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
  });

  it('파일 상품(실물) + 디지털도 거절한다', async () => {
    const r = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }, { skuId: DIG, quantity: 1 }]), new Date(), { salesOpen: true });
    expect(r).toEqual({ ok: false, code: 'mixed_kind' });
  });

  it('API가 사람이 읽는 400 메시지로 답한다', async () => {
    const { res, status, json } = mockRes();
    const body = shopPayload([{ skuId: PHY, quantity: 1 }, { skuId: DIG, quantity: 1 }]);
    await ordersHandler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ ok: false, code: 'mixed_kind', message: SHOP_MIXED_KIND_MESSAGE });
  });

  it('화면 안내와 약관이 같은 약속을 한다', () => {
    expect(SHOP_DIGITAL_RULES.some((l) => l.includes('디지털 상품은 실물 상품과 따로 주문해요'))).toBe(true);
    const digital = SHOP_TERMS_SECTIONS.find((s) => s.heading === '디지털 상품');
    expect(digital?.lines).toContain('디지털 상품은 실물 상품과 별도의 주문으로 구매합니다.');
  });
});

// ─── 6 ──────────────────────────────────────────────────────────────────────────
describe('6. 다른 상품의 파일 키를 미리듣기·판매 파일로 넣지 못한다', () => {
  beforeEach(async () => {
    await product('pA6', { kind: 'digital', digitalFiles: JSON.stringify([{ label: '전곡', key: 'shop/a/full.zip' }, { label: '미리', key: 'shop/a/pre.mp3', preview: true }]) });
    await product('pB6', { kind: 'digital', reviewStatus: 'draft', published: false });
  });

  it('다른 상품의 판매 파일 키를 미리듣기로 넣으면 거부한다', async () => {
    const r = await applyShopAdminAction('pB6', {
      type: 'set_digital_files', files: [{ label: '내 전곡', key: 'shop/b/full.zip' }, { label: '미리', key: 'shop/a/full.zip', preview: true }],
    });
    expect(r).toMatchObject({ ok: false, code: 'invalid' });
    expect((await testDb.select().from(shopProducts).where(eq(shopProducts.id, 'pB6')))[0].digitalFiles).toBeNull();
  });

  it('다른 상품의 미리듣기 키도 거부한다', async () => {
    expect(await applyShopAdminAction('pB6', { type: 'set_digital_files', files: [{ label: '전곡', key: 'shop/a/pre.mp3' }] }))
      .toMatchObject({ ok: false, code: 'invalid' });
  });

  it('자기 상품의 키를 다시 저장하는 것은 된다', async () => {
    expect((await applyShopAdminAction('pA6', {
      type: 'set_digital_files', files: [{ label: '전곡', key: 'shop/a/full.zip' }, { label: '미리 1분', key: 'shop/a/pre.mp3', preview: true }],
    })).ok).toBe(true);
  });
});

// ─── 7 ──────────────────────────────────────────────────────────────────────────
describe('7. 일부 환불된 디지털 주문은 내려받지 못한다', () => {
  const DIG = 'db-d000000007';
  beforeEach(async () => {
    await product('pDig7', { kind: 'digital', digitalFiles: JSON.stringify([{ label: '음원', key: 'shop/c1/c.zip' }]) });
    await sku(DIG, 'pDig7');
  });

  it('기록 함수가 거절한다', async () => {
    const no = await rawOrder([{ skuId: DIG, productId: 'pDig7' }], { status: 'partially_refunded', postcode: '' });
    expect(await recordFirstDownload(no)).toBe(false);
  });

  it('내려받기 API가 409로 답하고 서명 주소로 보내지 않는다', async () => {
    const no = await rawOrder([{ skuId: DIG, productId: 'pDig7' }], { status: 'partially_refunded', postcode: '' });
    const { res, status, redirect } = mockRes();
    await downloadHandler({ method: 'POST', body: { orderNo: no, token: `tok-${seq}`, file: '0' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
    expect(status).toHaveBeenCalledWith(409);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('결제 완료 주문은 그대로 내려받는다', async () => {
    const no = await rawOrder([{ skuId: DIG, productId: 'pDig7' }], { postcode: '' });
    expect(await recordFirstDownload(no)).toBe(true);
  });
});

// ─── 8 ──────────────────────────────────────────────────────────────────────────
describe('8. 한정판은 번호 수를 넘겨 팔지 않는다', () => {
  const LTD = 'db-e000000008';
  const LTD2 = 'db-e000000009';
  beforeEach(async () => {
    await product('pLtd', { editionSize: 2 });
    await sku(LTD, 'pLtd', { optionLabel: 'A' }, 5);
    await sku(LTD2, 'pLtd', { optionLabel: 'B' }, 5);
  });

  const confirm = async (r: { orderNo: string; totalAmount: number }) => {
    (confirmPayment as jest.Mock).mockResolvedValueOnce(done(r.orderNo, r.totalAmount));
    return confirmShopOrder({ orderNo: r.orderNo, paymentKey: `pk-${r.orderNo}`, amount: r.totalAmount });
  };
  const create = async (lines: Array<{ skuId: string; quantity: number }>, now = new Date()) =>
    createShopOrder(shopPayload(lines), now, { salesOpen: true });

  it('발송 뒤 반품 환불로 재고가 돌아와도 번호가 없으면 팔지 않는다(화면·생성 게이트)', async () => {
    const a = await create([{ skuId: LTD, quantity: 2 }]);
    if (!a.ok) throw new Error('setup');
    expect(await confirm(a)).toMatchObject({ ok: true });
    await markShopOrderShipped({ orderNo: a.orderNo, courier: '로젠택배', trackingNumber: '1' });
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelledToss(a.orderNo, a.totalAmount));
    expect(await cancelShopOrder({ orderNo: a.orderNo, requestedBy: 'admin', reason: '반품', now: new Date() })).toMatchObject({ ok: true });

    expect(await getRemainingStock([LTD, LTD2], new Date())).toEqual({ [LTD]: 0, [LTD2]: 0 });
    expect(await create([{ skuId: LTD2, quantity: 1 }])).toEqual({ ok: false, code: 'sold_out' });
  });

  it('한 주문이 같은 상품의 옵션 둘을 담아 남은 번호를 넘기면 거절한다', async () => {
    expect(await create([{ skuId: LTD, quantity: 2 }, { skuId: LTD2, quantity: 1 }])).toEqual({ ok: false, code: 'sold_out' });
    expect((await create([{ skuId: LTD, quantity: 1 }, { skuId: LTD2, quantity: 1 }])).ok).toBe(true);
  });

  it('결제창을 열어 둔(점유 중) 주문의 수량도 남은 번호에서 뺀다', async () => {
    expect((await create([{ skuId: LTD, quantity: 2 }])).ok).toBe(true);
    expect(await getRemainingStock([LTD2], new Date())).toEqual({ [LTD2]: 0 });
    expect(await create([{ skuId: LTD2, quantity: 1 }])).toEqual({ ok: false, code: 'sold_out' });
  });

  it('확정 게이트 — 홀드가 지난 뒤 결제한 주문은 번호가 없으면 자동 전액 취소한다', async () => {
    const a = await create([{ skuId: LTD, quantity: 1 }]);
    if (!a.ok) throw new Error('setup');
    expect(await confirm(a)).toMatchObject({ ok: true });
    // B는 20분 전에 결제창을 열었다(홀드 만료) — 그 사이 C가 마지막 번호를 가져갔다.
    const b = await create([{ skuId: LTD, quantity: 1 }], new Date(Date.now() - 20 * 60 * 1000));
    if (!b.ok) throw new Error('setup b');
    const c = await create([{ skuId: LTD2, quantity: 1 }]);
    if (!c.ok) throw new Error('setup c');
    expect(await confirm(c)).toMatchObject({ ok: true });

    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelledToss(b.orderNo, b.totalAmount));
    expect(await confirm(b)).toMatchObject({ ok: false, code: 'sold_out' });
    expect(cancelPayment).toHaveBeenCalledTimes(1);
    const [row] = await testDb.all<{ status: string }>(sql`SELECT status FROM orders WHERE order_no = ${b.orderNo}`);
    expect(row.status).toBe('refunded');
    const serials = await testDb.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM shop_serials WHERE order_no = ${b.orderNo}`);
    expect(Number(serials[0].n)).toBe(0);
  });
});

// ─── 9 ──────────────────────────────────────────────────────────────────────────
describe('9. 한정판 재고 상한은 쓰는 문장 하나가 판정한다', () => {
  const A = 'db-e100000001';
  const B = 'db-e100000002';
  beforeEach(async () => {
    await product('pCap', { editionSize: 10 });
    await sku(A, 'pCap', { optionLabel: 'A' }, null);
    await sku(B, 'pCap', { optionLabel: 'B' }, null);
  });

  it('다른 옵션 합을 읽은 뒤 그 값이 바뀌어도 상한을 넘기지 않는다', async () => {
    // 동시 쓰기를 흉내 낸다 — setSkuStock이 무엇이든 처음 읽는 순간 다른 옵션에 8을 넣는다.
    const realAll = testDb.all.bind(testDb);
    let injected = false;
    const spy = jest.spyOn(testDb, 'all').mockImplementation((async (q: never) => {
      const out = await realAll(q);
      if (!injected) {
        injected = true;
        await testDb.run(sql`INSERT INTO shop_skus (id, product_slug, stock) VALUES (${B}, 'pCap', 8)`);
      }
      return out;
    }) as never);
    const r = await setSkuStock(A, 5);
    spy.mockRestore();
    // 읽기 없이 한 문장으로 판정했다면 끼어들 틈이 없다 — 그때는 "다른 운영자"의 쓰기가 같은 판정을 지나다 거절돼야 한다.
    if (injected) expect(r.ok).toBe(false);
    else expect((await setSkuStock(B, 8)).ok).toBe(false);
    const [sum] = await testDb.all<{ n: number }>(sql`SELECT COALESCE(SUM(stock), 0) AS n FROM shop_skus WHERE id IN (${A}, ${B})`);
    expect(Number(sum.n)).toBeLessThanOrEqual(10);
  });

  it('상한 안에서는 넣고 고칠 수 있다', async () => {
    expect(await setSkuStock(A, 6)).toEqual({ ok: true });
    expect(await setSkuStock(B, 4)).toEqual({ ok: true });
    expect(await setSkuStock(A, 7)).toMatchObject({ ok: false });
    expect(await setSkuStock(A, 5)).toEqual({ ok: true });
  });
});

// ─── 10 ─────────────────────────────────────────────────────────────────────────
describe('10. 콘솔의 공개 토글·승인 뒤 저장도 아티스트 페이지를 재검증한다', () => {
  beforeEach(async () => {
    await product('p10', { slug: 'p10' });
    await sku('db-a000000010', 'p10');
  });
  const call = async (method: 'POST' | 'PUT', body: unknown) => {
    const { res, status } = mockRes();
    await creatorProductHandler({ method, body, query: { id: 'p10' }, headers: {}, socket: {} } as unknown as NextApiRequest, res);
    return { res, status };
  };

  it.each(['unpublish', 'publish'])('%s 뒤에 재검증한다', async (action) => {
    const { res, status } = await call('POST', { action });
    expect(status).toHaveBeenCalledWith(200);
    expect(revalidateShopArtistPages).toHaveBeenCalledWith(res, 'c1');
  });

  it('승인 상태 저장 뒤에 재검증한다', async () => {
    const { res, status } = await call('PUT', {
      value: { title: '상품 p10', subtitle: '부제', description: '첫 문단입니다.', images: [IMG], category: 'goods', kind: 'physical', slug: 'p10', shipsOn: null, editionSize: null, skus: [{ id: 'db-a000000010', optionLabel: null, price: 10000, retired: false }] },
    });
    expect(status).toHaveBeenCalledWith(200);
    expect(revalidateShopArtistPages).toHaveBeenCalledWith(res, 'c1');
  });
});

// ─── 11 ─────────────────────────────────────────────────────────────────────────
describe('11. 상점 메일 본문의 이름을 escape한다', () => {
  it('아티스트 이름·주문자 이름이 HTML로 해석되지 않는다', async () => {
    await testDb.update(fundingCreators).set({ name: '<img src=x onerror=alert(1)>' }).where(eq(fundingCreators.id, 'c1'));
    await product('p11');
    await sku('db-a000000011', 'p11');
    await fulfillment('p11', 'artist');
    const no = await rawOrder([{ skuId: 'db-a000000011', productId: 'p11' }], { customerName: '<b>김</b>' });
    await sendShopOrderConfirmedEmails(no);
    const calls = (sendEmail as jest.Mock).mock.calls.map((c) => c[0] as { to: string; html: string });
    const artist = calls.find((c) => c.to === 'c1@example.com');
    expect(artist).toBeDefined();
    expect(artist!.html).not.toContain('<img src=x');
    expect(artist!.html).toContain('&lt;img src=x');
    const customer = calls.find((c) => c.to === 'buyer@example.com');
    expect(customer!.html).not.toContain('<b>김</b>');
  });
});

// ─── 12 ─────────────────────────────────────────────────────────────────────────
describe('12. 관리자 저장·바로 승인은 화면을 연 판본일 때만', () => {
  const value = (over: Record<string, unknown> = {}) => ({
    title: '상품 p12', subtitle: '', description: '첫 문단입니다.', images: [IMG], category: 'goods', kind: 'physical',
    slug: 'p12', shipsOn: null, editionSize: null, skus: [{ id: 'db-a000000012', optionLabel: '', price: 10000, retired: false }], ...over,
  });
  beforeEach(async () => {
    await product('p12', { slug: 'p12', reviewStatus: 'draft', published: false, updatedAt: 1000 });
    await sku('db-a000000012', 'p12', { lockedAt: null }, null);
  });

  it('그사이 아티스트가 고쳤으면 관리자 저장을 거부한다', async () => {
    await testDb.update(shopProducts).set({ description: '아티스트가 고친 소개', updatedAt: 2000 }).where(eq(shopProducts.id, 'p12'));
    const r = await saveProductAsAdmin('p12', value(), new Date(), { expectedUpdatedAt: 1000 });
    expect(r).toMatchObject({ ok: false, code: 'conflict' });
    expect((await testDb.select().from(shopProducts).where(eq(shopProducts.id, 'p12')))[0].description).toBe('아티스트가 고친 소개');
  });

  it('같은 판본이면 저장한다', async () => {
    expect((await saveProductAsAdmin('p12', value({ subtitle: '새 부제' }), new Date(), { expectedUpdatedAt: 1000 })).ok).toBe(true);
  });

  it('그사이 고쳐진 상품은 바로 승인하지 않는다', async () => {
    await testDb.update(shopProducts).set({ updatedAt: 2000 }).where(eq(shopProducts.id, 'p12'));
    expect(await approveShopProductNow('p12', { expectedUpdatedAt: 1000 })).toMatchObject({ ok: false, code: 'conflict' });
    const [row] = await testDb.select().from(shopProducts).where(eq(shopProducts.id, 'p12'));
    expect(row.reviewStatus).toBe('draft');
  });

  it('같은 판본이면 바로 승인한다', async () => {
    expect(await approveShopProductNow('p12', { expectedUpdatedAt: 1000 })).toMatchObject({ ok: true });
  });
});

// ─── 13 ─────────────────────────────────────────────────────────────────────────
describe('13. 대시보드 발송 대기 숫자는 스튜디오가 지금 보낼 주문만', () => {
  it('아티스트 발송·예약 발송·디지털을 스튜디오 발송 대기에서 뺀다', async () => {
    await product('pS13');
    await sku('db-s000000013', 'pS13');
    await product('pA13');
    await sku('db-a000000013', 'pA13');
    await fulfillment('pA13', 'artist');
    await product('pP13', { shipsOn: '2099-01-01' });
    await sku('db-p000000013', 'pP13');
    await product('pD13', { kind: 'digital' });
    await sku('db-d000000013', 'pD13');

    await rawOrder([{ skuId: 'db-s000000013', productId: 'pS13' }]);
    await rawOrder([{ skuId: 'test-cd-std', productId: 'test-cd' }]);
    await rawOrder([{ skuId: 'db-a000000013', productId: 'pA13' }]);
    await rawOrder([{ skuId: 'db-p000000013', productId: 'pP13' }]);
    await rawOrder([{ skuId: 'db-d000000013', productId: 'pD13' }], { postcode: '' });

    expect(await countShopAwaitingShipment(new Date())).toEqual({ studio: 2, preorder: 1, artist: 1 });
  });

  it('발송 주체 표가 없는 DB에서도 센다(전부 스튜디오)', async () => {
    await product('pS13');
    await sku('db-s000000013', 'pS13');
    await rawOrder([{ skuId: 'db-s000000013', productId: 'pS13' }]);
    await testDb.run(sql.raw('DROP TABLE shop_product_fulfillment'));
    expect(await countShopAwaitingShipment(new Date())).toEqual({ studio: 1, preorder: 0, artist: 0 });
  });
});
