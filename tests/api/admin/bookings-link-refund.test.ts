/** @jest-environment node */
/**
 * 예약금 결제 링크 주문(type 'deposit')의 계좌 직접 입금분 환불 기록 — refunds done 행과 주문 상태가 남고
 * 매출 집계가 그 환불을 읽는다. 카드(토스) 결제 링크는 받지 않는다.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { createTestDb, type ShowsTestDb } from '../../helpers/showsDb';

let testDb: ShowsTestDb;
let client: Awaited<ReturnType<typeof createTestDb>>['client'];
jest.mock('../../../db/client', () => ({ getDb: () => testDb }));
jest.mock('../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn().mockResolvedValue({ ok: true }) }));

jest.mock('../../../lib/booking/email', () => ({ ...jest.requireActual('../../../lib/booking/email'), sendDepositRefundEmail: jest.fn().mockResolvedValue(null) }));

/* eslint-disable import/first */
import { sendDepositRefundEmail } from '../../../lib/booking/email';
import handler from '../../../pages/api/admin/bookings/[id]';
import { loadRevenueRows, loadWindow } from '../../../lib/ops/revenueReport';
/* eslint-enable import/first */

const seed = async (id: string, paymentKey: string, status = 'paid') => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, manage_token)
          VALUES (?, ?, 'deposit', ?, '홍길동', '010', 'a@b.c', 90000, 10000, 100000, ?)`,
    args: [id, `LNK-${id}`, status, `tok-${id}`],
  });
  await client.execute({
    sql: `INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '계좌 입금', ?)`,
    args: [`p-${id}`, id, paymentKey, Math.floor(Date.now() / 1000)],
  });
};

const post = async (id: string, body: Record<string, unknown>) => {
  const json = jest.fn();
  const res = { setHeader: jest.fn(), status: jest.fn().mockReturnValue({ json }) } as unknown as NextApiResponse & { status: jest.Mock };
  await handler({ method: 'POST', query: { id }, body, headers: {} } as unknown as NextApiRequest, res);
  return { status: res.status.mock.calls[0][0] as number, body: json.mock.calls[0]?.[0] };
};
const orderStatus = async (id: string) => String((await client.execute({ sql: 'SELECT status FROM orders WHERE id = ?', args: [id] })).rows[0].status);
const refundTotal = async () => Number((await client.execute(`SELECT COALESCE(SUM(amount),0) AS n FROM refunds WHERE status = 'done'`)).rows[0].n);

beforeEach(async () => {
  jest.clearAllMocks();
  const t = await createTestDb();
  testDb = t.db;
  client = t.client;
});

it('계좌 입금 링크 주문: 부분 환불 → partially_refunded, 잔액 전부 → refunded, 초과·0원은 거절', async () => {
  await seed('a', 'bank-deposit:LNK-a');
  const first = await post('a', { action: 'record_link_refund', amount: 30000, reason: '일정 변경' });
  expect(first).toMatchObject({ status: 200, body: { ok: true, refundAmount: 30000 } });
  expect(await orderStatus('a')).toBe('partially_refunded');

  expect((await post('a', { action: 'record_link_refund', amount: 70001, reason: '초과' })).status).toBe(400);
  expect((await post('a', { action: 'record_link_refund', amount: 0, reason: '영' })).status).toBe(400);
  expect((await post('a', { action: 'record_link_refund', amount: 5000, reason: '' })).status).toBe(400);

  expect((await post('a', { action: 'record_link_refund', amount: 70000, reason: '나머지' })).status).toBe(200);
  expect(await orderStatus('a')).toBe('refunded');
  expect(await refundTotal()).toBe(100000);
  // 전액 환불된 뒤에는 더 기록할 수 없다.
  expect((await post('a', { action: 'record_link_refund', amount: 1, reason: '또' })).status).toBe(409);
});

it('기록한 환불을 매출 집계가 읽는다', async () => {
  await seed('a', 'bank-deposit:LNK-a');
  await post('a', { action: 'record_link_refund', amount: 40000, reason: '일부 환불' });
  const rows = await loadRevenueRows(loadWindow(new Date().getFullYear()));
  expect(rows.find((r) => r.orderNo === 'LNK-a')).toMatchObject({ gross: 100000, refunded: 40000 });
});

it('토스(카드) 결제 링크 주문은 기록하지 않는다 — 토스 취소는 action refund(예약금 환불)로 한다', async () => {
  await seed('t', 'tgen_toss_key');
  const r = await post('t', { action: 'record_link_refund', amount: 1000, reason: '카드' });
  expect(r.status).toBe(409);
  expect(r.body.code).toBe('not_bank_deposit');
  expect(await refundTotal()).toBe(0);
  expect(await orderStatus('t')).toBe('paid');
});

it('입금 확인 전(awaiting_deposit) 주문은 기록하지 않는다', async () => {
  await seed('w', 'bank-deposit:LNK-w', 'awaiting_deposit');
  expect((await post('w', { action: 'record_link_refund', amount: 1000, reason: 'x' })).status).toBe(409);
});

it('기록하면 고객에게 환불 안내 메일이 가고(남은 금액 포함), 메일이 실패해도 환불 기록은 남는다', async () => {
  await seed('m', 'bank-deposit:LNK-m');
  expect((await post('m', { action: 'record_link_refund', amount: 30000, reason: '일정 변경' })).status).toBe(200);
  expect(sendDepositRefundEmail).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: 'LNK-m' }), 30000, 70000, 'bank_account');

  (sendDepositRefundEmail as jest.Mock).mockResolvedValueOnce('API_ERROR');
  expect((await post('m', { action: 'record_link_refund', amount: 10000, reason: '추가' })).status).toBe(200);
  expect(await refundTotal()).toBe(40000);
  expect(String((await client.execute("SELECT notification_error AS e FROM orders WHERE id = 'm'")).rows[0].e)).toBe('API_ERROR');
});

it('기록이 거절되면 메일을 보내지 않는다', async () => {
  await seed('n', 'bank-deposit:LNK-n');
  expect((await post('n', { action: 'record_link_refund', amount: 0, reason: '영' })).status).toBe(400);
  expect(sendDepositRefundEmail).not.toHaveBeenCalled();
});
