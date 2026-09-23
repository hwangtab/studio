/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import {
  buildFundingPayoutPreview,
  computeFundingPayout,
  countPendingFundingPayouts,
  listFundingPayouts,
  markFundingPayoutPaid,
  recordFundingPayout,
} from './payout';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const PAYOUT_ACCOUNT = { payoutBankName: '국민은행', payoutAccount: '123-45-6789', payoutHolder: '홍길동' };

let seq = 0;

const seedProject = async (
  over: Partial<schema.NewFundingProjectRow> = {},
  creatorOver: Partial<schema.NewFundingCreator> = {},
) => {
  seq += 1;
  const [creator] = await mockDb
    .insert(schema.fundingCreators)
    .values({ email: `c${seq}@example.com`, name: '개설자', taxType: 'withholding', ...PAYOUT_ACCOUNT, ...creatorOver })
    .returning();
  const [project] = await mockDb
    .insert(schema.fundingProjects)
    .values({
      slug: `demo-${seq}`,
      creatorId: creator.id,
      title: '제목',
      summary: '요약',
      content: '본문',
      coverUrl: '/images/funding/demo/cover.webp',
      goalAmount: 1_000_000,
      // 기본값은 **이미 끝난** 모금 — 기록 경로를 검사하는 테스트가 대부분이다.
      startAt: new Date('2026-01-01T00:00:00Z'),
      endAt: new Date('2026-02-01T00:00:00Z'),
      reviewStatus: 'approved',
      status: 'auto',
      ...over,
    })
    .returning();
  return { creator, project };
};

/** 후원 1건 = 주문 1건. online이면 payments 행까지 만든다(환불은 그 행에만 달 수 있다). */
const seedPledge = async (
  slug: string,
  amount: number,
  opts: { entrySource?: 'online' | 'manual'; status?: 'paid' | 'partially_refunded' | 'pending' | 'refunded'; refund?: number } = {},
) => {
  seq += 1;
  const entrySource = opts.entrySource ?? 'online';
  const [order] = await mockDb
    .insert(schema.orders)
    .values({
      orderNo: `FND-${seq}`,
      type: 'funding',
      customerName: '후원자',
      customerPhone: `010-0000-${String(seq).padStart(4, '0')}`,
      customerEmail: `b${seq}@example.com`,
      itemAmount: amount,
      vatAmount: 0,
      totalAmount: amount,
      status: opts.status ?? 'paid',
      manageToken: `tok-${seq}`,
    })
    .returning();
  await mockDb.insert(schema.fundingPledges).values({
    orderId: order.id,
    projectSlug: slug,
    rewardId: 'mp3',
    rewardTitle: 'MP3',
    unitAmount: amount,
    quantity: 1,
    paymentMethod: entrySource === 'manual' ? 'bank_transfer' : 'toss',
    holdExpiresAt: new Date('2026-01-02T00:00:00Z'),
    paidAt: new Date('2026-01-02T00:00:00Z'),
    entrySource,
  });
  if (entrySource === 'online') {
    const [payment] = await mockDb
      .insert(schema.payments)
      .values({ orderId: order.id, paymentKey: `pk-${seq}` })
      .returning();
    if (opts.refund) {
      await mockDb
        .insert(schema.refunds)
        .values({ paymentId: payment.id, amount: opts.refund, reason: '고객 요청', requestedBy: 'customer', status: 'done' });
    }
  }
  return order;
};

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
});

afterEach(() => client.close());

describe('buildFundingPayoutPreview', () => {
  it('확정 후원 합계와 계산 결과를 돌려준다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 600_000);
    await seedPledge(project.slug, 400_000);

    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview).not.toBeNull();
    expect(preview!.grossAmount).toBe(1_000_000);
    expect(preview!.refundAmount).toBe(0);
    expect(preview!.backerCount).toBe(2);
    expect(preview!.manualGrossAmount).toBe(0);
    expect(preview!.recorded).toBeNull();
    // Task 1의 순수 함수와 같은 숫자여야 한다.
    expect(preview!.netAmount).toBe(
      computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' }).netAmount,
    );
  });

  it('살아 있지 않은 주문(pending·refunded)은 세지 않는다 — 공개 집계와 같은 상태 집합', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 100_000);
    await seedPledge(project.slug, 100_000, { status: 'pending' });
    await seedPledge(project.slug, 100_000, { status: 'refunded' });

    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview!.grossAmount).toBe(100_000);
    expect(preview!.backerCount).toBe(1);
  });

  it('done 환불이 refundAmount로 빠지고 정산 대상 금액을 줄인다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000, { status: 'partially_refunded', refund: 200_000 });

    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview!.grossAmount).toBe(1_000_000);
    expect(preview!.refundAmount).toBe(200_000);
    expect(preview!.shareAmount).toBe(
      computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 200_000, taxType: 'withholding' }).shareAmount,
    );
  });

  it('수기 등록 몫에는 결제 수수료를 매기지 않는다 — 토스를 지나지 않은 돈이다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 500_000);
    await seedPledge(project.slug, 500_000, { entrySource: 'manual' });

    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview!.grossAmount).toBe(1_000_000);
    expect(preview!.manualGrossAmount).toBe(500_000);
    // 플랫폼 수수료는 전액 기준, 결제 수수료는 온라인 50만원 기준.
    const all = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' });
    const online = computeFundingPayout({ grossAmount: 500_000, refundAmount: 0, taxType: 'withholding' });
    expect(preview!.platformFeeAmount).toBe(all.platformFeeAmount);
    expect(preview!.paymentFeeAmount).toBe(online.paymentFeeAmount);
    expect(preview!.feeAmount).toBe(preview!.platformFeeAmount + preview!.paymentFeeAmount);
    expect(preview!.shareAmount).toBe(1_000_000 - preview!.feeAmount);
  });

  it('없는 프로젝트는 null', async () => {
    expect(await buildFundingPayoutPreview('nope')).toBeNull();
  });
});

