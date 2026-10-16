/** @jest-environment node */
/**
 * 관리자 화면 열람 접속기록 — 후원 상세·상점 주문 상세·소프트웨어 라이선스 목록.
 * 개인정보가 props로 실리는 화면이라 열었다는 사실이 남는지, 기록 실패가 화면을 막지 않는지,
 * 기록에 값(이름·연락처·주소·이메일·검색어)이 한 글자도 안 들어가는지를 본다.
 */
import type { Client } from '@libsql/client';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { shopPayload } from '../../helpers/shopFixtures';
import { privacyAccessLogs, shopSkus } from '../../../db/schema';

let testDb: ShowsTestDb;
let client: Client;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({
  ...jest.requireActual('../../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../../../data/software/catalog', () => ({
  ...jest.requireActual('../../../data/software/catalog'),
  SOFTWARE_PRODUCTS: jest.requireActual('../../helpers/softwareFixtures').SOFTWARE_FIXTURE_PRODUCTS,
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/payments/windowOpen', () => ({ loadPaymentWindowOpen: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  authenticateAdminRequest: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }),
}));

/* eslint-disable import/first */
import { getServerSideProps as fundingDetail } from '../../../pages/admin/funding/[id]';
import { getServerSideProps as shopDetail } from '../../../pages/admin/shop/[orderNo]';
import { getServerSideProps as softwareList } from '../../../pages/admin/software/index';
import { createShopOrder } from '../../../lib/shop/service';
import { issueLicense } from '../../../lib/software/service';
import { SOFTWARE_PRODUCTS } from '../../../data/software/catalog';
/* eslint-enable import/first */

type Result = { props?: Record<string, unknown>; notFound?: boolean };
const req = { headers: {}, cookies: {}, socket: { remoteAddress: '203.0.113.9' } };
const call = (gssp: unknown, ctx: Record<string, unknown>) =>
  (gssp as (c: unknown) => Promise<Result>)({ req, res: { setHeader: jest.fn() }, params: {}, query: {}, ...ctx });

const logs = () => testDb.select().from(privacyAccessLogs);

beforeEach(async () => {
  const t = await createTestDb();
  testDb = t.db;
  client = t.client;
  await testDb.insert(shopSkus).values([{ id: 'test-cd-std', productSlug: 'test-cd', stock: 3 }]);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const insertPledge = async (id: string) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'funding', 'paid', '김후원', '010-9999-8888', 'pledger@example.com', ?, 4545, 455, 5000)`,
    args: [id, `FND-${id}`, `tok-${id}`],
  });
  await client.execute({
    sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount, quantity, additional_amount, payment_method, hold_expires_at, entry_source)
          VALUES (?, ?, 'demo', 'mail', '감사 메일', 5000, 1, 0, 'toss', 1790000000, 'online')`,
    args: [`p-${id}`, id],
  });
};

const placeShop = async () => {
  const o = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), new Date(), { salesOpen: true });
  if (!o.ok) throw new Error('setup');
  return o.orderNo;
};

describe('펀딩 후원 상세', () => {
  it('열면 funding_pledge_view가 주문 id로 남고, 값은 적히지 않는다', async () => {
    await insertPledge('o1');
    const r = await call(fundingDetail, { query: { id: 'o1' } });
    expect(r.props).toBeDefined();
    const rows = await logs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: 'kyungha', action: 'funding_pledge_view', targetId: 'o1', result: 'success', rowCount: null, ip: '203.0.113.9' });
    expect(JSON.stringify(rows)).not.toMatch(/김후원|010-9999|pledger@example/);
  });

  it('없는 주문을 열어도 not_found로 남고 404다', async () => {
    const r = await call(fundingDetail, { query: { id: 'nope' } });
    expect(r.notFound).toBe(true);
    expect(await logs()).toMatchObject([{ action: 'funding_pledge_view', targetId: 'nope', result: 'not_found' }]);
  });

  it('기록 저장이 실패해도 화면은 열린다', async () => {
    await insertPledge('o2');
    await client.execute('DROP TABLE privacy_access_logs');
    const r = await call(fundingDetail, { query: { id: 'o2' } });
    expect(r.props).toBeDefined();
  });
});

describe('상점 주문 상세', () => {
  it('열면 shop_order_view가 주문번호로 남고, 받는 분 정보는 적히지 않는다', async () => {
    const orderNo = await placeShop();
    const r = await call(shopDetail, { params: { orderNo } });
    expect(r.props).toBeDefined();
    const rows = await logs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: 'kyungha', action: 'shop_order_view', targetId: orderNo, result: 'success', rowCount: null });
    expect(JSON.stringify(rows)).not.toMatch(/김구매|010-1234|buyer@example|종로구/);
  });

  it('없는 주문은 not_found로 남는다', async () => {
    const r = await call(shopDetail, { params: { orderNo: 'SHP-20260101-AAAAAAAA' } });
    expect(r.notFound).toBe(true);
    expect((await logs()).map((l) => l.result)).toEqual(['not_found']);
  });

  it('기록 저장이 실패해도 화면은 열린다', async () => {
    const orderNo = await placeShop();
    await client.execute('DROP TABLE privacy_access_logs');
    expect((await call(shopDetail, { params: { orderNo } })).props).toBeDefined();
  });
});

describe('소프트웨어 라이선스 목록', () => {
  const issue = (email: string) => issueLicense({ productSlug: SOFTWARE_PRODUCTS[0].slug, email, source: 'manual' });

  it('행마다가 아니라 한 줄, 건수는 rowCount, 검색어·이메일은 적히지 않는다', async () => {
    await issue('one@example.com');
    await issue('two@example.com');
    const r = await call(softwareList, { query: { q: 'one@example.com' } });
    expect(r.props).toBeDefined();
    const rows = await logs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: 'kyungha', action: 'software_license_list_view', targetId: 'licenses', result: 'success', rowCount: 1 });
    expect(JSON.stringify(rows)).not.toMatch(/example\.com/);
  });

  it('조회가 실패하면 error로 남고 화면은 오류 안내로 열린다', async () => {
    await client.execute('DROP TABLE software_activations');
    await client.execute('DROP TABLE software_licenses');
    const r = await call(softwareList, {});
    expect(r.props).toMatchObject({ licenses: [] });
    expect(await logs()).toMatchObject([{ action: 'software_license_list_view', result: 'error', rowCount: null }]);
  });

  it('기록 저장이 실패해도 화면은 열린다', async () => {
    await issue('three@example.com');
    await client.execute('DROP TABLE privacy_access_logs');
    const r = await call(softwareList, {});
    expect(r.props).toMatchObject({ licenses: [expect.anything()] });
  });
});
