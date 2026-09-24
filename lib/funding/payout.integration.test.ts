/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { encryptField, encryptFieldWithKey, FIELD_CRYPTO_KEY_ENV } from '../crypto/fieldCrypto';
import { encryptPayoutAccount } from './payoutAccountCrypto';
// eslint-disable-next-line import/first
import {
  buildFundingPayoutPreview,
  computeFundingPayout,
  countPendingFundingPayouts,
  markFundingPayoutPaid,
  recordFundingPayout,
} from './payout';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;


/**
 * 원천징수 개설자의 기본 상태는 "주민등록번호가 등록돼 있다"이다 — 안 그러면 기록 경로를
 * 보는 테스트가 전부 `no_resident_number`에서 멈춘다.
 *
 * **형식만 흉내 낸 문자열로는 안 된다.** `recordFundingPayout`이 기록 직전에 실제로 한 번
 * 열어 보고 성공 여부만 확인하기 때문이다(`resident_number_unreadable`). 그래서 테스트 전용
 * 키로 진짜 암호화한 값을 쓴다. 아래 번호는 형식만 맞춘 임의의 값이다.
 */
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');
process.env[FIELD_CRYPTO_KEY_ENV] = TEST_KEY;
const RESIDENT_NUMBER_ENC = encryptField('9901011234567');

/**
 * 계좌도 같은 이유로 **진짜 암호화한 값**이다 — 기록 직전에 한 번 열어 보고 성공 여부만
 * 확인하기 때문이다(`payout_account_unreadable`). 뒤 4자리는 평문 컬럼이라 그대로 적는다.
 */
const PAYOUT_ACCOUNT = {
  payoutAccountEnc: encryptPayoutAccount({ bankName: '국민은행', account: '123-45-6789', holder: '홍길동' }),
  payoutAccountLast4: '6789',
};

let seq = 0;