describe('recordFundingPayout', () => {
  it('미리보기 숫자를 고정해 기록한다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);

    const result = await recordFundingPayout(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' });
    expect(result.payout.grossAmount).toBe(1_000_000);
    expect(result.payout.platformFeeAmount).toBe(expected.platformFeeAmount);
    expect(result.payout.paymentFeeAmount).toBe(expected.paymentFeeAmount);
    expect(result.payout.netAmount).toBe(expected.netAmount);
    expect(result.payout.status).toBe('pending');
  });

  it('프로젝트당 한 번만 — 두 번째는 already_recorded', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    await recordFundingPayout(project.id, new Date('2026-02-20T00:00:00Z'));
    const second = await recordFundingPayout(project.id, new Date('2026-02-21T00:00:00Z'));
    expect(second).toEqual({ ok: false, code: 'already_recorded' });
  });

  it('모금이 진행 중이면 거부한다 — nothing_to_pay와 다른 코드', async () => {
    const { project } = await seedProject({
      startAt: new Date('2020-01-01T00:00:00Z'),
      endAt: new Date('2999-01-01T00:00:00Z'),
    });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordFundingPayout(project.id, new Date())).toEqual({ ok: false, code: 'not_closed' });
  });

  it('개설자 계좌 정보가 없으면 거부한다', async () => {
    const { project } = await seedProject({}, { payoutAccount: null });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordFundingPayout(project.id, new Date())).toEqual({ ok: false, code: 'no_payout_account' });
  });

  it('받은 돈이 없으면 nothing_to_pay', async () => {
    const { project } = await seedProject();
    expect(await recordFundingPayout(project.id, new Date())).toEqual({ ok: false, code: 'nothing_to_pay' });
  });

  it('없는 프로젝트는 not_found', async () => {
    expect(await recordFundingPayout('nope', new Date())).toEqual({ ok: false, code: 'not_found' });
  });

  it('기록 뒤에 환불이 들어와도 기록된 숫자는 변하지 않는다', async () => {
    const { project } = await seedProject();
    const order = await seedPledge(project.slug, 1_000_000);
    const recorded = await recordFundingPayout(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(recorded.ok).toBe(true);

    const payment = await mockDb.query.payments.findFirst({ where: (t, { eq }) => eq(t.orderId, order.id) });
    await mockDb
      .insert(schema.refunds)
      .values({ paymentId: payment!.id, amount: 300_000, reason: '늦은 환불', requestedBy: 'admin', status: 'done' });

    const preview = await buildFundingPayoutPreview(project.id);
    // 미리보기는 새 환불을 반영하지만, 기록은 그 시점 숫자를 그대로 들고 있다.
    expect(preview!.refundAmount).toBe(300_000);
    expect(preview!.recorded!.refundAmount).toBe(0);
    expect(preview!.recorded!.grossAmount).toBe(1_000_000);
  });
});

describe('markFundingPayoutPaid', () => {
  it('pending → paid 한 방향, 두 번째는 실패', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    const result = await recordFundingPayout(project.id, new Date('2026-02-20T00:00:00Z'));
    if (!result.ok) throw new Error('기록 실패');

    expect(await countPendingFundingPayouts()).toBe(1);
    expect(await markFundingPayoutPaid(result.payout.id, '이체 완료', new Date('2026-02-21T00:00:00Z'))).toBe(true);
    expect(await markFundingPayoutPaid(result.payout.id, '또 눌렀다', new Date('2026-02-22T00:00:00Z'))).toBe(false);

    const [row] = await listFundingPayouts();
    expect(row.status).toBe('paid');
    expect(row.memo).toBe('이체 완료');
    expect(await countPendingFundingPayouts()).toBe(0);
  });
});
