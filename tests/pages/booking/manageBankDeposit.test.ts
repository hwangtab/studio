/** @jest-environment node */
/**
 * 예약 확인 페이지(SSR)의 계좌 입금 배선 — 취소 API(pages/api/bookings/cancel.ts)와 **같은** bankDepositStateOf로
 * 판정해 입금 대기면 안내(금액·기한)를, 입금 확인된 주문이면 환불 계좌를 받는 취소를 그린다. 판정 함수 테스트
 * (lib/payments/bankDeposit.test.ts)와 따로 둔다 — PR #77은 판정이 아니라 배선에서 났다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/email', () => ({
  ...jest.requireActual('../../../lib/booking/email'),
  sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  createBookingEvent: jest.fn().mockResolvedValue('evt'),
  deleteBookingEvent: jest.fn().mockResolvedValue(undefined),
}));

/* eslint-disable import/first */
import { getServerSideProps } from '../../../pages/[locale]/booking/manage/[orderNo]';
import { createBookingOrder } from '../../../lib/booking/service';
import { confirmBookingBankDeposit } from '../../../lib/booking/bankDeposit';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const resStub = () => ({ setHeader: jest.fn() });

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const createBank = async () => {
  const r = await createBookingOrder({
    productId: 'recording-pro', hours: 3, date: '2026-12-10', startHour: 14,
    customerName: '김입금', customerPhone: '010-1234-5678', customerEmail: 'bank@example.com', refundPolicyAgreed: true,
  }, new Date(), { paymentMethod: 'bank_transfer' });
  if (!r.ok) throw new Error('setup');
  const row = await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) });
  return { orderNo: r.orderNo, id: row!.id, token: row!.manageToken };
};

const ssr = (orderNo: string, token: string) =>
  getServerSideProps({ params: { locale: 'ko', orderNo: orderNo.toLowerCase() }, query: { token }, res: resStub() } as never) as unknown as Promise<{ props: Record<string, unknown> }>;

it('입금 대기면 금액·기한이 담긴 안내를 싣는다(취소 버튼 대신 입금 전 신청 취소)', async () => {
  const { orderNo, token } = await createBank();
  const { props } = await ssr(orderNo, token);
  expect(props.bankDeposit).toBe('awaiting');
  expect(props.depositGuide).toMatchObject({ customerName: '김입금', applicantLabel: '예약하신 분' });
  expect(props.canCancel).toBe(false);
  // 안내 기한은 신청 + 3일(이용 시작이 그보다 늦다).
  const deadline = new Date((props.depositGuide as { deadline: string }).deadline).getTime();
  expect(Math.abs(deadline - (Date.now() + 3 * 86400 * 1000))).toBeLessThan(60_000);
});

it('입금이 확인된 주문은 bankDeposit=paid — 화면이 환불 계좌를 받는 취소를 그린다', async () => {
  const { orderNo, token, id } = await createBank();
  await confirmBookingBankDeposit({ orderId: id, now: new Date() });
  const { props } = await ssr(orderNo, token);
  expect(props.bankDeposit).toBe('paid');
  expect(props.depositGuide).toBeNull();
  expect(props.canCancel).toBe(true);
});

it('토스 주문은 bankDeposit=null — 기존 화면 그대로다', async () => {
  const r = await createBookingOrder({
    productId: 'recording-pro', hours: 3, date: '2026-12-11', startHour: 14,
    customerName: '박카드', customerPhone: '010-1', customerEmail: 'c@example.com', refundPolicyAgreed: true,
  }, new Date());
  if (!r.ok) throw new Error('setup');
  const row = await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) });
  const { props } = await ssr(r.orderNo, row!.manageToken);
  expect(props.bankDeposit).toBeNull();
  expect(props.depositGuide).toBeNull();
});
