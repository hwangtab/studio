/** @jest-environment node */
/** 캘린더 일정 → 사이트 예약 자동 등록 — 실 DB(in-memory libSQL)로: 입금 대기로 만들고 원본을 지우며, 대상이 아닌 일정은 건드리지 않는다. */
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
  createBookingEvent: jest.fn().mockResolvedValue('evt-hold'),
  deleteBookingEvent: jest.fn().mockResolvedValue(undefined),
  getCalendarEvent: jest.fn(),
  renameBookingEvent: jest.fn().mockResolvedValue(undefined),
  isCalendarActive: jest.fn().mockReturnValue(true),
}));
const mockLoad = jest.fn();
jest.mock('../ops/calendarImport', () => ({ loadUnlinkedCalendarEvents: (...a: unknown[]) => mockLoad(...a) }));

/* eslint-disable import/first */
import { calendarBlockedRooms } from './calendarGuard';
import { createBookingEvent, deleteBookingEvent, getCalendarEvent, renameBookingEvent } from './gcal';
import { AUTO_IMPORT_NOTE_MARK, autoImportCalendarEvents, guessNameFromTitle, planAutoImport } from './calendarAutoImport';
import { updateAwaitingOrderDetails } from './manualEdit';
/* eslint-enable import/first */

let client: Client;
const NOW = new Date('2026-10-17T03:00:00Z'); // 12:00 KST
const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;
const ev = (id: string, title: string, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  id, summary: title, description: '', startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), allDay: false, adoptable: true, ...extra,
});

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(path.join(process.cwd(), 'drizzle/migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(process.cwd(), 'drizzle/migrations', file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => client.close());
beforeEach(async () => {
  for (const t of ['refunds', 'payments', 'work_orders', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  delete process.env.CALENDAR_AUTO_IMPORT;
  (calendarBlockedRooms as jest.Mock).mockResolvedValue({ blocked: false, excludeRooms: [] });
  (getCalendarEvent as jest.Mock).mockImplementation(async (id: string) => {
    const hit = (mockLoad.mock.results[0]?.value as Promise<{ events: Array<{ id: string; startAt: string; endAt: string }> }> | undefined);
    const events = hit ? (await hit).events : [];
    const e = events.find((x) => x.id === id);
    return { id, summary: '', description: '', start: new Date(e?.startAt ?? NOW), end: new Date(e?.endAt ?? NOW), allDay: false, transparent: false };
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('guessNameFromTitle', () => {
  it('꼬리의 서비스 말과 머리말을 걷어 낸다', () => {
    expect(guessNameFromTitle('조희정 녹음')).toBe('조희정');
    expect(guessNameFromTitle('[예약] 김철수 레코딩')).toBe('김철수');
    expect(guessNameFromTitle('노래교실 녹음')).toBe('노래교실');
    expect(guessNameFromTitle('녹음')).toBe('녹음');
  });
});

describe('planAutoImport', () => {
  const p = (s: string, e: string) => planAutoImport({ startAt: new Date(s).toISOString(), endAt: new Date(e).toISOString(), allDay: false }, NOW);
  it('시 단위 일정은 그대로, 30분 단위는 덮는 시 단위로 만들고 원본 시각을 남긴다', () => {
    expect(p('2026-10-20T14:00:00+09:00', '2026-10-20T17:00:00+09:00')).toEqual({ date: '2026-10-20', startHour: 14, hours: 3, originalRange: null });
    expect(p('2026-10-20T18:30:00+09:00', '2026-10-20T20:30:00+09:00')).toEqual({ date: '2026-10-20', startHour: 18, hours: 3, originalRange: '18:30~20:30' });
  });
  it('종일·자정 넘김·영업시간 밖·8시간 초과·이미 끝난 일정은 대상이 아니다', () => {
    expect(planAutoImport({ startAt: '2026-10-20T00:00:00+09:00', endAt: '2026-10-21T00:00:00+09:00', allDay: true }, NOW)).toBeNull();
    expect(p('2026-10-20T21:00:00+09:00', '2026-10-21T01:00:00+09:00')).toBeNull();
    expect(p('2026-10-20T08:00:00+09:00', '2026-10-20T10:00:00+09:00')).toBeNull();
    expect(p('2026-10-20T10:00:00+09:00', '2026-10-20T19:00:00+09:00')).toBeNull();
    expect(p('2026-10-17T09:00:00+09:00', '2026-10-17T11:00:00+09:00')).toBeNull();
  });
});

describe('autoImportCalendarEvents', () => {
  it('입금 대기 예약으로 만들고 원래 일정을 지운다(1시간 일정도, 매출은 아직 없다)', async () => {
    mockLoad.mockResolvedValue({ error: null, events: [ev('e1', '조희정 녹음', '2026-10-20T14:00:00+09:00', '2026-10-20T15:00:00+09:00')] });
    const r = await autoImportCalendarEvents(NOW);
    expect(r).toMatchObject({ imported: 1, failed: [] });
    const row = await one(`SELECT o.status AS ostatus, o.customer_name, o.customer_email, b.status, b.duration_hours, b.customer_note FROM bookings b JOIN orders o ON o.id = b.order_id`);
    expect(row).toMatchObject({ ostatus: 'awaiting_deposit', customer_name: '조희정', customer_email: 'manual@studionol.co.kr', status: 'pending', duration_hours: 1 });
    expect(String(row?.customer_note)).toContain(AUTO_IMPORT_NOTE_MARK);
    expect(await one(`SELECT COUNT(*) AS n FROM payments`)).toEqual({ n: 0 });
    expect(deleteBookingEvent).toHaveBeenCalledWith('e1', 'studio');
  });

  it('대상이 아닌 일정은 건드리지 않고, 겹치는 두 번째 일정은 주문을 만들지 않은 채 건너뛴다', async () => {
    mockLoad.mockResolvedValue({
      error: null,
      events: [
        { ...ev('allday', '휴무', '2026-10-21T00:00:00+09:00', '2026-10-22T00:00:00+09:00'), allDay: true, adoptable: false },
        ev('a', '가 녹음', '2026-10-22T14:00:00+09:00', '2026-10-22T16:00:00+09:00'),
        ev('b', '나 녹음', '2026-10-22T15:00:00+09:00', '2026-10-22T17:00:00+09:00'),
      ],
    });
    const r = await autoImportCalendarEvents(NOW);
    expect(r).toMatchObject({ imported: 1, skipped: 2, failed: [] });
    expect(deleteBookingEvent).not.toHaveBeenCalledWith('allday', 'studio');
    expect(deleteBookingEvent).not.toHaveBeenCalledWith('b', 'studio');
    // 감사: 충돌 일정을 시도하면 failed 주문이 매번 쌓였다 — 이제 주문 자체를 만들지 않는다.
    expect(await one(`SELECT COUNT(*) AS n FROM orders WHERE status = 'failed'`)).toEqual({ n: 0 });
  });

  it('DB에서 막힌 일정이 열 건이어도 뒤의 정상 일정은 등록되고, 몇 번을 돌려도 실패 주문이 쌓이지 않는다', async () => {
    const S = Math.floor(new Date('2026-10-24T10:00:00+09:00').getTime() / 1000);
    await client.execute({ sql: `INSERT INTO availability_blocks (id, room_number, start_at, end_at) VALUES ('blk', NULL, ?, ?)`, args: [S, S + 12 * 3600] });
    const blocked = Array.from({ length: 10 }, (_, i) => ev(`x${i}`, `막힌${i}`, `2026-10-24T${String(10 + i).padStart(2, '0')}:00:00+09:00`, `2026-10-24T${String(11 + i).padStart(2, '0')}:00:00+09:00`));
    mockLoad.mockResolvedValue({ error: null, events: [...blocked, ev('ok', '정상 녹음', '2026-10-25T14:00:00+09:00', '2026-10-25T16:00:00+09:00')] });
    expect((await autoImportCalendarEvents(NOW)).imported).toBe(1);
    mockLoad.mockResolvedValue({ error: null, events: blocked });
    await autoImportCalendarEvents(NOW);
    await autoImportCalendarEvents(NOW);
    expect(await one(`SELECT COUNT(*) AS n FROM orders WHERE status = 'failed'`)).toEqual({ n: 0 });
  });

  it('새 [입금 대기] 일정을 못 올리면 원래 일정을 지우지 않는다', async () => {
    (createBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('google down'));
    mockLoad.mockResolvedValue({ error: null, events: [ev('keep', '보존 녹음', '2026-10-26T14:00:00+09:00', '2026-10-26T15:00:00+09:00')] });
    const r = await autoImportCalendarEvents(NOW);
    expect(r.imported).toBe(1);
    expect(deleteBookingEvent).not.toHaveBeenCalledWith('keep', 'studio');
  });

  it('일정이 그새 옮겨졌으면(읽은 시간과 다르면) 등록하지 않는다', async () => {
    (getCalendarEvent as jest.Mock).mockResolvedValue({ id: 'm', summary: '', description: '', start: new Date('2026-10-27T10:00:00+09:00'), end: new Date('2026-10-27T11:00:00+09:00'), allDay: false, transparent: false });
    mockLoad.mockResolvedValue({ error: null, events: [ev('moved', '옮겨진 녹음', '2026-10-27T14:00:00+09:00', '2026-10-27T15:00:00+09:00')] });
    const r = await autoImportCalendarEvents(NOW);
    expect(r).toMatchObject({ imported: 0 });
    expect(r.failed).toHaveLength(1);
    expect(await one(`SELECT COUNT(*) AS n FROM orders`)).toEqual({ n: 0 });
  });

  it('일정 설명(운영자 메모)은 예약 메모에 보존된다', async () => {
    mockLoad.mockResolvedValue({ error: null, events: [{ ...ev('desc', '메모 녹음', '2026-10-28T14:00:00+09:00', '2026-10-28T15:00:00+09:00'), description: '보컬 2곡\n연락: 지인 소개' }] });
    await autoImportCalendarEvents(NOW);
    expect(String((await one(`SELECT customer_note FROM bookings`))?.customer_note)).toContain('보컬 2곡 연락: 지인 소개');
  });

  it('env로 끌 수 있고, 캘린더를 못 읽으면 아무것도 하지 않는다', async () => {
    process.env.CALENDAR_AUTO_IMPORT = 'off';
    expect(await autoImportCalendarEvents(NOW)).toMatchObject({ disabled: true, imported: 0 });
    delete process.env.CALENDAR_AUTO_IMPORT;
    mockLoad.mockResolvedValue({ error: '캘린더를 읽지 못했어요.', events: [] });
    expect(await autoImportCalendarEvents(NOW)).toMatchObject({ imported: 0 });
    expect(await one(`SELECT COUNT(*) AS n FROM orders`)).toEqual({ n: 0 });
  });
});

describe('updateAwaitingOrderDetails', () => {
  const seed = async () => {
    mockLoad.mockResolvedValue({ error: null, events: [ev('e9', '조희정 녹음', '2026-10-23T14:00:00+09:00', '2026-10-23T17:00:00+09:00')] });
    await autoImportCalendarEvents(NOW);
    return (await one(`SELECT id FROM orders`))?.id as string;
  };

  it('고객 정보·금액을 채우고 캘린더 제목도 바꾼다', async () => {
    const id = await seed();
    await client.execute(`UPDATE bookings SET gcal_event_id = 'evt-hold'`);
    const r = await updateAwaitingOrderDetails(id, { customerName: '조희정', customerPhone: '010-1234-5678', customerEmail: 'a@b.co', totalAmount: 330000 });
    expect(r).toMatchObject({ ok: true, warnings: [] });
    expect(await one(`SELECT customer_phone, customer_email, item_amount, vat_amount, total_amount FROM orders WHERE id = '${id}'`)).toEqual({
      customer_phone: '010-1234-5678', customer_email: 'a@b.co', item_amount: 300000, vat_amount: 30000, total_amount: 330000,
    });
    // 감사: 연락처·이메일만 바뀌어도 일정 설명의 옛 플레이스홀더 연락처를 고쳐야 한다.
    expect(renameBookingEvent).toHaveBeenCalledWith('evt-hold', 'studio', null, expect.any(String), expect.stringContaining('010-1234-5678'));
    (renameBookingEvent as jest.Mock).mockClear();
    await updateAwaitingOrderDetails(id, { customerName: '조희정님', customerPhone: '', customerEmail: '', totalAmount: 330000 });
    expect(renameBookingEvent).toHaveBeenCalledWith('evt-hold', 'studio', null, expect.stringContaining('조희정님'));
  });

  it('입금 확인된 주문·잘못된 값은 거절한다', async () => {
    const id = await seed();
    expect(await updateAwaitingOrderDetails(id, { customerName: '', customerPhone: '', customerEmail: '', totalAmount: 1 })).toMatchObject({ ok: false });
    expect(await updateAwaitingOrderDetails(id, { customerName: '가', customerPhone: '123', customerEmail: '', totalAmount: 1 })).toMatchObject({ ok: false });
    expect(await updateAwaitingOrderDetails(id, { customerName: '가', customerPhone: '', customerEmail: 'x', totalAmount: 1 })).toMatchObject({ ok: false });
    // 감사: 빈 칸·null이 0원으로 읽혀 0원 결제가 기록될 수 있었다.
    for (const bad of ['', null, 0, 25]) {
      expect(await updateAwaitingOrderDetails(id, { customerName: '가', customerPhone: '', customerEmail: '', totalAmount: bad })).toMatchObject({ ok: false });
    }
    await client.execute(`UPDATE orders SET status = 'paid'`);
    expect(await updateAwaitingOrderDetails(id, { customerName: '가', customerPhone: '', customerEmail: '', totalAmount: 1000 })).toMatchObject({ ok: false });
  });
});
