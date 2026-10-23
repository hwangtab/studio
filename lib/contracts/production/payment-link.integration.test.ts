/** @jest-environment node */

/**
 * 계약 대금 결제 링크 — 체결 뒤 지금 받을 돈의 링크를 열고, 결제가 확정되면 진행 기록에 입금을 남긴다(payment-link.ts).
 * 실제 SQLite(in-memory, 실제 마이그레이션)로 돌린다 — 조건부 쓰기·중복 판정이 SQL에 달려 있다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
const mockSendEmail = jest.fn().mockResolvedValue({ ok: true });
jest.mock('../../../db/client', () => ({ getDb: () => mockDb }));
jest.mock('../../email/resend', () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));

// eslint-disable-next-line import/first
import { loadProductionRevenueRows } from '../../ops/productionRevenue';
// eslint-disable-next-line import/first
import { ensureContractPaymentLink, isContractPaymentOrder, recordContractPaymentFromLinkOrder } from './payment-link';
// eslint-disable-next-line import/first
import { loadProgressContext } from './progress';
// eslint-disable-next-line import/first
import { createProductionContract } from './service';
// eslint-disable-next-line import/first
import { applyMixMasterTracks, buildDefaultProductionTerms, type ProductionTerms } from './terms';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

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
beforeEach(() => mockSendEmail.mockClear());

const NOW = new Date('2026-10-21T03:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

const signedContractWithTerms = async (kind: 'single' | 'mixmaster', terms: ProductionTerms, signedAgoSec = 3600) => {
  const created = await createProductionContract({
    kind, title: '테스트', clientName: '김의뢰', clientStageName: null, clientEmail: 'c@example.com', clientPhone: '010-1111-2222', guardian: null, terms,
  });
  await client.execute({ sql: "UPDATE production_contracts SET status = 'signed', signed_at = ? WHERE id = ?", args: [nowSec - signedAgoSec, created.id] });
  await client.execute({ sql: "INSERT INTO production_contract_signers (id, contract_id, role, name, email, status, sign_token) VALUES (lower(hex(randomblob(8))), ?, 'client', '김의뢰', 'c@example.com', 'signed', lower(hex(randomblob(16)))) ON CONFLICT DO NOTHING", args: [created.id] });
  await client.execute({ sql: "UPDATE production_contract_signers SET status = 'signed', sign_token = lower(hex(randomblob(16))) WHERE contract_id = ? AND role = 'client'", args: [created.id] });
  return created.id;
};

const signedContract = async (tracks = 30) =>
  signedContractWithTerms('mixmaster', applyMixMasterTracks(buildDefaultProductionTerms('mixmaster'), tracks));

/** AI 리워크 3회 분할(계약금 500,000 · 2차 300,000 · 잔금 200,000). */
const reworkTerms = (): ProductionTerms => ({
  ...buildDefaultProductionTerms('single'),
  amount: {
    total: 1_000_000,
    deposit: 500_000,
    second: 300_000,
    balance: 200_000,
    depositDueDays: 3,
    secondDueDays: 7,
    balanceDueDays: 7,
  },
});
const signedReworkContract = async () => signedContractWithTerms('single', reworkTerms());

/** 진행 기록 한 건을 직접 넣는다(순번은 계약 안에서 1씩). */
let eventSeq = 0;
const insertEvent = async (
  contractId: string,
  type: string,
  options: { stage?: string | null; amount?: number | null; atSec?: number } = {},
) => {
  eventSeq += 1;
  const at = options.atSec ?? nowSec;
  await client.execute({
    sql: `INSERT INTO production_contract_events (id, contract_id, seq, type, stage, amount, occurred_at, recorded_at, actor)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'admin:test')`,
    args: [`ev-${contractId.slice(0, 8)}-${eventSeq}`, contractId, eventSeq, type, options.stage ?? null, options.amount ?? null, at, at],
  });
};

/** 편곡 결과물 전달 + 승인 — 2차 링크가 열리는 조건. */
const approveArrangement = async (contractId: string) => {
  await insertEvent(contractId, 'stage_delivered', { stage: 'arrangement', atSec: nowSec - 7200 });
  await insertEvent(contractId, 'stage_approved', { stage: 'arrangement', atSec: nowSec - 3600 });
};

