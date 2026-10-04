/** @jest-environment node */
/**
 * 연습실/녹음 예약·믹싱 **계좌 입금**을 실 DB(in-memory libSQL)로 본다(lib/payments/bankDeposit.ts).
 *
 * 지키는 것: ① 입금 대기가 시간대를 기한 없이 잡는다(같은 시간 이중 예약 불가), ② 토스 홀드 만료가 건드리지
 * 않는다, ③ 입금 확인이 한 번만 확정하고 결제 행을 남긴다, ④ 미입금 취소·입금 전 신청 취소가 시간대를 바로
 * 푼다, ⑤ 입금 뒤 셀프 취소는 토스를 부르지 않고 환불 계좌를 **암호화해** 받는다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./toss', () => ({ ...jest.requireActual('./toss'), cancelPayment: jest.fn() }));
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
  sendBookingCancelledEmails: jest.fn().mockResolvedValue(null),
  sendMixingOrderCancelledEmails: jest.fn().mockResolvedValue(null),
}));
jest.mock('../payments/bankDepositOrders', () => ({
  ...jest.requireActual('../payments/bankDepositOrders'),
  sendDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import { createBookingOrder, createMixingOrder, expireStaleOrders } from './service';
import { cancelAwaitingBookingDeposit, confirmBookingBankDeposit, deliverBookingDepositGuide, holdBookingOnCalendar, retryWaitingEventDelete } from './bankDeposit';
import { createBookingEvent, deleteBookingEvent, renameBookingEvent } from './gcal';
import { cancelBookingWithRefund } from './cancel';
import { cancelPayment } from './toss';
import { sendBookingCancelledEmails, sendBookingConfirmedEmails } from './email';
import { sendDepositGuideEmails } from '../payments/bankDepositOrders';
import { loadRefundAccount } from '../payments/refundAccount';
import { bankDepositPaymentKey } from '../payments/bankDeposit';
import { FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import type { CreateBookingPayload, CreateMixingOrderPayload } from './validation';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-09-01T00:00:00Z');
let client: Client;

const payload = (over: Partial<CreateBookingPayload> = {}): CreateBookingPayload => ({
  productId: 'recording-pro', hours: 3, date: '2026-12-10', startHour: 14,
  customerName: '김입금', customerPhone: '010-1234-5678', customerEmail: 'bank@example.com',
  refundPolicyAgreed: true, ...over,
});
const other = (over: Partial<CreateBookingPayload> = {}) =>
  payload({ customerName: '박카드', customerPhone: '010-9999-8888', customerEmail: 'card@example.com', ...over });

const one = async (q: string) => (await client.execute(q)).rows[0] as Record<string, unknown> | undefined;
const orderOf = async (orderNo: string) => one(`SELECT * FROM orders WHERE order_no = '${orderNo}'`);

beforeAll(async () => {
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 7).toString('base64');
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (s.trim()) await client.execute(s.trim());
    }
  }
});
afterAll(() => {
  delete process.env[FIELD_CRYPTO_KEY_ENV];
  client.close();
});
beforeEach(async () => {
  for (const t of ['refund_accounts', 'refunds', 'payments', 'work_orders', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const createBank = async (over: Partial<CreateBookingPayload> = {}) => {
  const r = await createBookingOrder(payload(over), NOW, { paymentMethod: 'bank_transfer' });
  if (!r.ok) throw new Error('setup failed');
  return r;
};

describe('예약 계좌 입금 — 시간대 점유', () => {
  it('계좌 입금 대기로 만들어지고, 같은 시간대는 다른 사람이 잡을 수 없다', async () => {
    const bank = await createBank();
    expect((await orderOf(bank.orderNo))?.status).toBe('awaiting_deposit');
    expect(await createBookingOrder(other(), NOW)).toEqual({ ok: false, code: 'slot_taken' });
    // 다른 사람의 계좌 입금 신청도 막힌다.
    expect(await createBookingOrder(other(), NOW, { paymentMethod: 'bank_transfer' })).toEqual({ ok: false, code: 'slot_taken' });
  });

  it('토스 홀드 만료(15분)가 지나도 대기 예약은 풀리지 않는다 — 자동 취소 없음', async () => {
    const bank = await createBank();
    // 하루 전에 만든 것처럼 — 토스 홀드라면 진작 만료됐을 나이다.
    await client.execute(`UPDATE bookings SET created_at = created_at - 86400`);
    await client.execute(`UPDATE orders SET created_at = created_at - 86400`);
    await expireStaleOrders(new Date());
    expect((await orderOf(bank.orderNo))?.status).toBe('awaiting_deposit');
    expect((await one(`SELECT status FROM bookings WHERE id = '${bank.bookingId}'`))?.status).toBe('pending');
    expect(await createBookingOrder(other(), NOW)).toEqual({ ok: false, code: 'slot_taken' });
  });

  it('같은 만료가 토스 결제 대기는 그대로 정리한다(대조군)', async () => {
    const toss = await createBookingOrder(payload(), NOW);
    if (!toss.ok) throw new Error('setup');
    await client.execute(`UPDATE bookings SET created_at = created_at - 86400`);
    await client.execute(`UPDATE orders SET created_at = created_at - 86400`);
    await expireStaleOrders(new Date());
    expect((await orderOf(toss.orderNo))?.status).toBe('expired');
  });
});

describe('예약 계좌 입금 — 입금 확인', () => {
  it('한 번만 확정하고, 결제 행을 남기고, 예약을 confirmed로·확정 메일·캘린더를 토스와 같은 후처리로 돈다', async () => {
    const bank = await createBank();
    const order = await orderOf(bank.orderNo);
    const r = await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW });
    expect(r.ok).toBe(true);
    const after = await orderOf(bank.orderNo);
    expect(after?.status).toBe('paid');
    expect(after?.notification_error).toBeNull(); // 후처리가 센티널을 선점하고 성공으로 비웠다
    expect((await one(`SELECT status, gcal_event_id FROM bookings WHERE id = '${bank.bookingId}'`))).toMatchObject({ status: 'confirmed', gcal_event_id: 'evt-confirmed' });
    expect((await one(`SELECT payment_key, method FROM payments WHERE order_id = '${String(order!.id)}'`))).toMatchObject({
      payment_key: bankDepositPaymentKey(bank.orderNo), method: '계좌 입금',
    });
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);

    const again = await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW });
    expect(again.ok).toBe(false);
    expect(sendBookingConfirmedEmails).toHaveBeenCalledTimes(1);
    expect(Number((await one(`SELECT COUNT(*) AS n FROM payments`))?.n)).toBe(1);
  });

  it('확정하면 [입금 대기] 일정의 제목만 [예약]으로 바꾼다 — 새로 만들거나 지우지 않는다', async () => {
    const bank = await createBank();
    (createBookingEvent as jest.Mock).mockResolvedValueOnce('evt-waiting');
    await holdBookingOnCalendar(bank.orderNo);
    expect((createBookingEvent as jest.Mock).mock.calls[0][0].summary).toMatch(/^\[입금 대기\]/);
    const order = await orderOf(bank.orderNo);
    await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW });
    expect(renameBookingEvent).toHaveBeenCalledWith('evt-waiting', 'studio', null, expect.stringMatching(/^\[예약\]/));
    expect(createBookingEvent).toHaveBeenCalledTimes(1);
    expect(deleteBookingEvent).not.toHaveBeenCalled();
    expect((await one(`SELECT gcal_event_id, gcal_error FROM bookings WHERE id = '${bank.bookingId}'`))).toMatchObject({ gcal_event_id: 'evt-waiting', gcal_error: null });
  });

  it('제목 변경이 실패하면 확정 예약의 캘린더 오류로 남긴다 — 재등록이 지우는 것은 그 대기 일정뿐이다', async () => {
    const bank = await createBank();
    (createBookingEvent as jest.Mock).mockResolvedValueOnce('evt-waiting');
    await holdBookingOnCalendar(bank.orderNo);
    (renameBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('500'));
    await confirmBookingBankDeposit({ orderId: String((await orderOf(bank.orderNo))!.id), now: NOW });
    const row = await one(`SELECT gcal_event_id, gcal_error FROM bookings WHERE id = '${bank.bookingId}'`);
    expect(row?.gcal_event_id).toBe('evt-waiting');
    expect(String(row?.gcal_error)).toMatch(/^rename: /);
    expect(createBookingEvent).toHaveBeenCalledTimes(1); // 중복 일정을 만들지 않았다
  });

  it('미입금 취소의 대기 일정 삭제가 실패하면 id를 남기고 waiting_delete로 표시 — 관리자 재시도로 지운다', async () => {
    const bank = await createBank();
    (createBookingEvent as jest.Mock).mockResolvedValueOnce('evt-waiting');
    await holdBookingOnCalendar(bank.orderNo);
    (deleteBookingEvent as jest.Mock).mockRejectedValueOnce(new Error('503'));
    const id = String((await orderOf(bank.orderNo))!.id);
    expect((await cancelAwaitingBookingDeposit({ orderId: id })).ok).toBe(true);
    let row = await one(`SELECT gcal_event_id, gcal_error FROM bookings WHERE id = '${bank.bookingId}'`);
    expect(row?.gcal_event_id).toBe('evt-waiting');
    expect(String(row?.gcal_error)).toMatch(/^waiting_delete: /);
    expect((await retryWaitingEventDelete(id)).ok).toBe(true);
    row = await one(`SELECT gcal_event_id, gcal_error FROM bookings WHERE id = '${bank.bookingId}'`);
    expect(row).toMatchObject({ gcal_event_id: null, gcal_error: null });
  });

  it('미입금 취소는 시간대를 바로 풀고, 그 뒤에는 입금 확인이 되지 않는다', async () => {
    const bank = await createBank();
    const order = await orderOf(bank.orderNo);
    expect((await cancelAwaitingBookingDeposit({ orderId: String(order!.id) })).ok).toBe(true);
    expect((await orderOf(bank.orderNo))?.status).toBe('deposit_cancelled');
    expect((await one(`SELECT status FROM bookings WHERE id = '${bank.bookingId}'`))?.status).toBe('cancelled');
    expect((await createBookingOrder(other(), NOW)).ok).toBe(true);
    expect((await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW })).ok).toBe(false);
    // 받은 돈이 없으니 메일이 없다.
    expect(sendBookingCancelledEmails).not.toHaveBeenCalled();
  });

  it('입금 안내는 입금 대기일 때만 보내고 결과를 notification_error에 남긴다', async () => {
    const bank = await createBank();
    (sendDepositGuideEmails as jest.Mock).mockResolvedValueOnce('customer:API_ERROR');
    expect(await deliverBookingDepositGuide(bank.orderNo)).toBe('customer:API_ERROR');
    expect((await orderOf(bank.orderNo))?.notification_error).toBe('customer:API_ERROR');
    const order = await orderOf(bank.orderNo);
    await cancelAwaitingBookingDeposit({ orderId: String(order!.id) });
    expect((await orderOf(bank.orderNo))?.notification_error).toBeNull();
    expect(await deliverBookingDepositGuide(bank.orderNo)).toBe('invalid_state');
  });
});

describe('예약 계좌 입금 — 입금 뒤 셀프 취소', () => {
  const ACCOUNT = { bankName: '국민은행', accountNumber: '123-456-7890123', accountHolder: '김입금' };
  const paidBank = async () => {
    const bank = await createBank();
    const order = await orderOf(bank.orderNo);
    await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW });
    return bank;
  };

  it('환불 계좌 없이는 취소하지 않는다(예약은 그대로)', async () => {
    const bank = await paidBank();
    const r = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW });
    expect(r.ok).toBe(false);
    expect((await one(`SELECT status FROM bookings WHERE id = '${bank.bookingId}'`))?.status).toBe('confirmed');
  });

  it('토스를 부르지 않고, 계좌번호는 암호화해 저장하고, 환불 기록·시간대 해제는 그 자리에서 끝낸다', async () => {
    const bank = await paidBank();
    const r = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'customer', reason: '고객 셀프 취소', now: NOW, refundAccount: ACCOUNT });
    expect(r).toEqual({ ok: true, refundAmount: bank.totalAmount, refundVia: 'bank_account' });
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await orderOf(bank.orderNo))?.status).toBe('refunded');
    expect((await one(`SELECT status FROM bookings WHERE id = '${bank.bookingId}'`))?.status).toBe('cancelled');
    const row = await one(`SELECT * FROM refund_accounts WHERE order_kind = 'session' AND order_no = '${bank.orderNo}'`);
    expect(row).toBeDefined();
    expect(String(row!.account_number_enc)).not.toContain('7890123');
    expect(row!.refunded_at).toBeNull(); // 송금 대기 — 관리자 "송금 완료"가 찍는다
    expect(await loadRefundAccount({ kind: 'session', orderNo: bank.orderNo })).toEqual(ACCOUNT);
    expect(sendBookingCancelledEmails).toHaveBeenCalledWith(expect.anything(), expect.anything(), bank.totalAmount, 'bank_account');
    expect((await createBookingOrder(other(), NOW)).ok).toBe(true);
  });

  it('관리자 환불은 토스를 부르지 않고 기록만 한다(운영자가 이미 송금했다)', async () => {
    const bank = await paidBank();
    const r = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'admin', reason: '관리자 송금', overrideAmount: 10000, now: NOW });
    expect(r.ok).toBe(true);
    expect(cancelPayment).not.toHaveBeenCalled();
    expect((await orderOf(bank.orderNo))?.status).toBe('partially_refunded');
  });
});

describe('예약 계좌 입금 — 리뷰 회귀', () => {
  const ACCOUNT = { bankName: '국민은행', accountNumber: '123-456-7890123', accountHolder: '김입금' };
  // 이용일(2026-12-10 14:00 KST) 하루 전 — 50% 티어라 고객 취소 뒤 잔액이 남는다.
  const DAY_BEFORE = new Date('2026-12-09T03:00:00Z');

  it('관리자 추가 환불이 고객의 미송금 환불 계좌를 "송금 완료"로 덮지 않는다', async () => {
    const bank = await createBank();
    await confirmBookingBankDeposit({ orderId: String((await orderOf(bank.orderNo))!.id), now: NOW });
    const c = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'customer', reason: '고객', now: DAY_BEFORE, refundAccount: ACCOUNT });
    expect(c).toMatchObject({ ok: true, refundAmount: Math.floor(bank.totalAmount / 2) });
    const a = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'admin', reason: '호의 잔액', overrideAmount: 1000, now: DAY_BEFORE });
    expect(a.ok).toBe(true);
    expect((await one(`SELECT refunded_at FROM refund_accounts WHERE order_no = '${bank.orderNo}'`))?.refunded_at).toBeNull();
  });

  it('환불 기록(batch)이 실패하면 예약·주문·환불 계좌를 전부 되돌린다 — 계좌 입금은 메워 줄 웹훅이 없다', async () => {
    const bank = await createBank();
    await confirmBookingBankDeposit({ orderId: String((await orderOf(bank.orderNo))!.id), now: NOW });
    const spy = jest.spyOn(mockDb, 'batch').mockRejectedValueOnce(new Error('db down'));
    const r = await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'customer', reason: '고객', now: NOW, refundAccount: ACCOUNT });
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, code: 'temporarily_unavailable' });
    expect((await one(`SELECT status FROM bookings WHERE id = '${bank.bookingId}'`))?.status).toBe('confirmed');
    expect((await orderOf(bank.orderNo))?.status).toBe('paid');
    expect(await one(`SELECT 1 AS x FROM refund_accounts WHERE order_no = '${bank.orderNo}'`)).toBeUndefined();
    expect(Number((await one(`SELECT COUNT(*) AS n FROM refunds`))?.n)).toBe(0);
    // 다시 누르면 된다.
    expect((await cancelBookingWithRefund({ orderNo: bank.orderNo, requestedBy: 'customer', reason: '고객', now: NOW, refundAccount: ACCOUNT })).ok).toBe(true);
  });
});

describe('믹싱 계좌 입금', () => {
  const mix: CreateMixingOrderPayload = {
    productId: 'mixing-level1', songCount: 1, vocalTuning: false,
    customerName: '최믹싱', customerPhone: '010-2222-3333', customerEmail: 'mix@example.com', refundPolicyAgreed: true,
  };

  it('24시간 토스 TTL이 지나도 만료하지 않고, 입금 확인이 work_order를 received로 연다', async () => {
    const r = await createMixingOrder(mix, NOW, { paymentMethod: 'bank_transfer' });
    expect((await orderOf(r.orderNo))?.status).toBe('awaiting_deposit');
    await client.execute(`UPDATE work_orders SET created_at = created_at - 3 * 86400`);
    await client.execute(`UPDATE orders SET created_at = created_at - 3 * 86400`);
    await expireStaleOrders(new Date());
    expect((await orderOf(r.orderNo))?.status).toBe('awaiting_deposit');
    expect((await one(`SELECT status FROM work_orders WHERE id = '${r.workOrderId}'`))?.status).toBe('pending');

    const order = await orderOf(r.orderNo);
    expect((await confirmBookingBankDeposit({ orderId: String(order!.id), now: NOW })).ok).toBe(true);
    expect((await one(`SELECT status FROM work_orders WHERE id = '${r.workOrderId}'`))?.status).toBe('received');
  });
});
