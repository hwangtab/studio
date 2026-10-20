/** @jest-environment node */

/**
 * 제작·믹싱 계약의 입금 기록이 매출 행이 되는지 — 결제 행이 없어 매출 현황에서 빠지던 돈(운영 점검 2026-10-20).
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { buildDefaultProductionTerms } from '../contracts/production/terms';
// eslint-disable-next-line import/first
import { createProductionContract } from '../contracts/production/service';
// eslint-disable-next-line import/first
import { loadProductionRevenueRows } from './productionRevenue';
// eslint-disable-next-line import/first
import { summarizeRevenue } from './revenueReport';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const EPOCH = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
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

let seq = 0;
const event = async (contractId: string, type: string, iso: string, extra: { amount?: number; voids?: string; id?: string } = {}) => {
  seq += 1;
  const id = extra.id ?? `ev${seq}`;
  await client.execute({
    sql: `INSERT INTO production_contract_events (id, contract_id, seq, type, amount, occurred_at, recorded_at, actor, voids_event_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'admin:test', ?)`,
    args: [id, contractId, seq, type, extra.amount ?? null, EPOCH(iso), EPOCH(iso), extra.voids ?? null],
  });
  return id;
};

const contract = async (kind: 'mixmaster' | 'single') => {
  const terms = buildDefaultProductionTerms(kind);
  const created = await createProductionContract({
    kind,
    title: `${kind} 계약`,
    clientName: '홍길동',
    clientStageName: null,
    clientEmail: 'a@b.c',
    clientPhone: '010-1234-5678',
    guardian: null,
    terms,
  });
  await client.execute({ sql: "UPDATE production_contracts SET status = 'signed', signed_at = ? WHERE id = ?", args: [EPOCH('2026-10-01T01:00:00Z'), created.id] });
  return created.id;
};

const OCT = { from: new Date('2026-09-30T15:00:00Z'), toExclusive: new Date('2026-10-31T15:00:00Z') };

describe('제작·믹싱 계약 매출', () => {
  it('입금 기록 하나가 매출 한 행 — 믹싱·마스터링은 믹싱, 제작은 음원 제작 유형, 부가세는 역산', async () => {
    const mix = await contract('mixmaster');
    const prod = await contract('single');
    await event(mix, 'payment_received', '2026-10-02T03:00:00Z', { amount: 300_000 });
    await event(prod, 'payment_received', '2026-10-03T03:00:00Z', { amount: 575_000 });
    await event(prod, 'payment_received', '2026-11-03T03:00:00Z', { amount: 575_000 }); // 기간 밖

    const rows = await loadProductionRevenueRows(OCT);
    expect(rows.map((r) => [r.type, r.gross, r.vat])).toEqual(
      expect.arrayContaining([
        ['mixing', 300_000, 27_273],
        ['production', 575_000, 52_273],
      ]),
    );
    expect(rows).toHaveLength(2);
    const summary = summarizeRevenue(rows, { year: 2026, month: 10 });
    expect(summary.totals.net).toBe(875_000);
    expect(summary.byGroup.find((g) => g.group === 'direct')?.totals.net).toBe(875_000);
  });

  it('무효 처리한 입금 기록은 빼고, 환불 송금을 마친 해지 계약은 환불액을 늦은 입금부터 뺀다', async () => {
    const id = await contract('mixmaster');
    const wrong = await event(id, 'payment_received', '2026-10-05T03:00:00Z', { amount: 300_000 });
    await event(id, 'void', '2026-10-05T04:00:00Z', { voids: wrong });
    await event(id, 'payment_received', '2026-10-06T03:00:00Z', { amount: 300_000 });
    expect((await loadProductionRevenueRows(OCT)).filter((r) => r.note === 'mixmaster 계약' && r.at.getUTCDate() >= 5)).toHaveLength(1);

    // 착수 전 해지 → 받은 금액 전액 환불, 송금 완료.
    await client.execute({
      sql: "UPDATE production_contracts SET status = 'terminated', terminated_at = ?, termination_reason = '[의뢰인 사정] 취소' WHERE id = ?",
      args: [EPOCH('2026-10-07T03:00:00Z'), id],
    });
    await client.execute({
      sql: `INSERT INTO refund_accounts (id, order_kind, order_no, bank_name, account_number_enc, account_holder, requested_at, refunded_at)
            VALUES ('ra1', 'production', ?, '국민', 'enc', '홍길동', ?, ?)`,
      args: [id, EPOCH('2026-10-07T03:00:00Z'), EPOCH('2026-10-08T03:00:00Z')],
    });
    const row = (await loadProductionRevenueRows(OCT)).find((r) => r.at.toISOString().startsWith('2026-10-06'));
    expect(row).toMatchObject({ gross: 300_000, refunded: 300_000 });
  });
});
