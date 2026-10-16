/** @jest-environment node */
/** 예약 일정 변경을 실 DB(in-memory libSQL)로 본다 — 겹침·블록 거절, 캘린더 충돌 거절, 캘린더 PATCH 실패 시 DB는 유지. */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./calendarGuard', () => ({ ...jest.requireActual('./calendarGuard'), hasOccupancyCalendarConflict: jest.fn() }));
jest.mock('./gcal', () => ({
  ...jest.requireActual('./gcal'),
  isCalendarActive: jest.fn().mockReturnValue(true),
  rescheduleBookingEvent: jest.fn().mockResolvedValue(undefined),
}));

/* eslint-disable import/first */
import { hasOccupancyCalendarConflict } from './calendarGuard';
import { rescheduleBookingEvent } from './gcal';
import { rescheduleBooking } from './reschedule';
import { kstDateTime } from './kst';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const ep = (d: Date) => Math.floor(d.getTime() / 1000);
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

const seed = async (id: string, date: string, hour: number, status = 'confirmed') => {
  await client.execute(
    `INSERT INTO orders (id, order_no, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token, status)
     VALUES ('o-${id}', 'SNB-${id}', 'session', '고객', '010-0000-0000', 'a@b.c', 100, 10, 110, 't-${id}', 'paid')`,
  );
  await client.execute({
    sql: `INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status, gcal_event_id)
          VALUES (?, ?, 'recording-pro', 'recording', ?, ?, 3, ?, ?)`,
    args: [`b-${id}`, `o-${id}`, ep(kstDateTime(date, hour)), ep(kstDateTime(date, hour + 3)), status, `evt-${id}`],
  });
};

beforeEach(async () => {
  for (const t of ['availability_blocks', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  (hasOccupancyCalendarConflict as jest.Mock).mockResolvedValue(false);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('rescheduleBooking', () => {
  it('날짜·시작을 옮기고 캘린더 일정도 옮긴다(길이 유지)', async () => {
    await seed('a', '2026-11-20', 11);
    const r = await rescheduleBooking({ orderId: 'o-a', date: '2026-11-21', startHour: 14 });
    expect(r.ok).toBe(true);
    const row = await one(`SELECT start_at, end_at FROM bookings WHERE id='b-a'`);
    expect(row?.start_at).toBe(ep(kstDateTime('2026-11-21', 14)));
    expect(row?.end_at).toBe(ep(kstDateTime('2026-11-21', 17)));
    expect(rescheduleBookingEvent).toHaveBeenCalledWith('evt-a', 'studio', null, kstDateTime('2026-11-21', 14), kstDateTime('2026-11-21', 17));
    expect(hasOccupancyCalendarConflict).toHaveBeenCalledWith(null, expect.any(Date), expect.any(Date), 'evt-a');
  });

  it('다른 예약과 겹치면 거절하고 그대로 둔다(자기 자신과는 겹쳐도 된다)', async () => {
    await seed('a', '2026-11-20', 11);
    await seed('b', '2026-11-21', 14);
    const clash = await rescheduleBooking({ orderId: 'o-a', date: '2026-11-21', startHour: 15 });
    expect(clash).toMatchObject({ ok: false, code: 'slot_taken' });
    expect((await one(`SELECT start_at FROM bookings WHERE id='b-a'`))?.start_at).toBe(ep(kstDateTime('2026-11-20', 11)));
    const self = await rescheduleBooking({ orderId: 'o-a', date: '2026-11-20', startHour: 12 });
    expect(self.ok).toBe(true);
  });

  it('예약 불가 블록과 겹치면 거절한다', async () => {
    await seed('a', '2026-11-20', 11);
    await client.execute({
      sql: `INSERT INTO availability_blocks (id, start_at, end_at, room_number) VALUES ('blk', ?, ?, NULL)`,
      args: [ep(kstDateTime('2026-11-22', 10)), ep(kstDateTime('2026-11-22', 20))],
    });
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-11-22', startHour: 12 })).toMatchObject({ ok: false, code: 'slot_taken' });
  });

  it('캘린더에 다른 일정이 있거나 조회가 실패하면 거절한다', async () => {
    await seed('a', '2026-11-20', 11);
    (hasOccupancyCalendarConflict as jest.Mock).mockResolvedValueOnce(true);
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-11-23', startHour: 12 })).toMatchObject({ ok: false, code: 'calendar_busy' });
    (hasOccupancyCalendarConflict as jest.Mock).mockRejectedValueOnce(new Error('down'));
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-11-23', startHour: 12 })).toMatchObject({ ok: false, code: 'calendar_unavailable' });
    expect((await one(`SELECT start_at FROM bookings WHERE id='b-a'`))?.start_at).toBe(ep(kstDateTime('2026-11-20', 11)));
  });

  it('캘린더 PATCH가 실패해도 DB는 옮겨 두고 gcal_error·경고를 남긴다', async () => {
    await seed('a', '2026-11-20', 11);
    (rescheduleBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const r = await rescheduleBooking({ orderId: 'o-a', date: '2026-11-24', startHour: 12 });
    expect(r.ok && r.warnings.length).toBe(1);
    const row = await one(`SELECT start_at, gcal_error FROM bookings WHERE id='b-a'`);
    expect(row?.start_at).toBe(ep(kstDateTime('2026-11-24', 12)));
    expect(String(row?.gcal_error)).toContain('reschedule(');
  });

  it('입력·상태 검증: 영업시간 밖·같은 일정·취소된 예약', async () => {
    await seed('a', '2026-11-20', 11);
    await seed('c', '2026-11-25', 11, 'cancelled');
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-11-21', startHour: 23 })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-11-20', startHour: 11 })).toMatchObject({ ok: false, code: 'no_change' });
    expect(await rescheduleBooking({ orderId: 'o-c', date: '2026-11-26', startHour: 11 })).toMatchObject({ ok: false, code: 'invalid_state' });
    expect(await rescheduleBooking({ orderId: 'o-a', date: '2026-13-40', startHour: 11 })).toMatchObject({ ok: false, code: 'invalid_input' });
  });
});
