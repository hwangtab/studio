/** @jest-environment node */
/**
 * 아티스트 콘솔 "발송할 주문" — 화면(SSR)의 접속기록·가림, 발송 API의 소유 판정.
 * 받는 분 정보가 실리는 화면이라 열람 기록이 남는지, 남의 주문이 안 보이고 안 처리되는지가 핵심이다.
 */
import { sql } from 'drizzle-orm';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { agreeShopArtistTermsForTest, shopPayload } from '../../helpers/shopFixtures';
import { fundingCreators, privacyAccessLogs, shopArtists, shopProducts, shopProductSkus, shopSkus } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({ ...jest.requireActual('../../../data/shop/catalog'), SHOP_PRODUCTS: [] }));
jest.mock('../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn(), authenticateCreatorApi: jest.fn() }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));

/* eslint-disable import/first */
import { getServerSideProps } from '../../../pages/[locale]/funding/creator/shop/shipping';
import shippingApi from '../../../pages/api/funding/creator/shop/shipping';
import stockApi from '../../../pages/api/funding/creator/shop/stock';
import { authenticateCreatorApi, authenticateCreatorRequest } from '../../../lib/funding/creatorAuth';
import { createShopOrder, findShopOrderByOrderNo } from '../../../lib/shop/service';
/* eslint-enable import/first */

const DAY = 86400;
const A = 'db-aaaaaaaaaa';
const B = 'db-bbbbbbbbbb';

const seed = async () => {
  await testDb.insert(fundingCreators).values([
    { id: 'cA', email: 'a@example.com', name: '아티스트A' }, { id: 'cB', email: 'b@example.com', name: '아티스트B' },
  ]);
  await testDb.insert(shopArtists).values([{ creatorId: 'cA', slug: 'artist-a' }, { creatorId: 'cB', slug: 'artist-b' }]);
  await agreeShopArtistTermsForTest(testDb, 'cA', 'cB');
  const base = { category: 'goods' as const, description: '소개', images: '[]', reviewStatus: 'approved' as const, published: true };
  await testDb.insert(shopProducts).values([
    { id: 'pA', creatorId: 'cA', slug: 'a-goods', title: 'A 굿즈', ...base }, { id: 'pB', creatorId: 'cB', slug: 'b-goods', title: 'B 굿즈', ...base },
  ]);
  await testDb.insert(shopProductSkus).values([{ id: A, productId: 'pA', price: 20000, lockedAt: 1 }, { id: B, productId: 'pB', price: 30000, lockedAt: 1 }]);
  await testDb.insert(shopSkus).values([{ id: A, productSlug: 'a-goods', stock: 20 }, { id: B, productSlug: 'b-goods', stock: 20 }]);
  await testDb.run(sql`INSERT INTO shop_product_fulfillment (product_id, mode) VALUES ('pA', 'artist'), ('pB', 'artist')`);
};

const place = async (skuId: string) => {
  const r = await createShopOrder(shopPayload([{ skuId, quantity: 1 }]) as never, new Date(), { salesOpen: true });
  if (!r.ok) throw new Error(`setup: ${r.code}`);
  await testDb.run(sql`UPDATE orders SET status = 'paid' WHERE order_no = ${r.orderNo}`);
  return r.orderNo;
};

const open = (locale = 'ko') => getServerSideProps({
  params: { locale }, query: {}, req: { headers: {}, cookies: {}, socket: { remoteAddress: '203.0.113.9' } }, res: { setHeader: jest.fn() },
} as unknown as GetServerSidePropsContext);

const callApi = async (handler: (req: NextApiRequest, res: NextApiResponse) => unknown, body: unknown, method = 'POST') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler({ method, body, query: {}, headers: {}, socket: {} } as unknown as NextApiRequest, { setHeader: jest.fn(), status } as unknown as NextApiResponse);
  return { status: status.mock.calls[0]?.[0] as number | undefined, body: json.mock.calls[0]?.[0] };
};

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await seed();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cA' });
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cA' });
});
afterEach(() => jest.restoreAllMocks());

