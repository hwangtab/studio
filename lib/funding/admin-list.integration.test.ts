/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { aggregateAdminFundingTotals, listFundingOrders } from './admin-list';
// eslint-disable-next-line import/first
import { createFundingPledge } from './service';
// eslint-disable-next-line import/first
import { parseFundingProject } from './projects';
// eslint-disable-next-line import/first
import type { CreatePledgePayload } from './validation';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
const NOW = new Date('2026-10-15T03:00:00Z');
let client: Client;

const project = (slug: string) => parseFundingProject(`---
slug: ${slug}
title: ${slug}
summary: 요약
cover: /c.webp
goalAmount: 100000
startAt: 2026-10-01T10:00:00+09:00
endAt: 2026-10-31T23:59:59+09:00
rewards:
  - id: mail
    title: 감사 메일
    description: d
    amount: 5000
    requiresShipping: false
    estimatedDelivery: 2026-11
---
`, slug);

const PROJECT_A = project('a');
const PROJECT_B = project('b');

const payloadFor = (over: Partial<CreatePledgePayload> = {}): CreatePledgePayload => ({
  projectSlug: 'a', rewardId: 'mail', quantity: 1, additionalAmount: 0, paymentMethod: 'toss',
  customerName: '김후원', customerPhone: '010-1111-2222', customerEmail: 'a@example.com',
  displayNamePublic: true, termsAgreed: true, ...over,
});

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
beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM payments');
  await client.execute('DELETE FROM orders');
});

const reward = (p: typeof PROJECT_A) => p.rewards.find((r) => r.id === 'mail')!;

it('slug 필터가 DB 쪽에서 걸려 201건 잘림 이전에 정확한 건수만 돌아온다', async () => {
  await createFundingPledge(payloadFor({ customerEmail: 'a1@example.com', customerPhone: '010-0001' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ customerEmail: 'a2@example.com', customerPhone: '010-0002' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ customerEmail: 'a3@example.com', customerPhone: '010-0003' }), PROJECT_A, reward(PROJECT_A), NOW);
  await createFundingPledge(payloadFor({ projectSlug: 'b', customerEmail: 'b1@example.com', customerPhone: '010-0004' }), PROJECT_B, reward(PROJECT_B), NOW);
  await createFundingPledge(payloadFor({ projectSlug: 'b', customerEmail: 'b2@example.com', customerPhone: '010-0005' }), PROJECT_B, reward(PROJECT_B), NOW);

  const all = await listFundingOrders(null);
  expect(all).toHaveLength(5);

  const onlyB = await listFundingOrders('b');
  expect(onlyB).toHaveLength(2);
  expect(onlyB.every((o) => o.fundingPledge?.projectSlug === 'b')).toBe(true);
});


/**
 * 상단 KPI가 목록(최대 200건)에서 합산되던 시절의 재현. 201건을 넘기는 순간 관리자 수치가
 * 공개 진행률(aggregateProjectStatus — SQL 집계)과 갈라졌고, 캠페인이 성공할수록 오차가
 * 커졌다. 집계는 목록 상한과 무관해야 한다.
 */
describe('aggregateAdminFundingTotals — 목록 상한과 무관한 전건 집계', () => {
  const seedPaid = async (i: number, slug = 'a', status = 'paid', amount = 5000, email = `p${i}@example.com`, phone = `010-${i}`) => {
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
            item_amount, vat_amount, total_amount, manage_token) VALUES (?,?,'funding',?,'김',?,?,?,?,?,?)`,
      args: [`o${slug}${i}`, `FND-${slug}-${i}`, status, phone, email, amount - 455, 455, amount, `tok-${slug}-${i}`],
    });
    await client.execute({
      sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
            quantity, additional_amount, payment_method, hold_expires_at)
            VALUES (?,?,?,'mail','감사 메일',5000,1,0,?,9999999999)`,
      args: [`fp${slug}${i}`, `o${slug}${i}`, slug, status === 'pending' ? 'bank_transfer' : 'toss'],
    });
  };

  it('201건을 넘겨도 확정 금액·건수가 전건 기준이다 (목록은 201건에서 잘린다)', async () => {
    for (let i = 0; i < 250; i += 1) await seedPaid(i);

    // 목록은 여전히 잘린다 — 그 상한이 지표에 새면 안 된다는 게 이 테스트의 요점이다.
    expect(await listFundingOrders('a')).toHaveLength(201);

    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(250);
    expect(totals.confirmedAmount).toBe(250 * 5000);
    // 예전 화면이 내던 값(최근 200건 합산)과 다르다는 것까지 못 박는다.
    expect(totals.confirmedAmount).not.toBe(200 * 5000);
  });

  it('후원 건수와 후원 인원을 따로 센다 — 중복 후원자가 인원을 부풀리지 않는다', async () => {
    // 같은 사람(이메일+전화 동일)이 3번 후원하고, 다른 사람이 1번.
    for (let i = 0; i < 3; i += 1) await seedPaid(i, 'a', 'paid', 5000, 'same@example.com', '010-9999');
    await seedPaid(9, 'a', 'paid', 5000, 'other@example.com', '010-1234');

    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(4); // 건수
    expect(totals.confirmedPersonCount).toBe(2); // 인원
  });

  it('부분환불은 확정에 포함하고, 그 밖의 상태는 뺀다 (공개 집계와 같은 집합)', async () => {
    await seedPaid(1, 'a', 'paid');
    await seedPaid(2, 'a', 'partially_refunded');
    await seedPaid(3, 'a', 'refunded');
    await seedPaid(4, 'a', 'expired');

    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(2);
    expect(totals.confirmedAmount).toBe(10_000);
  });

  it('입금 대기는 무통장 pending만 센다', async () => {
    await seedPaid(1, 'a', 'pending', 7000); // bank_transfer
    await seedPaid(2, 'a', 'paid');
    // 토스 pending은 입금 대기가 아니다 — 결제창을 닫은 홀드다.
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
            item_amount, vat_amount, total_amount, manage_token)
            VALUES ('ot','FND-a-t','funding','pending','김','010-t','t@example.com',4545,455,5000,'tok-t')`,
    });
    await client.execute({
      sql: `INSERT INTO funding_pledges (id, order_id, project_slug, reward_id, reward_title, unit_amount,
            quantity, additional_amount, payment_method, hold_expires_at)
            VALUES ('fpt','ot','a','mail','감사 메일',5000,1,0,'toss',9999999999)`,
    });

    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.pendingCount).toBe(1);
    expect(totals.pendingAmount).toBe(7000);
  });

  it('slug 필터가 DB에서 걸린다 — 프로젝트 탭의 숫자와 목록이 같은 모집단이어야 한다', async () => {
    await seedPaid(1, 'a');
    await seedPaid(2, 'a');
    await seedPaid(1, 'b');

    expect((await aggregateAdminFundingTotals('a')).confirmedCount).toBe(2);
    expect((await aggregateAdminFundingTotals('b')).confirmedCount).toBe(1);
    expect((await aggregateAdminFundingTotals(null)).confirmedCount).toBe(3);
  });

  it('후원이 하나도 없으면 0으로 떨어진다 (SUM의 NULL이 새지 않는다)', async () => {
    const totals = await aggregateAdminFundingTotals(null);
    expect(totals).toEqual({
      confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0,
    });
  });
});
