/** @jest-environment node */
import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';
import { shopPayload } from '../../helpers/shopFixtures';
import { shopSkus } from '../../../db/schema';

let testDb: ShowsTestDb;
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../data/shop/catalog', () => ({
  ...jest.requireActual('../../../data/shop/catalog'),
  SHOP_PRODUCTS: jest.requireActual('../../helpers/shopFixtures').SHOP_FIXTURE_PRODUCTS,
}));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../../lib/getStatic', () => ({ withI18nServerProps: (fn: unknown) => fn }));

/* eslint-disable import/first */
import { getServerSideProps } from '../../../pages/[locale]/shop/manage/[orderNo]';
import { createShopOrder } from '../../../lib/shop/service';
import { confirmShopBankDeposit, cancelAwaitingShopDeposit } from '../../../lib/shop/bankDeposit';
/* eslint-enable import/first */

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  await testDb.insert(shopSkus).values([{ id: 'test-cd-std', productSlug: 'test-cd', stock: 3 }]);
});

const run = async (orderNo: string, token: string) =>
  (getServerSideProps as unknown as (c: unknown) => Promise<{ props?: Record<string, unknown>; notFound?: boolean }>)({
    params: { locale: 'ko', orderNo }, query: { token }, res: { setHeader: jest.fn() },
  });

it('입금 대기 주문 → 입금 안내 props, 확정 후 bankPaid, 미입금 취소 후 deposit_cancelled', async () => {
  const o = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), new Date(), { salesOpen: true, paymentMethod: 'bank_transfer' });
  if (!o.ok) throw new Error('setup');
  const a = await run(o.orderNo, o.manageToken);
  expect(a.props).toMatchObject({ state: 'awaiting_deposit', bankPaid: false, customerName: '김구매' });
  expect(typeof a.props!.depositDeadline).toBe('string');
  await confirmShopBankDeposit({ orderNo: o.orderNo, now: new Date() });
  expect((await run(o.orderNo, o.manageToken)).props).toMatchObject({ state: 'preparing', bankPaid: true, depositDeadline: null });
  const o2 = await createShopOrder(shopPayload([{ skuId: 'test-cd-std', quantity: 1 }]), new Date(), { salesOpen: true, paymentMethod: 'bank_transfer' });
  if (!o2.ok) throw new Error('setup2');
  await cancelAwaitingShopDeposit({ orderNo: o2.orderNo });
  expect((await run(o2.orderNo, o2.manageToken)).props).toMatchObject({ state: 'deposit_cancelled' });
});
