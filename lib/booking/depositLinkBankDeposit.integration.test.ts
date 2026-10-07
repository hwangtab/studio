/** @jest-environment node */
/**
 * 예약금 결제 링크 주문(`orders.type = 'deposit'`)의 **계좌 입금** 운영 전이를 실 DB(in-memory libSQL)로 본다.
 * 하위 표(예약·믹싱)가 없고 고객용 관리 페이지도 없다는 점이 예약·믹싱과 다르다(lib/booking/bankDeposit.ts).
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ ...jest.requireActual('./toss'), confirmPayment: jest.fn(), fetchPayment: jest.fn(), cancelPayment: jest.fn() }));
jest.mock('./email', () => ({
  ...jest.requireActual('./email'),
  sendDepositLinkPaidEmail: jest.fn().mockResolvedValue(null),
}));
jest.mock('../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../payments/bankDepositOrders', () => ({
  ...jest.requireActual('../payments/bankDepositOrders'),
  sendDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import { cancelAwaitingBookingDeposit, confirmBookingBankDeposit, deliverBookingDepositGuide } from './bankDeposit';
import { confirmDepositPayment } from './confirmDeposit';
import { cancelBookingWithRefund } from './cancel';
import { confirmPayment } from './toss';
import { sendDepositLinkPaidEmail } from './email';
import { sendDepositGuideEmails } from '../payments/bankDepositOrders';
import { bankDepositPaymentKey } from '../payments/bankDeposit';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;

const seed = async (status = 'awaiting_deposit') => {
  await client.execute(
    `INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, status, manage_token)
     VALUES ('o1', 'SNB-20261010-AAAAAAAA', 'deposit', '김입금', '010-1234-5678', 'a@b.com', 363636, 36364, 400000, '${status}', 'tok')`,
  );
};

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
  for (const t of ['refunds', 'payments', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('예약금 계좌 입금', () => {
  it('입금 안내 메일은 예약금 라벨·금액 줄만 싣고 관리 링크(manageUrl)를 넣지 않는다', async () => {
    await seed();
    expect(await deliverBookingDepositGuide('SNB-20261010-AAAAAAAA')).toBeNull();
    const arg = (sendDepositGuideEmails as jest.Mock).mock.calls[0][0];
    expect(arg).toMatchObject({ kindLabel: '예약금', totalAmount: 400000, customerName: '김입금' });
    expect(arg.manageUrl).toBeUndefined();
    expect(arg.summaryLines.join('\n')).toContain('400,000원');
  });

  it('입금 확인은 paid + 계좌 입금 결제 행을 한 번만 남기고 고객 메일을 보낸다 — 두 번째는 거절', async () => {
    await seed();
    const first = await confirmBookingBankDeposit({ orderId: 'o1', now: new Date('2026-10-10T00:00:00Z') });
    expect(first).toMatchObject({ ok: true, emailSent: true });
    expect((await one(`SELECT status, notification_error FROM orders WHERE id = 'o1'`))).toMatchObject({ status: 'paid', notification_error: null });
    const pay = await one(`SELECT payment_key, method FROM payments WHERE order_id = 'o1'`);
    expect(pay).toMatchObject({ payment_key: bankDepositPaymentKey('SNB-20261010-AAAAAAAA'), method: '계좌 입금' });
    expect(sendDepositLinkPaidEmail).toHaveBeenCalledTimes(1);

    const second = await confirmBookingBankDeposit({ orderId: 'o1', now: new Date() });
    expect(second).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(sendDepositLinkPaidEmail).toHaveBeenCalledTimes(1);
    expect((await client.execute(`SELECT 1 FROM payments WHERE order_id = 'o1'`)).rows).toHaveLength(1);
  });

  it('입금 확인 메일이 실패해도 확정은 유지하고 notification_error에 사유를 남긴다', async () => {
    await seed();
    (sendDepositLinkPaidEmail as jest.Mock).mockResolvedValueOnce('API_ERROR');
    const r = await confirmBookingBankDeposit({ orderId: 'o1', now: new Date() });
    expect(r).toMatchObject({ ok: true, emailSent: false });
    expect(await one(`SELECT status, notification_error FROM orders WHERE id = 'o1'`)).toMatchObject({ status: 'paid', notification_error: 'API_ERROR' });
  });

  it('미입금 취소는 deposit_cancelled로 닫고, 그 뒤 입금 확인은 되지 않는다', async () => {
    await seed();
    expect(await cancelAwaitingBookingDeposit({ orderId: 'o1' })).toMatchObject({ ok: true });
    expect((await one(`SELECT status FROM orders WHERE id = 'o1'`))?.status).toBe('deposit_cancelled');
    expect(await confirmBookingBankDeposit({ orderId: 'o1', now: new Date() })).toMatchObject({ ok: false, code: 'invalid_state' });
  });

  it('입금 대기 주문에는 토스 승인이 들어가지 않는다(토스 호출 전에 거절)', async () => {
    await seed();
    const r = await confirmDepositPayment({ orderNo: 'SNB-20261010-AAAAAAAA', paymentKey: 'pk', amount: 400000 });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
    const w = await confirmDepositPayment({ orderNo: 'SNB-20261010-AAAAAAAA', paymentKey: 'pk', amount: 400000 }, { trustedByWebhook: true });
    expect(w).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(confirmPayment).not.toHaveBeenCalled();
    expect((await one(`SELECT status FROM orders WHERE id = 'o1'`))?.status).toBe('awaiting_deposit');
  });

  it('예약금 주문은 예약 환불 경로를 타지 않는다', async () => {
    await seed('paid');
    const r = await cancelBookingWithRefund({ orderNo: 'SNB-20261010-AAAAAAAA', requestedBy: 'admin', reason: 'x', overrideAmount: 1000, now: new Date() });
    expect(r).toMatchObject({ ok: false, code: 'invalid_state' });
  });
});