const seedProject = async (
  over: Partial<schema.NewFundingProjectRow> = {},
  creatorOver: Partial<schema.NewFundingCreator> = {},
) => {
  seq += 1;
  const [creator] = await mockDb
    .insert(schema.fundingCreators)
    .values({
      email: `c${seq}@example.com`,
      name: '개설자',
      taxType: 'withholding',
      residentNumberEnc: RESIDENT_NUMBER_ENC,
      ...PAYOUT_ACCOUNT,
      ...creatorOver,
    })
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

/**
 * 관리자 화면과 같은 순서로 기록한다 — 미리보기로 실이체액을 읽고(화면이 그 숫자를
 * 확인창에 적는다) 그 값을 그대로 확인 금액으로 보낸다. 그 사이에 아무 일도 안 일어나면
 * 서버의 재계산과 같으므로 그대로 통과한다.
 */
const recordAsAdmin = async (projectId: string, now: Date) => {
  const preview = await buildFundingPayoutPreview(projectId);
  return recordFundingPayout(projectId, now, preview?.netAmount ?? 0);
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

    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
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
    await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    const second = await recordAsAdmin(project.id, new Date('2026-02-21T00:00:00Z'));
    expect(second).toEqual({ ok: false, code: 'already_recorded' });
  });

  it('모금이 진행 중이면 거부한다 — nothing_to_pay와 다른 코드', async () => {
    const { project } = await seedProject({
      startAt: new Date('2020-01-01T00:00:00Z'),
      endAt: new Date('2999-01-01T00:00:00Z'),
    });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'not_closed' });
  });

  it('개설자 계좌 정보가 없으면 거부한다', async () => {
    const { project } = await seedProject({}, { payoutAccountEnc: null });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'no_payout_account' });
  });

  it('세금 처리 구분이 없으면 거부한다 — 추측해서 기록하지 않는다', async () => {
    // 회귀: 게이트가 계좌 세 칸만 보고 taxType은 `?? 'withholding'`으로 메우던 시절엔,
    // 사업자 개설자에게도 원천징수를 뗀 금액이 기록됐다. 이 표는 불변이라 되돌릴 수 없다.
    const { project } = await seedProject({}, { taxType: null });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'no_tax_type' });
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  /**
   * 세액만 떼고 지급명세서를 못 내는 상태를 만들지 않는다 — 간이지급명세서가 소득자별
   * 주민등록번호를 요구한다. 이 표는 불변이라 기록한 뒤에는 되돌릴 경로가 없다.
   */
  it('원천징수 대상인데 주민등록번호가 없으면 거부한다', async () => {
    const { project } = await seedProject({}, { residentNumberEnc: null });
    await seedPledge(project.slug, 1_000_000);
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'no_resident_number' });
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  /**
   * 암호문 존재만 보면 키를 잃은 환경에서도 기록 버튼이 살아 있어, 세액을 떼고 **불변으로
   * 기록한 뒤에야** 조회에서 실패를 만난다. 되돌릴 경로가 없는 표라 그 순서는 감수할 수 없다.
   */
  it('암호문은 있는데 지금 키로 열리지 않으면 거부한다 — 기록은 남지 않는다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 9).toString('base64');
    try {
      // 계좌가 먼저 걸린다 — 돈을 보낼 곳을 읽지 못하는 것이 더 앞선 문제다.
      expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'payout_account_unreadable' });
    } finally {
      process.env[FIELD_CRYPTO_KEY_ENV] = TEST_KEY;
    }
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  it('키가 아예 없어도 거부한다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    delete process.env[FIELD_CRYPTO_KEY_ENV];
    try {
      expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'payout_account_unreadable' });
    } finally {
      process.env[FIELD_CRYPTO_KEY_ENV] = TEST_KEY;
    }
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  /**
   * 계좌는 열리는데 주민등록번호만 안 열리는 경우 — 회전이 한쪽만 끝난 상태에서 실제로
   * 생긴다. 두 코드가 갈려야 운영자가 무엇을 되찾아야 하는지 안다.
   */
  it('계좌는 열리고 주민등록번호만 안 열리면 resident_number_unreadable', async () => {
    const { project } = await seedProject(
      {},
      { residentNumberEnc: encryptFieldWithKey('9901011234567', Buffer.alloc(32, 9)) },
    );
    await seedPledge(project.slug, 1_000_000);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'resident_number_unreadable' });
    error.mockRestore();
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  /** 계좌가 안 열리는 것과 아예 없는 것은 다른 코드다 — 운영자가 할 일이 정반대다. */
  it('계좌가 안 열리는 것과 없는 것을 가른다', async () => {
    const { project } = await seedProject({}, { payoutAccountEnc: 'v1:deadbeef:deadbeef:deadbeef' });
    await seedPledge(project.slug, 1_000_000);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'payout_account_unreadable' });
    error.mockRestore();
  });

  it('사업자는 주민등록번호가 없어도 기록된다 — 원천징수를 하지 않으므로 해당이 없다', async () => {
    const { project } = await seedProject({}, { taxType: 'invoice', residentNumberEnc: null });
    await seedPledge(project.slug, 1_000_000);
    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payout.withholdingAmount).toBe(0);
  });

  it('미리보기는 등록 여부만 드러낸다 — 암호문도 평문도 싣지 않는다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview!.hasResidentNumber).toBe(true);
    expect(JSON.stringify(preview)).not.toContain(RESIDENT_NUMBER_ENC);
  });

  it('세금 처리 구분이 없어도 미리보기는 나온다 — taxType은 null로 드러난다', async () => {
    const { project } = await seedProject({}, { taxType: null });
    await seedPledge(project.slug, 1_000_000);
    const preview = await buildFundingPayoutPreview(project.id);
    expect(preview!.taxType).toBeNull();
    // 가정은 원천징수(실이체액을 적게 잡는 쪽)다.
    expect(preview!.withholdingAmount).toBe(
      computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 0, taxType: 'withholding' }).withholdingAmount,
    );
  });

  it('받은 돈이 없으면 nothing_to_pay', async () => {
    const { project } = await seedProject();
    expect(await recordAsAdmin(project.id, new Date())).toEqual({ ok: false, code: 'nothing_to_pay' });
  });

  it('없는 프로젝트는 not_found', async () => {
    expect(await recordAsAdmin('nope', new Date())).toEqual({ ok: false, code: 'not_found' });
  });

  it('기록 뒤에 환불이 들어와도 기록된 숫자는 변하지 않는다', async () => {
    const { project } = await seedProject();
    const order = await seedPledge(project.slug, 1_000_000);
    const recorded = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
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

  /**
   * 회귀: 확인창은 페이지를 띄운 시점의 실이체액을 말하는데 서버는 누른 시점에 다시
   * 계산해 INSERT한다. 그 사이에 환불이 한 건 done이 되면 운영자가 승인한 것과 다른
   * 숫자가 불변 표에 굳어버렸다. 이제는 INSERT 없이 거부한다.
   */
  it('페이지를 띄운 뒤 환불이 들어오면 기록하지 않는다 — amount_changed', async () => {
    const { project } = await seedProject();
    const order = await seedPledge(project.slug, 1_000_000);

    // 운영자가 화면에서 본 숫자.
    const shown = await buildFundingPayoutPreview(project.id);
    expect(shown!.netAmount).toBe(881_904);

    // 확인창을 띄워 둔 사이에 환불 한 건이 done이 됐다.
    const payment = await mockDb.query.payments.findFirst({ where: (t, { eq }) => eq(t.orderId, order.id) });
    await mockDb
      .insert(schema.refunds)
      .values({ paymentId: payment!.id, amount: 100_000, reason: '후원자 취소', requestedBy: 'customer', status: 'done' });

    const result = await recordFundingPayout(project.id, new Date('2026-02-20T00:00:00Z'), shown!.netAmount);
    const now = computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 100_000, taxType: 'withholding' });
    expect(result).toEqual({
      ok: false,
      code: 'amount_changed',
      expectedNetAmount: 881_904,
      netAmount: now.netAmount,
    });
    expect(now.netAmount).not.toBe(881_904);
    // 가장 중요한 부분 — 아무것도 굳지 않았다.
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  it('확인 금액이 맞으면 그대로 기록한다 — 같은 경로를 다시 누르면 통과', async () => {
    const { project } = await seedProject();
    const order = await seedPledge(project.slug, 1_000_000);
    const payment = await mockDb.query.payments.findFirst({ where: (t, { eq }) => eq(t.orderId, order.id) });
    await mockDb
      .insert(schema.refunds)
      .values({ paymentId: payment!.id, amount: 100_000, reason: '후원자 취소', requestedBy: 'customer', status: 'done' });

    // 새로고침 뒤 다시 검산한 상황.
    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payout.refundAmount).toBe(100_000);
    expect(result.payout.netAmount).toBe(
      computeFundingPayout({ grossAmount: 1_000_000, refundAmount: 100_000, taxType: 'withholding' }).netAmount,
    );
  });
});

