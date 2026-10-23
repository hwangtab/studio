/** @jest-environment node */

/**
 * 해지 환불을 받은 길로 — 카드·간편결제 몫은 토스 부분취소, 계좌 몫은 송금 완료 때 기록(refund-execute.ts).
 * 실제 SQLite(in-memory, 실제 마이그레이션)로 돌리고 토스만 가짜로 둔다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
const mockCancel = jest.fn();
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../email/resend', () => ({ sendEmail: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('../../booking/toss', () => ({ ...jest.requireActual('../../booking/toss'), cancelPayment: (...args: unknown[]) => mockCancel(...args) }));

import { loadProductionRevenueRows } from '../../ops/productionRevenue';
import { loadContractRefundPlan, recordContractBankLinkRefunds, runContractCardRefunds } from './refund-execute';
import { createProductionContract } from './service';
import { buildDefaultReworkTerms } from './terms';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const NOW = new Date('2026-11-20T03:00:00Z');
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

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
beforeEach(() => {
  mockCancel.mockReset();
  mockCancel.mockImplementation(async (input: { cancelAmount: number }) => ({
    ok: true,
    payment: { paymentKey: 'pk', orderId: 'x', status: 'PARTIAL_CANCELED', totalAmount: 0, cancels: [{ transactionKey: 'tx', cancelAmount: input.cancelAmount }] },
  }));
});

let seq = 0;
const event = async (contractId: string, type: string, at: Date, extra: { amount?: number; orderNo?: string; stage?: string } = {}) => {
  seq += 1;
  await client.execute({
    sql: `INSERT INTO production_contract_events (id, contract_id, seq, type, stage, amount, data_json, occurred_at, recorded_at, actor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin:test')`,
    args: [`ev${seq}`, contractId, seq, type, extra.stage ?? null, extra.amount ?? null, extra.orderNo ? JSON.stringify({ orderNo: extra.orderNo }) : null, sec(at), sec(at)],
  });
};

const linkOrder = async (orderNo: string, amount: number, bank: boolean) => {
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'deposit', 'paid', '김의뢰', '010-1111-2222', 'c@example.com', ?, ?, ?, ?)`,
    args: [`o-${orderNo}`, orderNo, `t-${orderNo}`, amount - Math.round(amount / 11), Math.round(amount / 11), amount],
  });
  await client.execute({
    sql: 'INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, ?, ?)',
    args: [`p-${orderNo}`, `o-${orderNo}`, bank ? `bank-deposit:${orderNo}` : `pk-${orderNo}`, bank ? '계좌 입금' : '카드', sec(NOW)],
  });
};

const refundsOf = async (orderNo: string) =>
  (await client.execute({ sql: "SELECT SUM(r.amount) AS s FROM refunds r JOIN payments p ON p.id = r.payment_id JOIN orders o ON o.id = p.order_id WHERE o.order_no = ? AND r.status = 'done'", args: [orderNo] })).rows[0].s;

/**
 * 리워크 100만원: 계약금 50만(카드 링크) · 중간금 30만(계좌 입금 링크) · 직접 기록 10만, 녹음 완료 뒤 의뢰인 사정 해지 → 받은 90만 × 40% = 36만.
 * 늦은 입금부터: 직접 10만 → 중간금 26만 → 카드 0.
 */
const scenario = async (cardFirst: boolean) => {
  const created = await createProductionContract({
    kind: 'rework', title: '리워크', clientName: '김의뢰', clientStageName: null, clientEmail: 'c@example.com', clientPhone: '010-1111-2222', guardian: null,
    terms: buildDefaultReworkTerms('small'),
  });
  const id = created.id;
  const tag = id.slice(0, 6).toUpperCase();
  await client.execute({ sql: "UPDATE production_contracts SET status = 'signed', signed_at = ? WHERE id = ?", args: [sec(new Date('2026-11-01T01:00:00Z')), id] });
  const [first, second] = cardFirst ? [`C${tag}`, `B${tag}`] : [`B${tag}`, `C${tag}`];
  await linkOrder(`C${tag}`, cardFirst ? 500_000 : 300_000, false);
  await linkOrder(`B${tag}`, cardFirst ? 300_000 : 500_000, true);
  await event(id, 'payment_received', new Date('2026-11-02T01:00:00Z'), { amount: 500_000, orderNo: first });
  await event(id, 'source_received', new Date('2026-11-02T02:00:00Z'));
  await event(id, 'kickoff', new Date('2026-11-03T01:00:00Z'));
  await event(id, 'payment_received', new Date('2026-11-10T01:00:00Z'), { amount: 300_000, orderNo: second });
  await event(id, 'recording_completed', new Date('2026-11-12T01:00:00Z'));
  await event(id, 'payment_received', new Date('2026-11-13T01:00:00Z'), { amount: 100_000 });
  await client.execute({
    sql: "UPDATE production_contracts SET status = 'terminated', terminated_at = ?, termination_reason = '[의뢰인 사정] 중단' WHERE id = ?",
    args: [sec(NOW), id],
  });
  return { id, card: `C${tag}`, bank: `B${tag}` };
};

