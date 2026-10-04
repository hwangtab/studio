/** @jest-environment node */
/**
 * 공연 티켓 **계좌 입금**을 실 DB로 본다(lib/payments/bankDeposit.ts).
 *
 * 지키는 것: ① 입금 대기 좌석은 기한 없이 잡혀 이중 판매가 없다, ② 토스 홀드 만료가 건드리지 않는다,
 * ③ 입금 확인이 한 번만 발권하고 결제 행·정리번호를 남긴다, ④ 미입금 취소가 좌석을 바로 푼다, ⑤ 입금 뒤
 * 환불은 토스를 부르지 않고 환불 계좌를 암호화해 받는다, ⑥ 회차 취소가 대기·계좌 결제 주문을 따로 다룬다.
 */
import { sql } from 'drizzle-orm';

import { createTestDb, type ShowsTestDb } from '../../tests/helpers/showsDb';
import { shows, showZones, showtimes, showTicketTypes } from '../../db/schema';

let mockDb: ShowsTestDb;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('./email', () => ({
  ...jest.requireActual('./email'),
  sendShowTicketEmail: jest.fn().mockResolvedValue({ sent: true }),
}));
jest.mock('../payments/bankDepositOrders', () => ({
  ...jest.requireActual('../payments/bankDepositOrders'),
  sendDepositGuideEmails: jest.fn().mockResolvedValue(null),
}));

/* eslint-disable import/first */
import { createShowOrder, expireStaleShowOrders } from './service';
import { cancelAwaitingShowDeposit, confirmShowBankDeposit, deliverShowDepositGuide } from './bankDeposit';
import { refundShowTickets } from './refund';
import { cancelShowtime } from './showtimeOps';
import { getShowOrderForManage } from './queries';
import { loadAdminShowDetail } from './adminQueries';
import { sendShowTicketEmail } from './email';
import { loadRefundAccount } from '../payments/refundAccount';
import { bankDepositPaymentKey } from '../payments/bankDeposit';
import { FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
/* eslint-enable import/first */

const ACCOUNT = { bankName: '신한은행', accountNumber: '110-222-333444', accountHolder: '이관객' };
const DAY = 86400;

const seed = async (db: ShowsTestDb, opts: { capacity?: number; startsInSec?: number } = {}) => {
  await db.insert(shows).values({
    id: 'show-1', slug: 's1', title: '공연', presenterName: 'p', performers: 'a',
    ageRating: '전체', runningMinutes: 60, venueName: '극장', venueAddress: 'addr', description: 'd', status: 'published',
  });
  await db.insert(showZones).values({ id: 'zone-1', showId: 'show-1', code: 'A', label: 'A', capacity: opts.capacity ?? 2 });
  const startsAt = Math.floor(Date.now() / 1000) + (opts.startsInSec ?? 20 * DAY);
  await db.insert(showtimes).values({ id: 'st-1', showId: 'show-1', startsAt, salesCloseAt: startsAt - 60 });
  await db.insert(showTicketTypes).values({ id: 'type-1', showId: 'show-1', zoneId: 'zone-1', name: '일반', price: 10000 });
};

const order = (over: { quantity?: number; paymentMethod?: 'toss' | 'bank_transfer' } = {}) =>
  createShowOrder(
    {
      showtimeId: 'st-1', ticketTypeId: 'type-1', quantity: over.quantity ?? 2,
      buyerName: '이관객', buyerContact: '010-1111-2222', buyerEmail: 'fan@example.com', paymentMethod: over.paymentMethod,
    },
    new Date(),
  );

const orderRow = (orderNo: string) => mockDb.query.orders.findFirst({ where: (o, { eq }) => eq(o.orderNo, orderNo) });
const ticketsOf = (orderNo: string) => mockDb.query.showTickets.findMany({ where: (t, { eq }) => eq(t.orderNo, orderNo) });

beforeAll(() => {
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 9).toString('base64');
});
afterAll(() => {
  delete process.env[FIELD_CRYPTO_KEY_ENV];
});
beforeEach(async () => {
  const { db } = await createTestDb();
  mockDb = db;
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const bankOrder = async (quantity = 2) => {
  const r = await order({ quantity, paymentMethod: 'bank_transfer' });
  if (!r.ok) throw new Error(`setup failed: ${r.code}`);
  return r.orderNo;
};

describe('공연 계좌 입금 — 좌석 점유', () => {
  it('입금 대기로 만들어지고(보류 기한 없음), 남은 좌석이 없으면 다른 주문은 매진이다', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(2);
    expect((await orderRow(orderNo))?.status).toBe('awaiting_deposit');
    const so = await mockDb.query.showOrders.findFirst({ where: (s, { eq }) => eq(s.orderNo, orderNo) });
    expect(so?.holdExpiresAt).toBeNull();
    expect((await ticketsOf(orderNo)).every((t) => t.status === 'held')).toBe(true);
    expect(await order({ quantity: 1 })).toEqual({ ok: false, code: 'sold_out' });
  });

  it('토스 홀드 만료가 지나도 대기 좌석은 풀리지 않는다 — 자동 취소 없음', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(2);
    expect(await expireStaleShowOrders(new Date(Date.now() + 5 * DAY * 1000))).toBe(0);
    expect((await orderRow(orderNo))?.status).toBe('awaiting_deposit');
    expect(await order({ quantity: 1 })).toEqual({ ok: false, code: 'sold_out' });
  });

  it('회차 시작 2시간 전 이내면 계좌 입금을 받지 않는다(카드는 된다)', async () => {
    await seed(mockDb, { startsInSec: 60 * 60 });
    expect(await order({ paymentMethod: 'bank_transfer' })).toEqual({ ok: false, code: 'starts_too_soon' });
    expect((await order({ quantity: 1 })).ok).toBe(true);
  });
});

