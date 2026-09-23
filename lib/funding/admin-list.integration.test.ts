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

  it('펀딩 건수와 펀딩 인원을 따로 센다 — 중복 서포터가 인원을 부풀리지 않는다', async () => {
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

  /**
   * 예전 조건은 `pending AND payment_method='bank_transfer'`였다. 무통장입금을 중단한
   * 2026-09-11 이후 그 조합의 새 행은 생길 수 없어서(온라인은 toss 고정, 수기 등록은 항상
   * paid), 목록에 '결제대기' 행이 떠 있어도 요약 타일은 영구히 0건이라고 말했다.
   * 결제수단 필터를 빼고 **살아 있는 토스 홀드까지** 센다.
   */
  it('결제 대기는 결제수단과 무관하게 pending 전부를 센다', async () => {
    await seedPaid(1, 'a', 'pending', 7000); // 레거시 무통장 pending
    await seedPaid(2, 'a', 'paid');
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
    expect(totals.pendingCount).toBe(2);
    expect(totals.pendingAmount).toBe(12_000);
  });

  /**
   * 수기 등록(오프라인 현금 후원)은 연락처 칸이 비면 플레이스홀더가 들어간다. 신원 키를
   * 이메일+전화로만 만들면 그 건들이 전부 한 사람으로 뭉쳐, 부스에서 받은 30건이
   * "확정 30건 / 후원자 1명"이 된다. 플레이스홀더는 '신원 불명'이지 '같은 사람'이 아니다.
   */
  it('연락처 없는 수기 등록은 주문 단위로 센다 — 인원이 1명으로 붕괴하지 않는다', async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedPaid(i, 'a', 'paid', 5000, 'manual@studionol.co.kr', '-');
    }
    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(5);
    expect(totals.confirmedPersonCount).toBe(5);
  });

  // customerPhone은 `?? '-'`라 빈 문자열을 통과시킨다 — 그 경로도 같이 떨어뜨린다.
  it('전화가 빈 문자열인 수기 등록도 주문 단위로 센다', async () => {
    for (let i = 0; i < 3; i += 1) await seedPaid(i, 'a', 'paid', 5000, 'manual@studionol.co.kr', '');
    expect((await aggregateAdminFundingTotals('a')).confirmedPersonCount).toBe(3);
  });

  // 보관 기간이 지나 이름·연락처·이메일이 표식으로 덮인 주문. 표식은 "신원 불명"이지
  // "같은 사람"이 아니다 — 합치면 확정 4건이 "후원자 1명"이 된다.
  it('파기된 주문도 주문 단위로 센다', async () => {
    for (let i = 0; i < 4; i += 1) await seedPaid(i, 'a', 'paid', 5000, '(개인정보 파기됨)', '(개인정보 파기됨)');
    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(4);
    expect(totals.confirmedPersonCount).toBe(4);
  });

  // 반대로 진짜 연락처를 적어 준 수기 등록은 평소대로 중복이 합쳐져야 한다.
  it('연락처가 있는 건은 여전히 이메일+전화로 중복을 제거한다', async () => {
    await seedPaid(1, 'a', 'paid', 5000, 'real@example.com', '010-7777');
    await seedPaid(2, 'a', 'paid', 5000, 'real@example.com', '010-7777');
    await seedPaid(3, 'a', 'paid', 5000, 'manual@studionol.co.kr', '-');
    const totals = await aggregateAdminFundingTotals('a');
    expect(totals.confirmedCount).toBe(3);
    expect(totals.confirmedPersonCount).toBe(2); // 실명 1 + 수기 1
  });

  it('slug 필터가 DB에서 걸린다 — 프로젝트 탭의 숫자와 목록이 같은 모집단이어야 한다', async () => {
    await seedPaid(1, 'a');
    await seedPaid(2, 'a');
    await seedPaid(1, 'b');

    expect((await aggregateAdminFundingTotals('a')).confirmedCount).toBe(2);
    expect((await aggregateAdminFundingTotals('b')).confirmedCount).toBe(1);
    expect((await aggregateAdminFundingTotals(null)).confirmedCount).toBe(3);
  });

  it('펀딩이 하나도 없으면 0으로 떨어진다 (SUM의 NULL이 새지 않는다)', async () => {
    const totals = await aggregateAdminFundingTotals(null);
    expect(totals).toEqual({
      confirmedAmount: 0, confirmedCount: 0, confirmedPersonCount: 0, pendingAmount: 0, pendingCount: 0,
    });
  });
});

/**
 * 품절 경합 잔해(pledge 없는 type='funding' 주문)가 201 상한 **안에서** 걸러지는지.
 *
 * 예전엔 201로 자른 뒤 JS에서 버려서, 창 안에 그런 행이 k건이면 반환 길이가 201−k가 되고
 * 화면의 `truncated: orders.length > 200`이 k≥1이면 false가 됐다. 후원 300건짜리
 * 프로젝트에서도 '최근 200건만 표시' 배너가 안 떠서 운영자가 화면의 200건 미만을 전량으로
 * 믿게 된다.
 */
it('pledge 없는 주문이 섞여 있어도 201건 잘림 판정이 어긋나지 않는다', async () => {
  const now = NOW;
  // 품절 경합 잔해 — createFundingPledge가 남기는 것과 같은 모양(orders만 failed).
  for (let i = 0; i < 5; i += 1) {
    await client.execute({
      sql: `INSERT INTO orders (id, order_no, type, status, customer_name, customer_phone, customer_email,
              manage_token, item_amount, vat_amount, total_amount, created_at, updated_at)
            VALUES (?,?,'funding','failed','김후원','010-9','x@example.com',?,4546,454,5000, unixepoch(), unixepoch())`,
      args: [`orphan-${i}`, `FND-ORPHAN-${i}`, `tok-orphan-${i}`],
    });
  }
  for (let i = 0; i < 201; i += 1) {
    await createFundingPledge(
      payloadFor({ customerEmail: `t${i}@example.com`, customerPhone: `010-9${i}` }),
      PROJECT_A, reward(PROJECT_A), now,
    );
  }

  const rows = await listFundingOrders(null);
  // 상한이 201이므로 '더 있다'는 신호(길이 > 200)가 잔해 때문에 꺼지면 안 된다.
  expect(rows.length).toBe(201);
  expect(rows.every((o) => o.fundingPledge)).toBe(true);
});
