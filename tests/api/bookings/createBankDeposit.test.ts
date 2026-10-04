/** @jest-environment node */
/**
 * POST /api/bookings·/api/orders/mixing·/api/shows/orders의 **계좌 입금** 분기 — 결제수단 검사, 남용 상한,
 * 안내 메일, 응답의 안내 페이지 주소(관리 토큰 포함). 판정·전이는 lib 통합 테스트가 본다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/booking/gcal', () => ({
  ...jest.requireActual('../../../lib/booking/gcal'),
  fetchBusyRanges: jest.fn().mockResolvedValue([]),
  createBookingEvent: jest.fn().mockResolvedValue('evt-waiting'),
}));
jest.mock('../../../lib/payments/bankDepositOrders', () => ({
  ...jest.requireActual('../../../lib/payments/bankDepositOrders'),
  sendDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import type { NextApiRequest, NextApiResponse } from 'next';
import bookingHandler from '../../../pages/api/bookings';
import mixingHandler from '../../../pages/api/orders/mixing';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendDepositGuideEmails } from '../../../lib/payments/bankDepositOrders';
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
  for (const t of ['work_orders', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const call = async (handler: typeof bookingHandler, body: Record<string, unknown>) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  await handler(
    { method: 'POST', body, headers: {}, socket: { remoteAddress: '127.0.0.1' } } as unknown as NextApiRequest,
    { setHeader: jest.fn(), status } as unknown as NextApiResponse,
  );
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] as Record<string, unknown> };
};

const customer = { customerName: '김입금', customerPhone: '01012345678', customerEmail: 'bank@example.com', refundPolicyAgreed: true };
const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);

describe('POST /api/bookings — 계좌 입금', () => {
  it('입금 대기로 만들고 안내 메일을 보내고, 입금 안내가 있는 예약 확인 주소를 돌려준다', async () => {
    const res = await call(bookingHandler, { productId: 'recording-pro', date: futureDate(5), startHour: 14, ...customer, paymentMethod: 'bank_transfer' });
    expect(res.status).toBe(201);
    expect(res.body.paymentMethod).toBe('bank_transfer');
    expect(String(res.body.manageUrl)).toMatch(/^\/ko\/booking\/manage\/SNB-[^?]+\?token=.+/);
    const row = (await client.execute('SELECT status, notification_error FROM orders')).rows[0];
    expect(row.status).toBe('awaiting_deposit');
    expect(row.notification_error).toBeNull();
    expect(sendDepositGuideEmails).toHaveBeenCalledTimes(1);
  });

  it('모르는 결제수단은 400', async () => {
    const res = await call(bookingHandler, { productId: 'recording-pro', date: futureDate(6), startHour: 14, ...customer, paymentMethod: 'cash' });
    expect(res.status).toBe(400);
  });

  it('같은 이메일로 여러 건 신청해도 막지 않는다 — 계좌 입금 전용 상한은 없다(운영자 결정 2026-10-04)', async () => {
    for (const [i, h] of [11, 12, 15, 18].entries()) {
      const ok = await call(bookingHandler, { productId: 'recording-pro', date: futureDate(10 + i), startHour: h, ...customer, paymentMethod: 'bank_transfer' });
      expect(ok.status).toBe(201);
    }
    expect((consumeRateLimit as jest.Mock).mock.calls.some(([key]: [string]) => key.includes('email'))).toBe(false);
  });

  it('이용 시작 2시간 전 이내면 409 starts_too_soon(화면과 같은 판정) — 카드는 된다', async () => {
    jest.useFakeTimers({
      now: new Date('2026-12-10T04:30:00Z'), // KST 13:30
      doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask', 'clearTimeout', 'clearInterval', 'clearImmediate'],
    });
    try {
      const bank = await call(bookingHandler, { productId: 'recording-pro', date: '2026-12-10', startHour: 15, ...customer, paymentMethod: 'bank_transfer' });
      expect(bank.status).toBe(409);
      expect(bank.body.code).toBe('starts_too_soon');
      const card = await call(bookingHandler, { productId: 'recording-pro', date: '2026-12-10', startHour: 15, ...customer });
      expect(card.status).toBe(201);
    } finally {
      jest.useRealTimers();
    }
  });
});