describe('발송할 주문 화면 (SSR)', () => {
  it('로그인이 없으면 로그인 화면으로, 비-ko는 ko 주소로 보낸다 — 기록도 없다', async () => {
    (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: false });
    expect(await open()).toEqual({ redirect: { destination: '/ko/funding/apply', permanent: false } });
    expect(await open('en')).toEqual({ redirect: { destination: '/ko/funding/creator/shop/shipping', permanent: false } });
    expect(await testDb.select().from(privacyAccessLogs)).toHaveLength(0);
  });

  it('받는 분 정보가 실리면 열람 기록이 남는다 — 수행자 creator:<id>, 대상은 개설자 id, 건수, 값은 없음', async () => {
    await place(A);
    await place(A);
    await place(B);
    const result = await open();
    const props = (result as { props: { rows: Array<{ recipientName: string; orderNo: string }> } }).props;
    expect(props.rows).toHaveLength(2);
    expect(props.rows.every((r) => r.recipientName === '김구매')).toBe(true);
    const logs = await testDb.select().from(privacyAccessLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ actor: 'creator:cA', action: 'shop_artist_shipping_view', targetId: 'cA', result: 'success', rowCount: 2, ip: '203.0.113.9' });
    expect(JSON.stringify(logs)).not.toMatch(/김구매|010-1234|서울 종로구/);
  });

  it('주문이 없으면 기록을 남기지 않는다', async () => {
    await place(B);
    const props = ((await open()) as { props: { rows: unknown[] } }).props;
    expect(props.rows).toEqual([]);
    expect(await testDb.select().from(privacyAccessLogs)).toHaveLength(0);
  });

  it('가려진 행만 있으면 정보가 나가지 않으니 기록도 없다', async () => {
    const no = await place(A);
    const now = Math.floor(Date.now() / 1000);
    await testDb.run(sql`UPDATE shop_orders SET fulfillment_status = 'delivered', shipped_at = ${now - 50 * DAY}, delivered_at = ${now - 40 * DAY} WHERE order_no = ${no}`);
    const props = ((await open()) as { props: { rows: Array<{ masked: boolean; recipientName: string }> } }).props;
    expect(props.rows).toHaveLength(1);
    expect(props.rows[0]).toMatchObject({ masked: true, recipientName: '' });
    expect(await testDb.select().from(privacyAccessLogs)).toHaveLength(0);
  });

  it('조회가 실패하면 화면은 오류 안내로 열리고 기록은 없다', async () => {
    // 첫 조회(위탁 약관 동의)는 통과시키고 주문 조회만 실패시킨다.
    const realAll = testDb.all.bind(testDb);
    jest.spyOn(testDb, 'all')
      .mockImplementationOnce(((query: Parameters<typeof realAll>[0]) => realAll(query)) as typeof testDb.all)
      .mockRejectedValueOnce(new Error('연결 끊김'));
    const result = await open();
    expect((result as { props: { loadFailed: boolean } }).props.loadFailed).toBe(true);
    expect(await testDb.select().from(privacyAccessLogs)).toHaveLength(0);
  });
});

describe('발송 API', () => {
  it('로그인이 없으면 401', async () => {
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    expect((await callApi(shippingApi, { action: 'ship', orderNo: 'SHP-20261014-AAAAAAAA' })).status).toBe(401);
  });

  it('자기 주문은 발송 처리된다', async () => {
    const no = await place(A);
    const r = await callApi(shippingApi, { action: 'ship', orderNo: no, courier: 'CJ대한통운', trackingNumber: '111' });
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect((await findShopOrderByOrderNo(no))!.shopOrder).toMatchObject({ fulfillmentStatus: 'shipped', courier: 'CJ대한통운', trackingNumber: '111' });
    expect((await callApi(shippingApi, { action: 'deliver', orderNo: no })).status).toBe(200);
  });

  it('남의 주문은 404이고 상태가 바뀌지 않는다 — 없는 주문과 같은 응답', async () => {
    const theirs = await place(B);
    const r = await callApi(shippingApi, { action: 'ship', orderNo: theirs, courier: 'CJ대한통운', trackingNumber: '111' });
    const missing = await callApi(shippingApi, { action: 'ship', orderNo: 'SHP-20261014-AAAAAAAA', courier: 'CJ대한통운', trackingNumber: '111' });
    expect(r.status).toBe(404);
    expect(r).toEqual(missing);
    expect((await findShopOrderByOrderNo(theirs))!.shopOrder!.fulfillmentStatus).toBe('preparing');
    expect((await callApi(shippingApi, { action: 'deliver', orderNo: theirs })).status).toBe(404);
  });

  it('주문번호 형식·알 수 없는 작업·운송장 누락은 거절한다', async () => {
    const no = await place(A);
    expect((await callApi(shippingApi, { action: 'ship', orderNo: 'nope' })).status).toBe(400);
    expect((await callApi(shippingApi, { action: 'refund', orderNo: no })).status).toBe(400);
    expect((await callApi(shippingApi, { action: 'ship', orderNo: no, courier: '', trackingNumber: '' })).status).toBe(409);
    expect((await callApi(shippingApi, {}, 'GET')).status).toBe(405);
  });
});

describe('재고 API', () => {
  it('자기 직접 발송 상품은 되고, 남의 상품은 400', async () => {
    expect((await callApi(stockApi, { skuId: A, stock: 9 })).status).toBe(200);
    expect((await callApi(stockApi, { skuId: B, stock: 9 })).status).toBe(400);
    expect((await testDb.select().from(shopSkus)).find((s) => s.id === B)!.stock).toBe(20);
    expect((await callApi(stockApi, { skuId: A })).status).toBe(400);
  });
});
