/** @jest-environment node */
/**
 * 결제 링크 주문 ↔ 링크 기록(0061) — 주문 API가 남기고, 관리자 직렬화·운영자 메일이 읽는다. 표가 없는 DB에서도 주문은 그대로 돈다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';

let testDb: ShowsTestDb;
let dbBroken = false;
jest.mock('../../../db/client', () => ({
  getDb: () => {
    if (dbBroken) throw new Error('no such table: payment_link_orders');
    return testDb;
  },
}));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));

/* eslint-disable import/first */
import handler from '../../../pages/api/payment-links/order';
import { createPaymentLink } from '../../../lib/payments/paymentLinks';
import { loadPaymentLinkOrderInfo } from '../../../lib/payments/paymentLinkOrders';
import { serializeBookingForAdmin } from '../../../lib/booking/admin-serialize';
import { sendEmail } from '../../../lib/email/resend';
/* eslint-enable import/first */

const call = async (body: unknown) => {
  const result: { status?: number; json?: Record<string, unknown> } = {};
  const res = {
    setHeader: () => res,
    status: (code: number) => { result.status = code; return res; },
    json: (j: Record<string, unknown>) => { result.json = j; return res; },
  } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: { remoteAddress: '1.2.3.4' } } as unknown as NextApiRequest, res);
  return result;
};

const customer = { customerName: '김준호', customerPhone: '010-1234-5678', customerEmail: 'kim@example.com' };

beforeEach(async () => {
  testDb = (await createTestDb()).db;
  dbBroken = false;
  jest.clearAllMocks();
});

const newLink = () => createPaymentLink({ itemName: '보컬 녹음 1프로 (10/17 11:00)', totalAmount: 250000, expiresOn: null, memo: '김준호님', sessionAt: null, sessionHours: null, blockSlot: false });

it('링크로 주문하면 어느 링크·상품이었는지 남고, 관리자 목록은 "예약금" 대신 그 상품명을 보인다', async () => {
  const { slug } = await newLink();
  const r = await call({ slug, ...customer });
  expect(r.status).toBe(201);
  const info = (await loadPaymentLinkOrderInfo([r.json!.orderNo as string])).get(r.json!.orderNo as string);
  expect(info).toEqual({ slug, itemName: '보컬 녹음 1프로 (10/17 11:00)', memo: '김준호님', sessionAt: null, sessionHours: null, gcalEventId: null, gcalError: null });

  const order = await testDb.query.orders.findFirst({ with: { bookings: true, payments: true, workOrders: true } });
  expect(serializeBookingForAdmin(order!, info)).toMatchObject({ productName: '보컬 녹음 1프로 (10/17 11:00)', linkMemo: '김준호님' });
  expect(serializeBookingForAdmin(order!)).toMatchObject({ productName: '예약금', linkMemo: null });
});

it('계좌 입금 신청이면 입금 안내 메일(운영자)에 상품명이 실린다', async () => {
  const { slug } = await newLink();
  const r = await call({ slug, ...customer, paymentMethod: 'bank_transfer' });
  expect(r.status).toBe(201);
  const operator = (sendEmail as jest.Mock).mock.calls.map((c) => c[0]).find((m) => String(m.subject).includes('계좌 입금 신청'));
  expect(operator.text).toContain('보컬 녹음 1프로 (10/17 11:00)');
});

it('링크 기록이 실패해도(표 없음) 주문은 만들어진다', async () => {
  const { slug } = await newLink();
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const realGetDb = testDb.run.bind(testDb);
  // 기록 쓰기만 실패시킨다 — run 호출이 payment_link_orders를 건드릴 때 던진다.
  jest.spyOn(testDb, 'run').mockImplementation(((q: unknown) => {
    if (JSON.stringify(q).includes('payment_link_orders')) throw new Error('no such table: payment_link_orders');
    return realGetDb(q as never);
  }) as never);
  const r = await call({ slug, ...customer });
  expect(r.status).toBe(201);
  expect(await testDb.query.orders.findMany()).toHaveLength(1);
  spy.mockRestore();
  jest.restoreAllMocks();
});

it('조회가 실패하면 빈 맵 — 화면은 "예약금"으로 내려간다', async () => {
  dbBroken = true;
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  expect((await loadPaymentLinkOrderInfo(['SNB-1'])).size).toBe(0);
  spy.mockRestore();
});

it('일시가 있는 링크로 주문하면 이용 일시·시간이 주문에 스냅샷으로 남는다 — 대시보드·예약 목록이 읽는다', async () => {
  const sessionAt = Math.floor(Date.now() / 1000) + 3 * 24 * 3600;
  const { slug } = await createPaymentLink({ itemName: '보컬 녹음 1프로', totalAmount: 250000, expiresOn: null, memo: null, sessionAt, sessionHours: 3, blockSlot: true });
  const r = await call({ slug, ...customer });
  expect(r.status).toBe(201);
  expect((await loadPaymentLinkOrderInfo([r.json!.orderNo as string])).get(r.json!.orderNo as string)).toMatchObject({ sessionAt, sessionHours: 3 });
  const order = await testDb.query.orders.findFirst({ with: { bookings: true, payments: true, workOrders: true } });
  const info = (await loadPaymentLinkOrderInfo([order!.orderNo])).get(order!.orderNo);
  expect(serializeBookingForAdmin(order!, info).linkSessionAt).toBe(new Date(sessionAt * 1000).toISOString());
});