describe('공연 계좌 입금 — 입금 확인·미입금 취소', () => {
  it('한 번만 발권하고 결제 행·정리번호를 남기고 티켓 메일을 보낸다', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(2);
    const id = (await orderRow(orderNo))!.id;
    expect((await confirmShowBankDeposit({ orderId: id, now: new Date() })).ok).toBe(true);
    expect((await orderRow(orderNo))?.status).toBe('paid');
    const tickets = await ticketsOf(orderNo);
    expect(tickets.every((t) => t.status === 'issued' && t.entryNumber !== null)).toBe(true);
    const payment = await mockDb.query.payments.findFirst({ where: (p, { eq }) => eq(p.orderId, id) });
    expect(payment?.paymentKey).toBe(bankDepositPaymentKey(orderNo));
    expect(sendShowTicketEmail).toHaveBeenCalledWith(orderNo);
    expect((await confirmShowBankDeposit({ orderId: id, now: new Date() })).ok).toBe(false);
    expect(sendShowTicketEmail).toHaveBeenCalledTimes(1);
  });

  it('회차가 취소된 뒤에는 발권하지 않는다', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(1);
    await mockDb.run(sql`UPDATE showtimes SET status = 'cancelled'`);
    const r = await confirmShowBankDeposit({ orderId: (await orderRow(orderNo))!.id, now: new Date() });
    expect(r).toMatchObject({ ok: false, code: 'showtime_closed' });
    expect((await orderRow(orderNo))?.status).toBe('awaiting_deposit');
  });

  it('미입금 취소는 좌석을 바로 풀고, 그 뒤에는 입금 확인이 되지 않는다', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(2);
    const id = (await orderRow(orderNo))!.id;
    expect((await cancelAwaitingShowDeposit({ orderId: id })).ok).toBe(true);
    expect((await orderRow(orderNo))?.status).toBe('deposit_cancelled');
    expect((await ticketsOf(orderNo)).every((t) => t.status === 'void')).toBe(true);
    expect((await order({ quantity: 2 })).ok).toBe(true);
    expect((await confirmShowBankDeposit({ orderId: id, now: new Date() })).ok).toBe(false);
    expect(await deliverShowDepositGuide(orderNo)).toBe('invalid_state');
  });

  it('내 티켓 조회가 입금 대기면 안내(금액·기한)를 싣는다 — 기한은 신청 + 3일', async () => {
    await seed(mockDb);
    const orderNo = await bankOrder(1);
    const token = (await orderRow(orderNo))!.manageToken;
    const view = await getShowOrderForManage(orderNo.toLowerCase(), token, new Date());
    expect(view?.bankDeposit).toBe('awaiting');
    expect(view?.depositGuide?.amount).toBe(10000);
    const deadline = new Date(view!.depositGuide!.deadline).getTime();
    expect(Math.abs(deadline - (Date.now() + 3 * DAY * 1000))).toBeLessThan(60_000);
  });
});

describe('공연 계좌 입금 — 환불', () => {
  const paidBankOrder = async (quantity = 2) => {
    const orderNo = await bankOrder(quantity);
    await confirmShowBankDeposit({ orderId: (await orderRow(orderNo))!.id, now: new Date() });
    return orderNo;
  };
  const toss = () => ({ cancelPayment: jest.fn() });

  it('고객 환불은 환불 계좌가 없으면 거절하고 티켓을 건드리지 않는다', async () => {
    await seed(mockDb);
    const orderNo = await paidBankOrder(1);
    const t = toss();
    const tickets = await ticketsOf(orderNo);
    const r = await refundShowTickets({ orderNo, ticketIds: [tickets[0].id], noticeAt: new Date(), actor: 'customer' }, t);
    expect(r).toMatchObject({ status: 'rejected', reason: 'refund_account_invalid' });
    expect((await ticketsOf(orderNo))[0].status).toBe('issued');
    expect(t.cancelPayment).not.toHaveBeenCalled();
  });

  it('토스를 부르지 않고 환불 계좌를 암호화해 받고, 기록·좌석 해제는 그 자리에서 끝낸다', async () => {
    await seed(mockDb);
    const orderNo = await paidBankOrder(2);
    const t = toss();
    const tickets = await ticketsOf(orderNo);
    const r = await refundShowTickets(
      { orderNo, ticketIds: [tickets[0].id], noticeAt: new Date(), actor: 'customer', refundAccount: ACCOUNT }, t,
    );
    expect(r).toMatchObject({ status: 'refunded', amount: 10000, orderStatus: 'partially_refunded', refundVia: 'bank_account' });
    expect(t.cancelPayment).not.toHaveBeenCalled();
    const row = (await mockDb.all(sql`SELECT account_number_enc, refunded_at FROM refund_accounts WHERE order_kind = 'show' AND order_no = ${orderNo}`)) as Array<{ account_number_enc: string; refunded_at: number | null }>;
    expect(row).toHaveLength(1);
    expect(row[0].account_number_enc).not.toContain('333444');
    expect(row[0].refunded_at).toBeNull();
    expect(await loadRefundAccount({ kind: 'show', orderNo })).toEqual(ACCOUNT);
    expect((await order({ quantity: 1 })).ok).toBe(true); // 환불한 좌석이 다시 팔린다
  });
});

