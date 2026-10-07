/** @jest-environment node */
/**
 * 계좌 입금 라우트 배선(실 DB) — 고객 취소 API의 대기 분기, 관리자 예약 API의 입금 확인·미입금 취소·송금 완료·
 * 재발송 차단·대기 일정 지우기, 슬롯 조회의 대기 점유. 전이 자체는 lib 통합 테스트가 본다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true, actor: 'kyungha' }) }));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  fetchBusyRanges: jest.fn().mockResolvedValue([]),
  createBookingEvent: jest.fn().mockResolvedValue('evt'),
  deleteBookingEvent: jest.fn().mockResolvedValue(undefined),
  renameBookingEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/booking/email', () => ({
  ...jest.requireActual('../../../lib/booking/email'),
  sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../lib/payments/bankDepositOrders', () => ({
  ...jest.requireActual('../../../lib/payments/bankDepositOrders'),
  sendDepositWithdrawnOperatorAlert: jest.fn().mockResolvedValue(undefined),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import cancelHandler from '../../../pages/api/bookings/cancel';
import slotsHandler from '../../../pages/api/bookings/slots';
import adminHandler from '../../../pages/api/admin/bookings/[id]';
import { createBookingOrder } from '../../../lib/booking/service';
import { sendBookingCancelledEmails } from '../../../lib/booking/email';
import { deleteBookingEvent } from '../../../lib/booking/gcal';
import { sendDepositWithdrawnOperatorAlert } from '../../../lib/payments/bankDepositOrders';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeAll(async () => {
  process.env.BOOKING_GCAL_ID = 'studio-cal';
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => {
  delete process.env.BOOKING_GCAL_ID;
  client.close();
});
beforeEach(async () => {
  for (const t of ['refund_accounts', 'refunds', 'payments', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;
const call = async (handler: Handler, req: { method?: string; body?: unknown; query?: Record<string, string> }) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: req.method ?? 'POST', body: req.body, query: req.query ?? {}, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
};

const DATE = new Date(Date.now() + 12 * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
const createBank = async () => {
  const r = await createBookingOrder({
    productId: 'recording-pro', hours: 3, date: DATE, startHour: 14,
    customerName: '김입금', customerPhone: '010-1234-5678', customerEmail: 'bank@example.com', refundPolicyAgreed: true,
  }, new Date(), { paymentMethod: 'bank_transfer' });
  if (!r.ok) throw new Error('setup');
  const row = await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, r.orderNo) });
  return { ...r, id: row!.id, token: row!.manageToken };
};
const status = async (orderNo: string) => (await mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) }))?.status;
const admin = (id: string, action: string) => call(adminHandler as Handler, { body: { action }, query: { id } });

it('슬롯 조회: 계좌 입금 대기 예약의 시간대는 하루가 지나도 막혀 있다(occupiedBookingSql)', async () => {
  await createBank();
  await client.execute('UPDATE bookings SET created_at = created_at - 86400');
  const res = await call(slotsHandler as Handler, { method: 'GET', query: { productId: 'recording-pro', date: DATE, hours: '3' } });
  expect(res.status).toBe(200);
  const slots = res.body.slots as Array<{ startHour: number; available: boolean }>;
  expect(slots.find((s) => s.startHour === 14)?.available).toBe(false);
});

it('고객 취소 API: 입금 대기면 환불 없이 신청을 거두고(고객 메일 없음, 운영자 알림 한 통) 시간대를 푼다', async () => {
  const b = await createBank();
  const res = await call(cancelHandler as Handler, { body: { orderNo: b.orderNo.toLowerCase(), token: b.token } });
  expect(res).toMatchObject({ status: 200, body: { ok: true, withdrawn: true } });
  expect(await status(b.orderNo)).toBe('deposit_cancelled');
  expect(sendBookingCancelledEmails).not.toHaveBeenCalled();
  expect(sendDepositWithdrawnOperatorAlert).toHaveBeenCalledTimes(1);
  expect(sendDepositWithdrawnOperatorAlert).toHaveBeenCalledWith(expect.objectContaining({ orderNo: b.orderNo }));
});

describe('관리자 예약 API — 계좌 입금', () => {
  it('confirm_deposit → paid, 두 번째는 409', async () => {
    const b = await createBank();
    expect((await admin(b.id, 'confirm_deposit')).status).toBe(200);
    expect(await status(b.orderNo)).toBe('paid');
    expect((await admin(b.id, 'confirm_deposit')).status).toBe(409);
  });

  it('cancel_unpaid_deposit → deposit_cancelled, 그 뒤 resend-notification은 409(메일 안 나감)', async () => {
    const b = await createBank();
    expect((await admin(b.id, 'cancel_unpaid_deposit')).status).toBe(200);
    expect(await status(b.orderNo)).toBe('deposit_cancelled');
    const resend = await admin(b.id, 'resend-notification');
    expect(resend.status).toBe(409);
    expect(sendBookingCancelledEmails).not.toHaveBeenCalled();
    // 운영자가 직접 한 취소에는 운영자 알림이 없다.
    expect(sendDepositWithdrawnOperatorAlert).not.toHaveBeenCalled();
  });

  it('delete_waiting_event: 미입금 취소 때 지우지 못한 대기 일정을 다시 지운다', async () => {
    const b = await createBank();
    await client.execute(`UPDATE bookings SET gcal_event_id = 'evt-w'`);
    (deleteBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('503'));
    await admin(b.id, 'cancel_unpaid_deposit');
    expect((await admin(b.id, 'delete_waiting_event')).status).toBe(200);
    const row = (await client.execute('SELECT gcal_event_id FROM bookings')).rows[0];
    expect(row.gcal_event_id).toBeNull();
  });

  it('mark_refund_sent: 고객 환불 계좌 행에만 송금 완료를 찍는다(토스 주문·대기 건은 409)', async () => {
    const b = await createBank();
    expect((await admin(b.id, 'mark_refund_sent')).status).toBe(409);
    await admin(b.id, 'confirm_deposit');
    await client.execute({
      sql: `INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at) VALUES ('ra','session',?,'국민','enc','김입금', unixepoch())`,
      args: [b.orderNo],
    });
    expect((await admin(b.id, 'mark_refund_sent')).status).toBe(200);
    expect((await client.execute('SELECT refunded_at FROM refund_accounts')).rows[0].refunded_at).not.toBeNull();
  });
});
