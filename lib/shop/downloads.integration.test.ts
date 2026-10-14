/** @jest-environment node */
import { sql } from 'drizzle-orm';
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shopPayload } from '../../tests/helpers/shopFixtures';
import { fundingCreators, shopProducts, shopProductSkus, shopSkus } from '../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../data/shop/catalog', () => ({
  ...jest.requireActual('../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../tests/helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../booking/toss', () => ({
  ...jest.requireActual('../booking/toss'),
  confirmPayment: jest.fn(),
  fetchPayment: jest.fn(),
  cancelPayment: jest.fn(),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../funding/r2', () => ({ presignFundingDownload: jest.fn(), fundingDownloadObjectExists: jest.fn() }));
jest.mock('./downloads', () => {
  const actual = jest.requireActual('./downloads');
  return { ...actual, getFirstDownloadedAt: jest.fn(actual.getFirstDownloadedAt) };
});

/* eslint-disable import/first */
import handler from '../../pages/api/shop/download';
import { confirmShopOrder } from './confirm';
import { cancelShopOrder } from './cancel';
import { markShopOrderShipped } from './fulfillment';
import { getFirstDownloadedAt, loadOrderDownloadFiles, recordFirstDownload } from './downloads';
import { createShopOrder, findShopOrderByOrderNo } from './service';
import { shopOrderShips } from './shape';
import { listShopArtistSales } from './adminQueries';
import { cancelPayment, confirmPayment } from '../booking/toss';
import { fundingDownloadObjectExists, presignFundingDownload } from '../funding/r2';
import { SHOP_SHIPPING_FEE } from '../../data/shop/policy';
/* eslint-enable import/first */

const DIG = 'db-dddddddddd';
const PHY = 'db-pppppppppp';
const FILES = [{ label: '음원 묶음', key: 'shop/dig/album.zip' }, { label: '가사집', key: 'shop/dig/lyrics.pdf' }];
const SIGNED = 'https://acct.r2.cloudflarestorage.com/bucket/shop/dig/album.zip?X-Amz-Signature=beef';

const done = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'DONE', totalAmount, method: '카드', approvedAt: new Date().toISOString() },
});
const cancelled = (orderNo: string, totalAmount: number) => ({
  ok: true as const,
  payment: { paymentKey: `pk-${orderNo}`, orderId: orderNo, status: 'CANCELED', totalAmount, cancels: [{ cancelAmount: totalAmount, transactionKey: `tx-${orderNo}` }] },
});

const seed = async () => {
  await testDb.insert(fundingCreators).values({ id: 'c1', email: 'c1@example.com', name: '아티스트', taxType: 'withholding' });
  await testDb.insert(shopProducts).values([
    { id: 'p-dig', creatorId: 'c1', slug: 'dig', category: 'album', kind: 'digital', title: '디지털 음반', description: '소개', images: '[]', reviewStatus: 'approved', published: true, digitalFiles: JSON.stringify(FILES) },
    { id: 'p-phy', creatorId: 'c1', slug: 'phy', category: 'goods', title: '실물', description: '소개', images: '[]', reviewStatus: 'approved', published: true },
  ]);
  await testDb.insert(shopProductSkus).values([
    { id: DIG, productId: 'p-dig', price: 5000, lockedAt: 1 },
    { id: PHY, productId: 'p-phy', price: 10000, lockedAt: 1 },
  ]);
  await testDb.insert(shopSkus).values([
    { id: DIG, productSlug: 'dig', stock: 50 }, { id: PHY, productSlug: 'phy', stock: 50 }, { id: 'test-cd-std', productSlug: 'test-cd', stock: 50 },
  ]);
};

let errorSpy: jest.SpyInstance;
beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seed();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (presignFundingDownload as jest.Mock).mockResolvedValue(SIGNED);
  (fundingDownloadObjectExists as jest.Mock).mockResolvedValue(true);
});
afterEach(() => { errorSpy.mockRestore(); jest.clearAllMocks(); });

const noShip = (lines: Array<{ skuId: string; quantity: number }>) => shopPayload(lines, { shipping: undefined });