describe('공연 계좌 입금 — 리뷰 회귀', () => {
  const paid = async (q: number) => {
    const orderNo = await bankOrder(q);
    await confirmShowBankDeposit({ orderId: (await orderRow(orderNo))!.id, now: new Date() });
    return orderNo;
  };
  const refundedAt = async (orderNo: string) =>
    ((await mockDb.all(sql`SELECT refunded_at FROM refund_accounts WHERE order_no = ${orderNo}`)) as Array<{ refunded_at: number | null }>)[0]?.refunded_at;

  it('관리자 티켓 환불 기록이 고객의 미송금 환불 계좌를 "송금 완료"로 덮지 않는다', async () => {
    await seed(mockDb);
    const orderNo = await paid(2);
    const t = { cancelPayment: jest.fn() };
    const [a, b] = await ticketsOf(orderNo);
    await refundShowTickets({ orderNo, ticketIds: [a.id], noticeAt: new Date(), actor: 'customer', refundAccount: ACCOUNT }, t);
    await refundShowTickets({ orderNo, ticketIds: [b.id], noticeAt: new Date() }, t); // 관리자
    expect(await refundedAt(orderNo)).toBeNull();
  });

  it('환불 기록(batch)이 실패하면 티켓을 issued로, 새 환불 계좌 행을 지운다(refunding에 남지 않는다)', async () => {
    await seed(mockDb);
    const orderNo = await paid(1);
    const [tk] = await ticketsOf(orderNo);
    const spy = jest.spyOn(mockDb, 'batch').mockRejectedValueOnce(new Error('db down'));
    const r = await refundShowTickets({ orderNo, ticketIds: [tk.id], noticeAt: new Date(), actor: 'customer', refundAccount: ACCOUNT }, { cancelPayment: jest.fn() });
    spy.mockRestore();
    expect(r).toMatchObject({ status: 'rejected', reason: 'refund_account_unavailable' });
    expect((await ticketsOf(orderNo))[0].status).toBe('issued');
    expect(await refundedAt(orderNo)).toBeUndefined();
    expect((await orderRow(orderNo))?.status).toBe('paid');
  });
});

describe('공연 계좌 입금 — 회차 취소', () => {
  it('입금 전 신청은 닫고, 계좌로 결제된 주문은 토스를 부르지 않고 티켓을 남겨 고객이 환불 계좌를 적게 한다(전액)', async () => {
    await seed(mockDb, { capacity: 5 });
    const waiting = await bankOrder(1);
    const paid = await bankOrder(2);
    await confirmShowBankDeposit({ orderId: (await orderRow(paid))!.id, now: new Date() });
    const t = toss();
    const r = await cancelShowtime('st-1', new Date(), t);
    expect(r.closedDepositOrders).toEqual([waiting]);
    expect(r.bankRefundOrders).toEqual([paid]);
    expect(t.cancelPayment).not.toHaveBeenCalled();
    expect((await orderRow(waiting))?.status).toBe('deposit_cancelled');
    expect((await ticketsOf(paid)).every((x) => x.status === 'issued')).toBe(true);
    // 관리자 현황: 취소 회차의 남은 계좌 결제는 매출이 아니라 돌려줄 돈이다.
    const stat = (await loadAdminShowDetail('show-1'))!.showtimes[0];
    expect(stat.grossAmount).toBe(0);
    expect(stat.refundDueAmount).toBe(20000);

    // 공연 1~2일 전이라도 회차 취소는 취소환불표가 아니라 100%다.
    const tickets = await ticketsOf(paid);
    const refund = await refundShowTickets(
      { orderNo: paid, ticketIds: tickets.map((x) => x.id), noticeAt: new Date(), actor: 'customer', refundAccount: ACCOUNT }, t,
    );
    expect(refund).toMatchObject({ status: 'refunded', amount: 20000, orderStatus: 'refunded' });
  });

  function toss() {
    return { cancelPayment: jest.fn() };
  }
});
