/** @jest-environment node */
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';

let testDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../booking/gcal', () => ({ createBookingEvent: jest.fn(), deleteBookingEvent: jest.fn() }));

/* eslint-disable import/first */
import { removePaymentLinkCalendarEvent, resyncPaymentLinkCalendarEvent, syncPaymentLinkCalendarEvent } from './linkCalendar';
import { loadPaymentLinkOrderInfo } from './paymentLinkOrders';
import { createBookingEvent, deleteBookingEvent } from '../booking/gcal';
/* eslint-enable import/first */

const SESSION = Math.floor(new Date('2026-10-17T02:00:00Z').getTime() / 1000);

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  // clearAllMocks는 앞 테스트의 mockRejectedValue를 지우지 않는다 — 매번 초기화한다.
  (createBookingEvent as jest.Mock).mockReset().mockResolvedValue('evt-1');
  (deleteBookingEvent as jest.Mock).mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const seed = async (status = 'paid', session: { at: number | null; hours: number | null } = { at: SESSION, hours: 3 }) => {
  await testDb.run(sql`INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
    VALUES ('o1', 'SNB-1', 'deposit', ${status}, '김준호', '010-5606-4595', 'k@example.com', 't', 227273, 22727, 250000)`);
  await testDb.run(sql`INSERT INTO payment_link_orders (order_no, slug, item_name, session_at, session_hours)
    VALUES ('SNB-1', ${'a'.repeat(24)}, '보컬 녹음 3시간 (10/17 11:00)', ${session.at}, ${session.hours})`);
};
const info = async () => (await loadPaymentLinkOrderInfo(['SNB-1'])).get('SNB-1')!;

it('결제된 링크 주문은 녹음실 캘린더에 이용 시각·시간으로 올라가고 이벤트 id가 남는다', async () => {
  await seed();
  expect(await syncPaymentLinkCalendarEvent('SNB-1')).toBe('evt-1');
  const call = (createBookingEvent as jest.Mock).mock.calls[0][0];
  expect(call.calendar).toBe('studio');
  expect(call.summary).toBe('[예약] 보컬 녹음 3시간 (10/17 11:00) — 김준호');
  expect(call.start.getTime()).toBe(SESSION * 1000);
  expect(call.end.getTime()).toBe((SESSION + 3 * 3600) * 1000);
  expect(call.description).toContain('SNB-1');
  expect(await info()).toMatchObject({ gcalEventId: 'evt-1', gcalError: null });
});

it('이미 올렸으면 다시 만들지 않는다(멱등)', async () => {
  await seed();
  await syncPaymentLinkCalendarEvent('SNB-1');
  await syncPaymentLinkCalendarEvent('SNB-1');
  expect(createBookingEvent).toHaveBeenCalledTimes(1);
});

it.each([
  ['결제 전(pending)', 'pending', { at: SESSION, hours: 3 }],
  ['입금 대기', 'awaiting_deposit', { at: SESSION, hours: 3 }],
  ['일시 없는 링크', 'paid', { at: null, hours: null }],
])('올리지 않는다: %s', async (_n, status, session) => {
  await seed(status, session);
  expect(await syncPaymentLinkCalendarEvent('SNB-1')).toBeNull();
  expect(createBookingEvent).not.toHaveBeenCalled();
});

it('등록이 실패해도 던지지 않고 사유를 남긴다 — 결제는 그대로', async () => {
  await seed();
  (createBookingEvent as jest.Mock).mockRejectedValue(new Error('캘린더 이벤트 생성 실패: 403'));
  expect(await syncPaymentLinkCalendarEvent('SNB-1')).toBeNull();
  expect(await info()).toMatchObject({ gcalEventId: null, gcalError: expect.stringContaining('403') });
});

it('환불되면 일정을 지우고 id를 비운다 — 올린 적 없으면 아무 일도 없다', async () => {
  await seed();
  await removePaymentLinkCalendarEvent('SNB-1');
  expect(deleteBookingEvent).not.toHaveBeenCalled();
  await syncPaymentLinkCalendarEvent('SNB-1');
  await removePaymentLinkCalendarEvent('SNB-1');
  expect(deleteBookingEvent).toHaveBeenCalledWith('evt-1', 'studio');
  expect(await info()).toMatchObject({ gcalEventId: null, gcalError: null });
});

it('삭제가 실패하면 id를 남기고 사유를 적는다(관리자가 재시도)', async () => {
  await seed();
  await syncPaymentLinkCalendarEvent('SNB-1');
  (deleteBookingEvent as jest.Mock).mockRejectedValue(new Error('캘린더 이벤트 삭제 실패: 500'));
  await removePaymentLinkCalendarEvent('SNB-1');
  expect(await info()).toMatchObject({ gcalEventId: 'evt-1', gcalError: expect.stringContaining('delete') });
});

it('삭제 결과를 true/false로 돌려준다(실패를 성공으로 말하지 않게)', async () => {
  await seed();
  await syncPaymentLinkCalendarEvent('SNB-1');
  (deleteBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('503'));
  expect(await removePaymentLinkCalendarEvent('SNB-1')).toBe(false);
  expect(await removePaymentLinkCalendarEvent('SNB-1')).toBe(true);
});

it('다시 등록 — 새 일정 만들기가 실패해도 옛 일정은 남는다(만들고 나서 지운다, 감사 2026-10-19)', async () => {
  await seed();
  await syncPaymentLinkCalendarEvent('SNB-1');
  (createBookingEvent as jest.Mock).mockRejectedValue(new Error('quota'));
  expect(await resyncPaymentLinkCalendarEvent('SNB-1')).toMatchObject({ ok: false });
  expect(deleteBookingEvent).not.toHaveBeenCalled();
  expect(await info()).toMatchObject({ gcalEventId: 'evt-1' });
});

it('다시 등록 — 옛 일정을 지우고 새로 올린다. 일시 없는 링크·미결제는 안내', async () => {
  await seed();
  await syncPaymentLinkCalendarEvent('SNB-1');
  (createBookingEvent as jest.Mock).mockResolvedValue('evt-2');
  expect(await resyncPaymentLinkCalendarEvent('SNB-1')).toEqual({ ok: true, eventId: 'evt-2' });
  expect(deleteBookingEvent).toHaveBeenCalledWith('evt-1', 'studio');
  expect(await info()).toMatchObject({ gcalEventId: 'evt-2' });
  await testDb.run(sql`UPDATE payment_link_orders SET session_at = NULL, session_hours = NULL, gcal_event_id = NULL`);
  expect(await resyncPaymentLinkCalendarEvent('SNB-1')).toMatchObject({ ok: false, message: expect.stringContaining('이용 일시') });
});