const place = async (lines: Array<{ skuId: string; quantity: number }>, body = noShip(lines)) => {
  const r = await createShopOrder(body as never, new Date(), { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  return r;
};
const paid = async (lines: Array<{ skuId: string; quantity: number }>, body = noShip(lines)) => {
  const r = await place(lines, body);
  (confirmPayment as jest.Mock).mockResolvedValueOnce(done(r.orderNo, r.totalAmount));
  expect(await confirmShopOrder({ orderNo: r.orderNo, paymentKey: `pk-${r.orderNo}`, amount: r.totalAmount })).toMatchObject({ ok: true });
  return r;
};
const tokenOf = async (orderNo: string) => (await findShopOrderByOrderNo(orderNo))!.manageToken;

const call = async (body: Record<string, unknown>, method = 'POST') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const redirect = jest.fn();
  const res = { setHeader: jest.fn(), status, redirect } as unknown as NextApiResponse;
  await handler({ method, body, query: body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0]?.[0] as number | undefined, body: json.mock.calls[0]?.[0], redirectedTo: redirect.mock.calls[0]?.[1] as string | undefined, res };
};
const downloadRows = async () => testDb.all<{ order_no: string }>(sql`SELECT order_no FROM shop_order_downloads`);

describe('주문 모양 — 배송 없는 디지털 주문', () => {
  it('디지털만 담으면 배송지 없이 주문이 만들어지고 배송비 0, 배송지 칸은 빈 문자열', async () => {
    const r = await place([{ skuId: DIG, quantity: 2 }]);
    expect(r.totalAmount).toBe(10000);
    const order = await findShopOrderByOrderNo(r.orderNo);
    expect(order!.shopOrder).toMatchObject({ recipientName: '', recipientPhone: '', postcode: '', address1: '', address2: null, shippingFee: 0, subtotalAmount: 10000 });
    expect(shopOrderShips(order!.shopOrder!)).toBe(false);
  });

  it('디지털만이면 배송지를 보내도 저장하지 않는다', async () => {
    const r = await place([{ skuId: DIG, quantity: 1 }], shopPayload([{ skuId: DIG, quantity: 1 }]));
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder).toMatchObject({ postcode: '', address1: '' });
  });

  it('실물이 섞이면 배송지가 필요하다 — 없으면 shipping_required, 있으면 배송비가 붙는다', async () => {
    const lines = [{ skuId: DIG, quantity: 1 }, { skuId: PHY, quantity: 1 }];
    expect(await createShopOrder(noShip(lines) as never, new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'shipping_required' });
    expect(await testDb.query.orders.findMany()).toHaveLength(0);
    const r = await place(lines, shopPayload(lines));
    expect(r.totalAmount).toBe(15000 + SHOP_SHIPPING_FEE);
    const so = (await findShopOrderByOrderNo(r.orderNo))!.shopOrder!;
    expect(shopOrderShips(so)).toBe(true);
    expect(so).toMatchObject({ postcode: '03000', shippingFee: SHOP_SHIPPING_FEE });
  });

  it('실물만 주문(파일 상품)은 그대로 — 배송지 필수', async () => {
    const lines = [{ skuId: 'test-cd-std', quantity: 1 }];
    expect(await createShopOrder(noShip(lines) as never, new Date(), { salesOpen: true })).toEqual({ ok: false, code: 'shipping_required' });
    const r = await place(lines, shopPayload(lines));
    expect(r.totalAmount).toBe(20000 + SHOP_SHIPPING_FEE);
  });
});

