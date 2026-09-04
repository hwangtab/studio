/** @jest-environment node */

/**
 * "같은 슬롯에 confirmed 예약 2건"이 실제 SQLite에서 만들어지지 않는지 검증한다 (H-2).
 *
 * 이 결함은 문장 세 개가 시간차로 맞물려야 드러난다 — createBookingOrder의 겹침 검사가
 * 900초 지난 pending을 무시하고, expireStaleOrders는 슬롯 조회·관리자 목록에서만 lazy
 * 호출되며, confirm은 order.status만 보고 'pending'이면 통과시켰다. 모킹으로는 이 맞물림이
 * 보이지 않으므로 service.integration.test.ts와 같은 방식으로 실제 테이블에 대고 돌린다.
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ confirmPayment: jest.fn(), fetchPayment: jest.fn() }));
jest.mock('./gcal', () => ({ createBookingEvent: jest.fn().mockResolvedValue('evt1') }));
jest.mock('./email', () => ({ sendBookingConfirmedEmails: jest.fn().mockResolvedValue(null) }));

// eslint-disable-next-line import/first
import { confirmBookingPayment } from './confirm';
// eslint-disable-next-line import/first
import { createBookingOrder, PENDING_HOLD_SECONDS } from './service';
// eslint-disable-next-line import/first
import { confirmPayment } from './toss';
// eslint-disable-next-line import/first
import type { CreateBookingPayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-01T00:00:00Z');

let client: Client;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

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
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM bookings');
  await client.execute('DELETE FROM orders');
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  jest.clearAllMocks();
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

/** 결제창을 방치한 상태를 만든다 — 선점 유지 시간을 넘겨 주문·예약 생성 시각을 뒤로 민다. */
const backdate = async (orderNo: string, seconds: number): Promise<void> => {
  await client.execute({
    sql: `UPDATE bookings SET created_at = created_at - ?
          WHERE order_id IN (SELECT id FROM orders WHERE order_no = ?)`,
    args: [seconds, orderNo],
  });
  await client.execute({
    sql: 'UPDATE orders SET created_at = created_at - ? WHERE order_no = ?',
    args: [seconds, orderNo],
  });
};

const confirmedBookingCount = async (): Promise<number> => {
  const rows = await client.execute("SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed'");
  return Number(rows.rows[0].n);
};

describe('confirmBookingPayment — 선점 만료 주문의 확정 (H-2)', () => {
  it('결제창을 방치한 A가 뒤늦게 돌아와도 B가 이미 확정한 슬롯을 다시 확정하지 못한다', async () => {
    // ① A가 주문을 만들고 결제창을 방치한다.
    const a = await createBookingOrder(payloadFor(), NOW);
    if (!a.ok) throw new Error('A 주문 생성 실패');
    await backdate(a.orderNo, PENDING_HOLD_SECONDS + 1);

    // ② 선점이 풀렸으므로 B가 같은 슬롯을 잡는다 — 겹침 검사는 900초 지난 pending을 무시한다.
    const b = await createBookingOrder(
      payloadFor({ customerName: '박기타', customerPhone: '010-9999-8888', customerEmail: 'other@example.com' }),
      NOW,
    );
    expect(b.ok).toBe(true);
    if (!b.ok) throw new Error('B 주문 생성 실패');

    // ③ B가 결제를 마친다.
    (confirmPayment as jest.Mock).mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk-b', orderId: b.orderNo, status: 'DONE', totalAmount: b.totalAmount },
    });
    const bConfirm = await confirmBookingPayment({ orderNo: b.orderNo, paymentKey: 'pk-b', amount: b.totalAmount });
    expect(bConfirm).toEqual({ ok: true, orderNo: b.orderNo });
    expect(await confirmedBookingCount()).toBe(1);

    // ④ A가 결제창으로 돌아와 결제를 완료한다. A의 order는 아직 'pending'이라
    //    (expireStaleOrders는 lazy 호출) 상태 검사만으로는 걸러지지 않는다.
    const aConfirm = await confirmBookingPayment({ orderNo: a.orderNo, paymentKey: 'pk-a', amount: a.totalAmount });
    expect(aConfirm).toMatchObject({ ok: false, code: 'invalid_state' });
    // 토스 승인 자체를 부르지 않아야 한다 — 미승인 결제는 과금 없이 만료된다.
    expect(confirmPayment).toHaveBeenCalledTimes(1); // B의 승인 1회뿐
    expect(await confirmedBookingCount()).toBe(1); // 이중 예약 없음
  });

  it('선점 시간 안에 돌아온 A는 평소대로 확정된다 (정상 결제를 막지 않는다)', async () => {
    const a = await createBookingOrder(payloadFor(), NOW);
    if (!a.ok) throw new Error('A 주문 생성 실패');
    await backdate(a.orderNo, PENDING_HOLD_SECONDS - 60);

    (confirmPayment as jest.Mock).mockResolvedValueOnce({
      ok: true,
      payment: { paymentKey: 'pk-a', orderId: a.orderNo, status: 'DONE', totalAmount: a.totalAmount },
    });
    const result = await confirmBookingPayment({ orderNo: a.orderNo, paymentKey: 'pk-a', amount: a.totalAmount });
    expect(result).toEqual({ ok: true, orderNo: a.orderNo });
    expect(await confirmedBookingCount()).toBe(1);
  });
});