/** 결제 링크로 결제가 확정된 주문을 흉내 낸다(confirmDeposit이 남기는 것과 같은 행). */
const paidLinkOrder = async (slug: string, amount: number, orderNo: string) => {
  const orderId = `o-${orderNo}`;
  await client.execute({
    sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email, manage_token, item_amount, vat_amount, total_amount)
          VALUES (?, ?, 'deposit', 'paid', '김의뢰', '010-1111-2222', 'c@example.com', ?, ?, ?, ?)`,
    args: [orderId, orderNo, `t-${orderNo}`, amount - Math.round(amount / 11), Math.round(amount / 11), amount],
  });
  await client.execute({ sql: 'INSERT INTO payment_link_orders (order_no, slug, item_name) VALUES (?, ?, ?)', args: [orderNo, slug, '대금'] });
  await client.execute({
    sql: "INSERT INTO payments (id, order_id, payment_key, method, approved_at) VALUES (?, ?, ?, '카드', ?)",
    args: [`p-${orderNo}`, orderId, `pk-${orderNo}`, Math.floor(NOW.getTime() / 1000)],
  });
};

describe('계약 대금 결제 링크', () => {
  it('체결 뒤 대금(일시불 450,000원) 링크를 열고, 여러 번 불러도 같은 링크다', async () => {
    const id = await signedContract(30);
    const first = await ensureContractPaymentLink(id, NOW);
    expect(first).toMatchObject({ purpose: 'deposit', amount: 450_000 });
    expect(first?.url).toMatch(/\/ko\/pay\/[0-9a-f]{24}$/);
    const again = await ensureContractPaymentLink(id, NOW);
    expect(again?.slug).toBe(first?.slug);
    const link = await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, first!.slug) });
    expect(link).toMatchObject({ itemName: '믹싱·마스터링 용역 계약 대금', totalAmount: 450_000, closedAt: null });
  });

  it('결제가 확정되면 진행 기록에 입금이 한 번만 남고, 링크가 닫히고, 매출은 결제 행으로만 센다', async () => {
    const id = await signedContract(30);
    const link = await ensureContractPaymentLink(id, NOW);
    await paidLinkOrder(link!.slug, 450_000, 'PAY-1');

    expect(await isContractPaymentOrder('PAY-1')).toBe(true);
    expect(await recordContractPaymentFromLinkOrder('PAY-1', NOW)).toBe('recorded');
    expect(await recordContractPaymentFromLinkOrder('PAY-1', NOW)).toBe('already'); // 웹훅·승인 화면이 두 번 확정해도

    const context = await loadProgressContext(id, NOW);
    const payments = context!.ledger.events.filter((e) => e.type === 'payment_received');
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount: 450_000, actor: 'system:payment' });
    expect(context!.ledger.payments.depositMetAt).not.toBeNull();
    // 의뢰인에게 계약의 "입금을 확인했어요" 통지 한 통.
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toMatchObject({ to: 'c@example.com' });

    const closed = await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, link!.slug) });
    expect(closed?.closedAt).not.toBeNull();
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull(); // 다 받았다 — 마스터링 승인 전에는 받을 돈이 없다
    // 결제 행으로 매출에 잡히므로 계약 입금 집계에서는 뺀다(두 번 세지 않게).
    const rows = await loadProductionRevenueRows({ from: new Date('2026-10-01T00:00:00Z'), toExclusive: new Date('2026-11-01T00:00:00Z') }, NOW);
    expect(rows.filter((r) => r.note === '테스트' && r.gross === 450_000 && r.at.getTime() === NOW.getTime())).toHaveLength(0);
  });

  it('계약 링크가 아닌 결제 링크 주문은 건드리지 않는다', async () => {
    await client.execute("INSERT INTO payment_links (slug, item_name, total_amount) VALUES ('aaaaaaaaaaaaaaaaaaaaaaaa', '일반', 10000)");
    await paidLinkOrder('aaaaaaaaaaaaaaaaaaaaaaaa', 10_000, 'PAY-2');
    expect(await isContractPaymentOrder('PAY-2')).toBe(false);
    expect(await recordContractPaymentFromLinkOrder('PAY-2', NOW)).toBe('not_contract');
  });

  it('계약금을 받았어도 편곡 승인 전에는 다음 링크를 열지 않는다', async () => {
    const id = await signedReworkContract();
    await insertEvent(id, 'payment_received', { amount: 500_000 });
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull();
  });

  it('편곡이 승인되면 2차(중간금) 링크를 열고, 결제가 끝나면 닫고 잔금 기한 전에는 새 링크가 없다', async () => {
    const id = await signedReworkContract();
    await insertEvent(id, 'payment_received', { amount: 500_000 });
    await approveArrangement(id);

    const second = await ensureContractPaymentLink(id, NOW);
    expect(second).toMatchObject({ purpose: 'second', amount: 300_000 });
    const link = await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, second!.slug) });
    expect(link).toMatchObject({ itemName: '음원 제작 용역 계약 중간금', totalAmount: 300_000, closedAt: null });

    await paidLinkOrder(second!.slug, 300_000, 'PAY-SECOND-1');
    expect(await recordContractPaymentFromLinkOrder('PAY-SECOND-1', NOW)).toBe('recorded');

    expect((await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, second!.slug) }))?.closedAt).not.toBeNull();
    // 잔금은 마스터링 승인 뒤에 열린다 — 지금은 받을 돈이 없다.
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull();
  });

  it('2차를 일부만 받으면 2차 링크 금액을 줄이고 잔금 링크는 열지 않는다', async () => {
    const id = await signedReworkContract();
    await insertEvent(id, 'payment_received', { amount: 500_000 });
    await approveArrangement(id);
    expect(await ensureContractPaymentLink(id, NOW)).toMatchObject({ purpose: 'second', amount: 300_000 });

    await insertEvent(id, 'payment_received', { amount: 100_000, atSec: nowSec + 1 });
    const reduced = await ensureContractPaymentLink(id, NOW);
    expect(reduced).toMatchObject({ purpose: 'second', amount: 200_000 });
    expect(await ensureContractPaymentLink(id, NOW)).toMatchObject({ purpose: 'second', amount: 200_000 });
  });

  it('계약금만 일부 받았으면 편곡이 승인돼도 2차 링크 대신 남은 계약금 링크를 연다', async () => {
    const id = await signedReworkContract();
    await insertEvent(id, 'payment_received', { amount: 100_000 });
    await approveArrangement(id);
    expect(await ensureContractPaymentLink(id, NOW)).toMatchObject({ purpose: 'deposit', amount: 400_000 });
  });

  it('계약금·2차를 넘겨 받아도 2차 링크에 음수 금액을 만들지 않는다', async () => {
    const id = await signedReworkContract();
    await insertEvent(id, 'payment_received', { amount: 900_000 });
    await approveArrangement(id);
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull();
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull();
  });

  it('운영자가 계좌 입금을 직접 기록하면 남은 금액에 맞춰 링크를 바꾸고, 끝난 계약은 링크를 닫는다', async () => {
    const id = await signedContract(31); // 600,000원 — 계약금 300,000·잔금 300,000
    const first = await ensureContractPaymentLink(id, NOW);
    expect(first).toMatchObject({ purpose: 'deposit', amount: 300_000 });
    // 일부(100,000)를 계좌로 받아 직접 기록 → 남은 계약금 200,000 링크로 바뀐다.
    await client.execute({
      sql: "INSERT INTO production_contract_events (id, contract_id, seq, type, amount, occurred_at, recorded_at, actor) VALUES ('m1', ?, 1, 'payment_received', 100000, ?, ?, 'admin:test')",
      args: [id, Math.floor(NOW.getTime() / 1000), Math.floor(NOW.getTime() / 1000)],
    });
    const second = await ensureContractPaymentLink(id, NOW);
    expect(second).toMatchObject({ purpose: 'deposit', amount: 200_000 });
    expect(second?.slug).not.toBe(first?.slug);
    expect((await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, first!.slug) }))?.closedAt).not.toBeNull();

    await client.execute({ sql: "UPDATE production_contracts SET status = 'cancelled' WHERE id = ?", args: [id] });
    expect(await ensureContractPaymentLink(id, NOW)).toBeNull();
    expect((await mockDb.query.paymentLinks.findFirst({ where: (t, { eq }) => eq(t.slug, second!.slug) }))?.closedAt).not.toBeNull();
  });
});