describe('내려받기 목록·첫 기록', () => {
  it('목록은 주문 줄의 디지털 상품 파일이고 순번이 붙는다(실물 줄은 파일이 없다)', async () => {
    const lines = [{ skuId: PHY, quantity: 1 }, { skuId: DIG, quantity: 1 }];
    const r = await paid(lines, shopPayload(lines));
    const order = await findShopOrderByOrderNo(r.orderNo);
    expect(await loadOrderDownloadFiles(r.orderNo, order!.shopOrder!.items)).toEqual([
      { index: 0, label: '음원 묶음', key: 'shop/dig/album.zip' },
      { index: 1, label: '가사집', key: 'shop/dig/lyrics.pdf' },
    ]);
  });

  it('디지털만 주문의 첫 내려받기는 delivered로 닫고 시각을 남긴다 — 두 번째는 시각을 바꾸지 않는다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    expect(await getFirstDownloadedAt(r.orderNo)).toBeNull();
    expect(await recordFirstDownload(r.orderNo)).toBe(true);
    const so = (await findShopOrderByOrderNo(r.orderNo))!.shopOrder!;
    expect(so.fulfillmentStatus).toBe('delivered');
    expect(so.shippedAt).not.toBeNull();
    expect(so.deliveredAt).not.toBeNull();
    const first = await getFirstDownloadedAt(r.orderNo);
    expect(first).not.toBeNull();
    expect(await recordFirstDownload(r.orderNo)).toBe(true);
    expect(await getFirstDownloadedAt(r.orderNo)).toBe(first);
  });

  it('섞인 주문은 첫 내려받기로 발송 상태가 바뀌지 않는다', async () => {
    const lines = [{ skuId: DIG, quantity: 1 }, { skuId: PHY, quantity: 1 }];
    const r = await paid(lines, shopPayload(lines));
    expect(await recordFirstDownload(r.orderNo)).toBe(true);
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder!.fulfillmentStatus).toBe('preparing');
  });

  it('결제 전 주문과 취소된 주문은 기록하지 않는다', async () => {
    const pending = await place([{ skuId: DIG, quantity: 1 }]);
    expect(await recordFirstDownload(pending.orderNo)).toBe(false);
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: true });
    expect(await recordFirstDownload(r.orderNo)).toBe(false);
    expect(await downloadRows()).toEqual([]);
  });

  it('디지털만 주문은 발송 처리를 거부한다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    expect(await markShopOrderShipped({ orderNo: r.orderNo, courier: 'CJ대한통운', trackingNumber: '123' })).toMatchObject({ ok: false });
  });
});

describe('청약철회 제한 — 고객 취소', () => {
  it('내려받은 뒤에는 고객 취소를 거부하고, 운영자 환불은 된다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    await recordFirstDownload(r.orderNo);
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: false, code: 'downloaded' });
    expect(cancelPayment).not.toHaveBeenCalled();
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'admin', reason: '파일 문제', now: new Date() })).toMatchObject({ ok: true });
  });

  it('내려받기 전에는 고객이 취소할 수 있다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toEqual({ ok: true, refundAmount: r.totalAmount });
  });

  it('경합 — 취소가 읽은 뒤 내려받기가 먼저 기록되면 선점이 0행이라 토스를 부르지 않는다', async () => {
    const lines = [{ skuId: DIG, quantity: 1 }, { skuId: PHY, quantity: 1 }];
    const r = await paid(lines, shopPayload(lines)); // 섞인 주문: 첫 내려받기로 fulfillment가 안 바뀌어 선점 WHERE의 NOT EXISTS만이 막는다
    await recordFirstDownload(r.orderNo);
    (getFirstDownloadedAt as jest.Mock).mockResolvedValueOnce(null); // 낡은 읽기를 흉내 낸다
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: false, code: 'downloaded' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await findShopOrderByOrderNo(r.orderNo))!.status).toBe('paid');
  });

  it('경합 — 취소가 먼저 선점했으면 내려받기는 기록되지 않는다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'cancelled' WHERE order_no = ${r.orderNo}`);
    expect(await recordFirstDownload(r.orderNo)).toBe(false);
    expect(await downloadRows()).toEqual([]);
  });
});

describe('새 표(0053)가 없는 DB — 파일 상품 주문 취소', () => {
  it('db- 줄이 없는 주문의 고객 취소는 새 표를 읽지 않아 성공한다', async () => {
    const lines = [{ skuId: 'test-cd-std', quantity: 1 }];
    const r = await paid(lines, shopPayload(lines));
    for (const t of ['shop_order_downloads', 'shop_serials', 'shop_product_skus', 'shop_products', 'shop_artists']) await testDb.run(sql.raw(`DROP TABLE ${t}`));
    (cancelPayment as jest.Mock).mockResolvedValueOnce(cancelled(r.orderNo, r.totalAmount));
    expect(await cancelShopOrder({ orderNo: r.orderNo, requestedBy: 'customer', reason: 'x', now: new Date() })).toMatchObject({ ok: true });
  });
});

