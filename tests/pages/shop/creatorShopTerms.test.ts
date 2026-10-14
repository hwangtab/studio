/** @jest-environment node */
/**
 * 상점 위탁 약관 — 콘솔 화면(SSR)의 동의 게이트와 쓰기 API의 서버 거부, 동의 API.
 * 동의 전에는 상품 목록·편집·발송 화면 대신 동의 화면이고, 상품 생성·저장·재고·발송 API는 403이다.
 */
import { sql } from 'drizzle-orm';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { fundingCreators, privacyAccessLogs, shopArtists, shopArtistTermsAgreements } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({ ...jest.requireActual('../../../data/shop/catalog'), SHOP_PRODUCTS: [] }));
jest.mock('../../../lib/funding/creatorAuth', () => ({ authenticateCreatorRequest: jest.fn(), authenticateCreatorApi: jest.fn() }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));

/* eslint-disable import/first */
import { getServerSideProps as shopHomeProps } from '../../../pages/[locale]/funding/creator/shop/index';
import { getServerSideProps as productPageProps } from '../../../pages/[locale]/funding/creator/shop/[id]';
import { getServerSideProps as shippingPageProps } from '../../../pages/[locale]/funding/creator/shop/shipping';
import productsApi from '../../../pages/api/funding/creator/shop/products';
import productApi from '../../../pages/api/funding/creator/shop/products/[id]';
import shippingApi from '../../../pages/api/funding/creator/shop/shipping';
import stockApi from '../../../pages/api/funding/creator/shop/stock';
import termsApi from '../../../pages/api/funding/creator/shop/terms';
import { authenticateCreatorApi, authenticateCreatorRequest } from '../../../lib/funding/creatorAuth';
import { SHOP_ARTIST_TERMS_VERSION } from '../../../lib/shop/artistTerms';
/* eslint-enable import/first */

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

const callApi = async (handler: Handler, body: unknown, method = 'POST', query: Record<string, string> = {}) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method, body, query, headers: {}, socket: { remoteAddress: '203.0.113.9' } } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0]?.[0] as number | undefined, body: json.mock.calls[0]?.[0] };
};

const ctx = (params: Record<string, string>) => ({
  params: { locale: 'ko', ...params }, query: {}, req: { headers: {}, cookies: {}, socket: { remoteAddress: '203.0.113.9' } }, res: { setHeader: jest.fn() },
} as unknown as GetServerSidePropsContext);

type HomeShop = { terms: { agreed: boolean; previousVersion: string | null }; products: unknown[] } | null;
const home = async () => ((await shopHomeProps(ctx({}))) as { props: { shop: HomeShop } }).props.shop;

const agree = () => callApi(termsApi as Handler, { version: SHOP_ARTIST_TERMS_VERSION, agreed: true });

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(fundingCreators).values({ id: 'cA', email: 'a@example.com', name: '아티스트A' });
  await testDb.insert(shopArtists).values({ creatorId: 'cA', slug: 'artist-a' });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  (authenticateCreatorRequest as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cA' });
  (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cA' });
});
afterEach(() => jest.restoreAllMocks());

describe('콘솔 화면', () => {
  it('동의 전에는 상점 탭이 동의 화면만 싣고, 동의하면 상품 화면이 열린다', async () => {
    expect(await home()).toMatchObject({ terms: { agreed: false, previousVersion: null }, products: [] });
    expect((await agree()).status).toBe(200);
    expect(await home()).toMatchObject({ terms: { agreed: true } });
  });

  it('옛 판본에만 동의했으면 다시 동의 화면이다(바뀐 판본 안내)', async () => {
    await testDb.insert(shopArtistTermsAgreements).values({ creatorId: 'cA', termsVersion: 'shop-artist-terms-2026-01-01', agreedAt: 1_780_000_000 });
    expect(await home()).toMatchObject({ terms: { agreed: false, previousVersion: 'shop-artist-terms-2026-01-01' } });
  });

  it('동의 전에는 상품 편집·발송 화면이 상점 탭으로 돌아가고, 발송 화면은 열람 기록도 남기지 않는다', async () => {
    expect(await productPageProps(ctx({ id: 'whatever' }))).toEqual({ redirect: { destination: '/ko/funding/creator/shop', permanent: false } });
    expect(await shippingPageProps(ctx({}))).toEqual({ redirect: { destination: '/ko/funding/creator/shop', permanent: false } });
    expect(await testDb.select().from(privacyAccessLogs)).toHaveLength(0);
  });

  it('표가 없는 DB(0059 전)에서는 동의 화면이다(fail-closed)', async () => {
    await testDb.run(sql`DROP TABLE shop_artist_terms_agreements`);
    expect(await home()).toMatchObject({ terms: { agreed: false } });
    expect(await shippingPageProps(ctx({}))).toMatchObject({ redirect: { destination: '/ko/funding/creator/shop' } });
  });
});

describe('쓰기 API — 동의 전 거부', () => {
  it('상품 만들기·저장·제출·재고·발송이 모두 403 terms_not_agreed다', async () => {
    const results = await Promise.all([
      callApi(productsApi as Handler, {}),
      callApi(productApi as Handler, { value: {} }, 'PUT', { id: 'p1' }),
      callApi(productApi as Handler, { action: 'submit' }, 'POST', { id: 'p1' }),
      callApi(stockApi as Handler, { skuId: 'db-aaaaaaaaaa', stock: 3 }),
      callApi(shippingApi as Handler, { action: 'ship', orderNo: 'SHP-20261014-AAAAAAAA', courier: '로젠택배', trackingNumber: '1' }),
    ]);
    for (const r of results) expect(r).toMatchObject({ status: 403, body: { ok: false, code: 'terms_not_agreed' } });
  });

  it('동의하면 상품을 만들 수 있다', async () => {
    expect((await agree()).status).toBe(200);
    expect(await callApi(productsApi as Handler, {})).toMatchObject({ status: 200, body: { ok: true } });
  });

  it('목록 조회(GET)는 막지 않는다', async () => {
    expect(await callApi(productsApi as Handler, undefined, 'GET')).toMatchObject({ status: 200 });
  });
});

describe('동의 API', () => {
  it('체크 없이·형식이 틀리면 400, 화면이 본 판본이 지금과 다르면 409', async () => {
    expect((await callApi(termsApi as Handler, { version: SHOP_ARTIST_TERMS_VERSION })).status).toBe(400);
    expect((await callApi(termsApi as Handler, { version: 'shop-artist-terms-2026-01-01', agreed: true })).status).toBe(409);
    expect(await testDb.select().from(shopArtistTermsAgreements)).toHaveLength(0);
  });

  it('상점에 등재되지 않은 계정은 403', async () => {
    await testDb.insert(fundingCreators).values({ id: 'cX', email: 'x@example.com', name: '엑스' });
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: true, creatorId: 'cX' });
    expect((await agree()).status).toBe(403);
  });

  it('로그인이 없으면 401, POST가 아니면 405', async () => {
    expect((await callApi(termsApi as Handler, {}, 'GET')).status).toBe(405);
    (authenticateCreatorApi as jest.Mock).mockResolvedValue({ ok: false });
    expect((await agree()).status).toBe(401);
  });

  it('동의하면 판본·시각이 기록된다', async () => {
    const r = await agree();
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    const rows = await testDb.select().from(shopArtistTermsAgreements);
    expect(rows).toEqual([{ creatorId: 'cA', termsVersion: SHOP_ARTIST_TERMS_VERSION, agreedAt: (r.body as { agreedAt: number }).agreedAt }]);
  });
});
