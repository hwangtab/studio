/** @jest-environment node */

/**
 * createBookingOrder를 실제 SQLite(in-memory)에서 검증한다.
 *
 * 겹침 검사(overlap-check INSERT)와 자가 선점 해제(self-release UPDATE, 회귀:
 * BookingWizard의 "← 정보 수정"으로 되돌아가 같은 슬롯을 재제출하면 고객 자신의
 * 직전 pending이 겹침으로 잡혀 자기 자신에게 막히던 문제)는 SQL 문장 두 개가 순서대로
 * 맞물려야 드러나는 성질이라 모킹으로는 잘 안 보인다 — rate-limit.test.ts와 같은 방식으로
 * 실제 orders/bookings 테이블에 대고 돌린다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { bookings, orders, workOrders } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { createBookingOrder, createMixingOrder } from './service';
// eslint-disable-next-line import/first
import type { CreateBookingPayload, CreateMixingOrderPayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-01T00:00:00Z');

let client: Client;

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const text = readFileSync(path.join(MIGRATIONS, file), 'utf-8');
    for (const statement of text.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.execute(trimmed);
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM work_orders');
  await client.execute('DELETE FROM bookings');
  await client.execute('DELETE FROM orders');
});

afterAll(() => {
  client.close();
});

const payloadFor = (over: Partial<CreateBookingPayload> = {}): CreateBookingPayload => ({
  productId: 'recording-pro',
  hours: 3,
  date: '2026-09-10',
  startHour: 14,
  customerName: '김보컬',
  customerPhone: '010-1234-5678',
  customerEmail: 'singer@example.com',
  refundPolicyAgreed: true,
  ...over,
});

describe('createBookingOrder — 자가 선점 해제', () => {
  it('같은 고객(email+phone)이 같은 슬롯을 재제출하면 성공하고, 직전 주문은 expired·직전 예약은 cancelled로 남는다', async () => {
    const first = await createBookingOrder(payloadFor(), NOW);
    expect(first.ok).toBe(true);

    // "← 정보 수정" 후 같은 슬롯 그대로 재제출 — 자기 자신의 pending에 막히면 안 된다.
    const second = await createBookingOrder(payloadFor(), NOW);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('unreachable — 위 expect가 이미 걸렀다');

    expect(second.orderNo).not.toBe(first.orderNo);

    const firstOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, first.orderNo) });
    expect(firstOrder?.status).toBe('expired');

    const firstBooking = await mockDb.query.bookings.findFirst({ where: eq(bookings.id, first.bookingId) });
    expect(firstBooking?.status).toBe('cancelled');

    const secondOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, second.orderNo) });
    expect(secondOrder?.status).toBe('pending');

    const secondBooking = await mockDb.query.bookings.findFirst({ where: eq(bookings.id, second.bookingId) });
    expect(secondBooking?.status).toBe('pending');
  });

  it('다른 고객이 그 사이 아직 살아있는 pending 슬롯을 제출하면 여전히 slot_taken으로 거부된다', async () => {
    const a = await createBookingOrder(payloadFor(), NOW);
    expect(a.ok).toBe(true);

    const b = await createBookingOrder(
      payloadFor({ customerName: '박기타', customerPhone: '010-9999-8888', customerEmail: 'other@example.com' }),
      NOW,
    );
    expect(b).toEqual({ ok: false, code: 'slot_taken' });
  });
});

/**
 * C-2 회귀: 자가 선점 해제가 (email, phone)만 보고 **모든** 타입의 pending 주문을 죽이던 문제.
 * 같은 고객이 다른 탭에서 믹싱 결제창을 띄워 둔 채 세션 예약을 새로 만들면, 그 믹싱 주문이
 * expired가 되어 결제가 통째로 무산됐다(그 반대도 마찬가지).
 */
describe('createBookingOrder / createMixingOrder — 자가 선점 해제의 type 격리', () => {
  const mixingPayloadFor = (over: Partial<CreateMixingOrderPayload> = {}): CreateMixingOrderPayload => ({
    productId: 'mixing-level1',
    songCount: 1,
    vocalTuning: false,
    customerName: '김보컬',
    customerPhone: '010-1234-5678',
    customerEmail: 'singer@example.com',
    refundPolicyAgreed: true,
    ...over,
  });

  it('세션 예약 생성이 같은 고객의 믹싱 pending 주문을 만료시키지 않는다', async () => {
    const mixing = await createMixingOrder(mixingPayloadFor(), NOW);
    const session = await createBookingOrder(payloadFor(), NOW);
    expect(session.ok).toBe(true);

    const mixingOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, mixing.orderNo) });
    expect(mixingOrder?.status).toBe('pending');
    const workOrder = await mockDb.query.workOrders.findFirst({ where: eq(workOrders.id, mixing.workOrderId) });
    expect(workOrder?.status).toBe('pending');
  });

  it('믹싱 주문 생성이 같은 고객의 세션 pending 주문·예약을 만료시키지 않는다', async () => {
    const session = await createBookingOrder(payloadFor(), NOW);
    expect(session.ok).toBe(true);
    if (!session.ok) throw new Error('unreachable');

    await createMixingOrder(mixingPayloadFor(), NOW);

    const sessionOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, session.orderNo) });
    expect(sessionOrder?.status).toBe('pending');
    const booking = await mockDb.query.bookings.findFirst({ where: eq(bookings.id, session.bookingId) });
    expect(booking?.status).toBe('pending');
  });

  it('같은 타입(믹싱) 재제출은 종전대로 직전 pending을 해제한다', async () => {
    const first = await createMixingOrder(mixingPayloadFor(), NOW);
    const second = await createMixingOrder(mixingPayloadFor(), NOW);
    expect(second.orderNo).not.toBe(first.orderNo);

    const firstOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, first.orderNo) });
    expect(firstOrder?.status).toBe('expired');
    const firstWorkOrder = await mockDb.query.workOrders.findFirst({ where: eq(workOrders.id, first.workOrderId) });
    expect(firstWorkOrder?.status).toBe('cancelled');

    const secondOrder = await mockDb.query.orders.findFirst({ where: eq(orders.orderNo, second.orderNo) });
    expect(secondOrder?.status).toBe('pending');
  });
});