describe('해지 환불 — 받은 길로', () => {
  it('늦은 입금부터: 직접 기록 10만 → 계좌 입금 링크 26만, 카드 몫 없음 — 토스를 부르지 않는다', async () => {
    const { id, bank } = await scenario(true);
    const plan = (await loadContractRefundPlan(id))!;
    expect(plan.refundable).toBe(360_000);
    expect(plan.card).toEqual([]);
    expect(plan.bankLink).toEqual([{ orderNo: bank, amount: 260_000 }]);
    expect(plan.direct).toBe(100_000);
    const run = (await runContractCardRefunds(id, NOW))!;
    expect(run.refunded).toBe(0);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('카드 몫은 토스 부분취소, 재시도해도 두 번 나가지 않고, 계좌 몫은 송금 완료 때 주문 환불로 남는다 — 매출은 직접 몫만 뺀다', async () => {
    const { id, card, bank } = await scenario(false); // 카드 링크가 늦은 입금(중간금)
    const plan = (await loadContractRefundPlan(id))!;
    expect(plan.card).toEqual([{ orderNo: card, amount: 260_000, refunded: 0 }]);
    expect(plan.bankTotal).toBe(100_000);

    const run = (await runContractCardRefunds(id, NOW))!;
    expect(run.refunded).toBe(260_000);
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel.mock.calls[0][0]).toMatchObject({ paymentKey: `pk-${card}`, cancelAmount: 260_000 });
    expect(await refundsOf(card)).toBe(260_000);
    expect(run.plan.cardPending).toBe(0);

    await runContractCardRefunds(id, NOW);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // 송금 완료(직접 기록 몫 10만만 남았다 — 계좌 입금 링크 몫은 0).
    await client.execute({
      sql: `INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at, refunded_at)
            VALUES (lower(hex(randomblob(8))), 'production', ?, '국민', 'enc', '김의뢰', ?, ?)`,
      args: [id, sec(NOW), sec(NOW)],
    });
    expect((await recordContractBankLinkRefunds(id, NOW)).failed).toEqual([]);
    expect(await refundsOf(bank)).toBeNull();
    const rows = await loadProductionRevenueRows({ from: new Date('2026-10-31T15:00:00Z'), toExclusive: new Date('2026-11-30T15:00:00Z') }, NOW);
    expect(rows.filter((r) => r.note === '리워크').map((r) => [r.gross, r.refunded])).toEqual(expect.arrayContaining([[100_000, 100_000]]));
  });

  it('토스가 거절하면 미처리로 남고 다시 시도할 수 있다', async () => {
    const { id, card } = await scenario(false);
    mockCancel.mockResolvedValueOnce({ ok: false, code: 'REJECT', message: '거절', httpStatus: 400 });
    const run = (await runContractCardRefunds(id, NOW))!;
    expect(run.failures).toHaveLength(1);
    expect(run.plan.cardPending).toBe(260_000);
    const retry = (await runContractCardRefunds(id, NOW))!;
    expect(retry.refunded).toBe(260_000);
    expect(await refundsOf(card)).toBe(260_000);
  });

  it('계좌 입금 링크 몫은 송금 완료 기록 때 그 주문의 환불로 남는다(한 번만)', async () => {
    const { id, bank } = await scenario(true);
    expect((await recordContractBankLinkRefunds(id, NOW)).failed).toEqual([]);
    expect(await refundsOf(bank)).toBe(260_000);
    await recordContractBankLinkRefunds(id, NOW);
    expect(await refundsOf(bank)).toBe(260_000);
  });
});
