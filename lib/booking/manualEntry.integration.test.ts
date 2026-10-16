/** @jest-environment node */
/**
 * 수기 예약 등록을 실 DB(in-memory libSQL)로 본다 — 웹 예약과 같은 원장·같은 점유 규칙을 타는지,
 * 협의가·이메일 없음·지난 일정이 의도대로 처리되는지.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./calendarGuard', () => ({ ...jest.requireActual('./calendarGuard'), calendarBlockedRooms: jest.fn() }));
jest.mock('./gcal', () => ({
  ...jest.requireActual('./gcal'),
  createBookingEvent: jest.fn().mockResolvedValue('evt-confirmed'),
  deleteBookingEvent: jest.fn().mockResolvedValue(undefined),
  renameBookingEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./email', () => ({
  ...jest.requireActual('./email'),
  sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderConfirmedEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import { calendarBlockedRooms } from './calendarGuard';
import { createManualBooking, parseManualBookingInput } from './manualEntry';
import { createBookingOrder } from './service';
import { sendBookingConfirmedEmails } from './email';
import { MANUAL_PLACEHOLDER_EMAIL } from '../privacy/manualPlaceholder';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;
const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;

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
  for (const t of ['refunds', 'payments', 'work_orders', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  (calendarBlockedRooms as jest.Mock).mockResolvedValue({ blocked: false, excludeRooms: [] });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const session = (over: Record<string, unknown> = {}) => ({
  kind: 'session', productId: 'recording-pro', date: '2026-11-20', startHour: 14,
  customerName: '김전화', customerPhone: '010-1234-5678', customerEmail: 'call@example.com',
  received: true, method: '계좌 입금', ...over,
});
const make = (over: Record<string, unknown> = {}) => {
  const parsed = parseManualBookingInput(session(over), NOW);
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.value;
};

describe('parseManualBookingInput', () => {
  it.each([
    ['이름 없음', { customerName: ' ' }],
    ['잘못된 연락처', { customerPhone: '123' }],
    ['잘못된 이메일', { customerEmail: 'nope' }],
    ['모르는 상품', { productId: 'nope' }],
    ['smoke-test 상품', { productId: 'smoke-test' }],
    ['영업시간 밖', { startHour: 22 }],
    ['받았는지 미선택', { received: undefined }],
    ['모르는 방법', { method: '카드' }],
    ['0원', { totalAmount: 0 }],
    ['"25만"이 25로 줄어든 금액', { totalAmount: 25 }],
    ['너무 먼 날짜', { date: '2030-01-01' }],
  ])('거절: %s', (_n, over) => {
    expect(parseManualBookingInput(session(over), NOW).ok).toBe(false);
  });

  it('연락처·이메일을 비우면 플레이스홀더로 채운다', () => {
    const v = make({ customerPhone: '', customerEmail: '' });
    expect(v.payload).toMatchObject({ customerPhone: '-', customerEmail: MANUAL_PLACEHOLDER_EMAIL });
  });
});

describe('createManualBooking', () => {
  it('받은 돈이면 웹 계좌 입금 확정과 같은 원장(paid + 결제 행 + 확정 예약)을 남긴다', async () => {
    const r = await createManualBooking(make(), NOW);
    expect(r).toMatchObject({ ok: true, status: 'paid' });
    if (!r.ok) return;
    expect(await one(`SELECT status FROM orders WHERE id = '${r.orderId}'`)).toEqual({ status: 'paid' });
    expect(await one(`SELECT status FROM bookings WHERE order_id = '${r.orderId}'`)).toEqual({ status: 'confirmed' });
    expect(await one(`SELECT payment_key, method FROM payments WHERE order_id = '${r.orderId}'`)).toEqual({
      payment_key: `bank-deposit:${r.orderNo}`, method: '계좌 입금',
    });
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
  });

  it('현금이면 결제 행 키는 그대로 두고 표시 이름만 바꾼다', async () => {
    const r = await createManualBooking(make({ method: '현금' }), NOW);
    if (!r.ok) throw new Error(r.message);
    expect(await one(`SELECT payment_key, method FROM payments WHERE order_id = '${r.orderId}'`)).toEqual({
      payment_key: `bank-deposit:${r.orderNo}`, method: '현금',
    });
  });

  it('협의가는 부가세 포함 총액으로 저장하고 공급가·부가세를 나눈다', async () => {
    const r = await createManualBooking(make({ totalAmount: 220000 }), NOW);
    if (!r.ok) throw new Error(r.message);
    expect(await one(`SELECT item_amount, vat_amount, total_amount FROM orders WHERE id = '${r.orderId}'`)).toEqual({
      item_amount: 200000, vat_amount: 20000, total_amount: 220000,
    });
  });

  it('아직 못 받았으면 입금 대기로 시간만 잡고, 같은 시간은 웹 예약도 못 잡는다', async () => {
    const r = await createManualBooking(make({ received: false }), NOW);
    expect(r).toMatchObject({ ok: true, status: 'awaiting_deposit' });
    expect(await one(`SELECT COUNT(*) AS n FROM payments`)).toEqual({ n: 0 });
    expect(sendBookingConfirmedEmails).not.toHaveBeenCalled();
    expect(
      await createBookingOrder(
        { productId: 'recording-pro', hours: 3, date: '2026-11-20', startHour: 14, customerName: 'x', customerPhone: '010', customerEmail: 'x@y.z', refundPolicyAgreed: true },
        NOW,
      ),
    ).toEqual({ ok: false, code: 'slot_taken' });
  });

  it('이미 예약된 시간에는 등록하지 않고, 실패한 시도가 주문을 남기지 않는 상태(failed)로 닫는다', async () => {
    await createManualBooking(make(), NOW);
    const second = await createManualBooking(make({ customerName: '박둘째' }), NOW);
    expect(second).toEqual({ ok: false, message: '그 시간대에는 이미 예약이 있거나 막혀 있어요.' });
    expect(await one(`SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'`)).toEqual({ n: 1 });
  });

  it('캘린더가 바쁘면 거절하고, 확인이 실패해도 거절한다', async () => {
    (calendarBlockedRooms as jest.Mock).mockResolvedValueOnce({ blocked: true, excludeRooms: [] });
    expect((await createManualBooking(make(), NOW)).ok).toBe(false);
    (calendarBlockedRooms as jest.Mock).mockRejectedValueOnce(new Error('gcal down'));
    expect((await createManualBooking(make(), NOW)).ok).toBe(false);
    expect(await one(`SELECT COUNT(*) AS n FROM orders`)).toEqual({ n: 0 });
  });

  it('지난 일정은 등록하되 고객 이메일을 플레이스홀더로 바꿔 확정 메일 대상에서 뺀다', async () => {
    const r = await createManualBooking(make({ date: '2026-10-10' }), NOW);
    if (!r.ok) throw new Error(r.message);
    expect(r.warnings.join(' ')).toContain('지난 일정');
    expect(await one(`SELECT customer_email FROM orders WHERE id = '${r.orderId}'`)).toEqual({ customer_email: MANUAL_PLACEHOLDER_EMAIL });
    expect(calendarBlockedRooms).not.toHaveBeenCalled();
  });

  it('믹싱 주문도 같은 방식으로 등록된다', async () => {
    const parsed = parseManualBookingInput(
      { kind: 'mixing', productId: 'mixing-level1', songCount: 2, vocalTuning: true, customerName: '이믹싱', customerPhone: '', customerEmail: '', received: true, method: '계좌 입금' },
      NOW,
    );
    if (!parsed.ok) throw new Error(parsed.message);
    const r = await createManualBooking(parsed.value, NOW);
    if (!r.ok) throw new Error(r.message);
    expect(await one(`SELECT status FROM work_orders WHERE order_id = '${r.orderId}'`)).toEqual({ status: 'received' });
    expect(await one(`SELECT status, customer_email FROM orders WHERE id = '${r.orderId}'`)).toEqual({ status: 'paid', customer_email: MANUAL_PLACEHOLDER_EMAIL });
  });
});