describe('markFundingPayoutPaid', () => {
  it('pending → paid 한 방향, 두 번째는 실패', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    if (!result.ok) throw new Error('기록 실패');

    expect(await countPendingFundingPayouts()).toBe(1);
    expect(await markFundingPayoutPaid(result.payout.id, '이체 완료', new Date('2026-02-21T00:00:00Z'))).toBe(true);
    expect(await markFundingPayoutPaid(result.payout.id, '또 눌렀다', new Date('2026-02-22T00:00:00Z'))).toBe(false);

    const [row] = await mockDb.query.fundingProjectPayouts.findMany();
    expect(row.status).toBe('paid');
    expect(row.memo).toBe('이체 완료');
    expect(await countPendingFundingPayouts()).toBe(0);
  });
});

/**
 * 정산 기록은 정산 계좌와(원천징수 대상이면) 주민등록번호를 **실제로 한 번씩 복호화한다**
 * (`payoutAccountReadable`·`residentNumberReadable`). 평문을 화면에 내보내지 않을 뿐 실제
 * 처리라, 관리자 화면의 조회 버튼과 같은 무게로 접속기록에 남아야 한다.
 */
describe('정산 기록 시의 복호화도 접속기록에 남는다', () => {
  const accessLogs = () => mockDb.select().from(schema.privacyAccessLogs);

  it('복호화에 성공하면 성공으로 남는다 — 값은 담기지 않는다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);

    const preview = await buildFundingPayoutPreview(project.id);
    const result = await recordFundingPayout(
      project.id,
      new Date('2026-02-20T00:00:00Z'),
      preview?.netAmount ?? 0,
      '203.0.113.7',
    );
    expect(result.ok).toBe(true);

    const rows = await accessLogs();
    // 계좌 점검 + 주민등록번호 점검 둘 다 남는다.
    expect(rows.map((r) => r.action).sort()).toEqual([
      'funding_payout_account_decrypt_check',
      'funding_resident_number_decrypt_check',
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({ actor: 'admin', targetId: project.id, result: 'success', ip: '203.0.113.7' });
    }
    expect(JSON.stringify(rows)).not.toContain('9901011234567');
    expect(JSON.stringify(rows)).not.toContain(RESIDENT_NUMBER_ENC);
    expect(JSON.stringify(rows)).not.toContain('123-45-6789');
    expect(JSON.stringify(rows)).not.toContain(PAYOUT_ACCOUNT.payoutAccountEnc);
  });

  it('복호화에 실패하면 실패로 남고 정산은 거부된다', async () => {
    const { project } = await seedProject({}, { residentNumberEnc: 'v1:deadbeef:deadbeef:deadbeef' });
    await seedPledge(project.slug, 1_000_000);
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(result).toEqual({ ok: false, code: 'resident_number_unreadable' });

    const rows = await accessLogs();
    // 계좌는 열렸고(success) 주민등록번호에서 막혔다(decrypt_failed).
    expect(rows.map((r) => [r.action, r.result])).toEqual([
      ['funding_payout_account_decrypt_check', 'success'],
      ['funding_resident_number_decrypt_check', 'decrypt_failed'],
    ]);
    // 요청 밖에서 부른 경로라 IP가 없다 — 지어내지 않는다.
    expect(rows[1].ip).toBeNull();
    error.mockRestore();
  });

  /**
   * 조회 자체가 실패하는 갈래도 남아야 한다. 예전엔 이 select가 던지면 기록 호출이 한 번도
   * 일어나지 않고 예외만 위로 올라가, 처리방침 15·19항의 "성공·실패를 가리지 않고 남긴다"가
   * 이 경로에서만 거짓이었다(호출하는 라우트 둘은 catch에서 'error'를 남긴다).
   */
  it('조회가 실패하면 error로 남고 예외는 그대로 올라간다', async () => {
    const { project } = await seedProject();
    await seedPledge(project.slug, 1_000_000);
    const healthy = mockDb;
    // 복호화 점검의 select만 골라 던지게 한다 — `{ enc }` 한 컬럼만 고르는 조회는 이것뿐이다.
    mockDb = new Proxy(healthy, {
      get(target, prop, receiver) {
        if (prop !== 'select') return Reflect.get(target, prop, receiver);
        return (fields?: Record<string, unknown>) => {
          if (fields && Object.keys(fields).join() === 'enc') throw new Error('DB 장애');
          return (target as unknown as { select: (f?: unknown) => unknown }).select(fields);
        };
      },
    }) as typeof mockDb;

    try {
      await expect(recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'))).rejects.toThrow('DB 장애');
    } finally {
      mockDb = healthy;
    }

    const rows = await accessLogs();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      // 계좌 점검이 먼저라 여기서 먼저 터진다 — 두 점검이 같은 `{ enc }` 모양으로 조회한다.
      action: 'funding_payout_account_decrypt_check',
      targetId: project.id,
      result: 'error',
    });
    // 기록은 남되 정산은 기록되지 않는다 — 번호를 열 수 있는지 확인하지 못했다.
    expect(await mockDb.query.fundingProjectPayouts.findMany()).toHaveLength(0);
  });

  /**
   * 사업자(`invoice`)는 주민등록번호를 열지 않는다 — 열지 않은 것을 기록하면 거짓이다.
   * 계좌는 세금 구분과 무관하게 열어 보므로 그쪽 기록은 남는다.
   */
  it('원천징수 대상이 아니면 주민등록번호 복호화도 그 기록도 없다', async () => {
    const { project } = await seedProject({}, { taxType: 'invoice' });
    await seedPledge(project.slug, 1_000_000);

    const result = await recordAsAdmin(project.id, new Date('2026-02-20T00:00:00Z'));
    expect(result.ok).toBe(true);
    expect((await accessLogs()).map((r) => r.action)).toEqual(['funding_payout_account_decrypt_check']);
  });
});