describe('POST /api/shop/download', () => {
  const form = async (orderNo: string, over: Record<string, unknown> = {}) => ({ orderNo, token: await tokenOf(orderNo), file: '0', label: '음원 묶음', ...over });

  it('GET은 405다(링크 미리보기 봇이 기록을 남기지 못한다)', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    const out = await call(await form(r.orderNo), 'GET');
    expect(out.status).toBe(405);
    expect(await downloadRows()).toEqual([]);
  });

  it('토큰이 틀리면 404이고 기록하지 않는다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    expect((await call(await form(r.orderNo, { token: 'wrong' }))).status).toBe(404);
    expect(presignFundingDownload).not.toHaveBeenCalled();
    expect(await downloadRows()).toEqual([]);
  });

  it('첫 내려받기 — 서명 주소로 302하고, 기록하고, 디지털만 주문을 delivered로 닫는다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    const out = await call(await form(r.orderNo));
    expect(out.redirectedTo).toBe(SIGNED);
    expect(out.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(presignFundingDownload).toHaveBeenCalledWith('shop/dig/album.zip');
    expect(await downloadRows()).toHaveLength(1);
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder!.fulfillmentStatus).toBe('delivered');
  });

  it('주문번호는 소문자로 와도 받는다(미들웨어 308 경로)', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    expect((await call(await form(r.orderNo, { orderNo: r.orderNo.toLowerCase() }))).redirectedTo).toBe(SIGNED);
  });

  it('목록에 없는 파일(순번 밖·다른 라벨)은 거부하고 서명하지 않는다', async () => {
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    expect((await call(await form(r.orderNo, { file: '9' }))).status).toBe(404);
    expect((await call(await form(r.orderNo, { file: 'shop/other/secret.zip' }))).status).toBe(404);
    expect((await call(await form(r.orderNo, { label: '가사집' }))).status).toBe(404);
    expect(presignFundingDownload).not.toHaveBeenCalled();
    expect(await downloadRows()).toEqual([]);
  });

  it('디지털 상품이 없는 주문은 파일이 없다', async () => {
    const lines = [{ skuId: 'test-cd-std', quantity: 1 }];
    const r = await paid(lines, shopPayload(lines));
    expect((await call(await form(r.orderNo))).status).toBe(404);
  });

  it('저장소에 객체가 없으면 기록하지 않고 503 — 청약철회를 잃지 않는다', async () => {
    (fundingDownloadObjectExists as jest.Mock).mockResolvedValue(false);
    const r = await paid([{ skuId: DIG, quantity: 1 }]);
    const out = await call(await form(r.orderNo));
    expect(out.status).toBe(503);
    expect(out.redirectedTo).toBeUndefined();
    expect(await downloadRows()).toEqual([]);
    expect((await findShopOrderByOrderNo(r.orderNo))!.shopOrder!.fulfillmentStatus).toBe('preparing');
  });

  it('결제 전·취소된 주문은 409', async () => {
    const pending = await place([{ skuId: DIG, quantity: 1 }]);
    expect((await call(await form(pending.orderNo))).status).toBe(409);
    expect(await downloadRows()).toEqual([]);
  });
});

describe('listShopArtistSales — 디지털 주문', () => {
  const setApproved = (orderNo: string) =>
    testDb.run(sql`UPDATE payments SET approved_at = ${Date.UTC(2026, 9, 15) / 1000} WHERE order_id = (SELECT id FROM orders WHERE order_no = ${orderNo})`);

  it('결제 승인 월로 세고, 내려받기 전 주문은 철회 가능 건수로만 알린다', async () => {
    const a = await paid([{ skuId: DIG, quantity: 2 }]);
    const b = await paid([{ skuId: DIG, quantity: 1 }]);
    await setApproved(a.orderNo);
    await setApproved(b.orderNo);
    await recordFirstDownload(a.orderNo);
    const rows = await listShopArtistSales('2026-10');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ artistSlug: 'creator:c1', quantity: 2, salesAmount: 10000, withdrawableOrderCount: 1 });
    expect(await listShopArtistSales('2026-11')).toEqual([]);
  });

  it('내려받기 전 주문뿐이면 판매 0건에 철회 가능만 뜬다', async () => {
    const a = await paid([{ skuId: DIG, quantity: 1 }]);
    await setApproved(a.orderNo);
    const rows = await listShopArtistSales('2026-10');
    expect(rows[0]).toMatchObject({ quantity: 0, salesAmount: 0, withdrawableOrderCount: 1 });
  });
});
