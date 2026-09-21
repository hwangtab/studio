/** @jest-environment node */

/**
 * 펀딩 개인정보 파기 로직을 실제 SQLite(in-memory)에서 검증한다.
 *
 * 계약서 쪽 `lib/contracts/retention.test.ts`와 같은 이유로 실 DB를 쓴다 — COALESCE·
 * 날짜 비교가 실제로 어떻게 도는지는 모킹으로 알 수 없다.
 *
 * 핵심 불변식: 기산점은 `deliveredAt`(리워드 전달 완료)이고, 법정 보존(5년, `paidAt` 기준)이
 * 지나기 전에는 1년이 지났어도 파기하지 않는다. 파기는 행 삭제가 아니라 배송지·admin_memo
 * 필드만 NULL로 비운다 — `orders.customer_name` 등은 건드리지 않는다(공유 테이블 + 5년
 * 법정 보존 기록이라 이 작업의 범위 밖).
 */

import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';
import { fundingPledges, orders } from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

// eslint-disable-next-line import/first
import { purgeExpiredFundingPersonalData, REWARD_RETENTION_YEARS } from './retention';
// eslint-disable-next-line import/first
import { PRIVACY_RETENTION_TEXT } from './policy';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

// 파기 판정의 기준 시각. 1년 boundary = 2025-08-24T18:00:00Z, 5년 boundary = 2021-08-24T18:00:00Z.
const NOW = new Date('2026-08-24T18:00:00.000Z');
/** 경계 테스트에서 법정 보존(5년)이 항상 이미 지난 것으로 두기 위한 고정 결제일. */
const WELL_BEYOND_LEGAL_HOLD = '2000-01-01';

let seq = 0;
const addPledge = async (opts: {
  id: string;
  deliveredAt?: string | Date | null;
  paidAt?: string | null;
  createdAt?: string;
  shippingName?: string | null;
  adminMemo?: string | null;
  supporterMessage?: string | null;
}) => {
  seq += 1;
  const orderNo = `SNB-TEST-${String(seq).padStart(6, '0')}`;
  const [order] = await mockDb.insert(orders).values({
    orderNo,
    type: 'funding',
    customerName: '김후원',
    customerPhone: '010-1234-5678',
    customerEmail: 'a@example.com',
    itemAmount: 10000,
    vatAmount: 0,
    totalAmount: 10000,
    status: 'paid',
    manageToken: `tok_${opts.id}`,
    createdAt: opts.createdAt ? d(opts.createdAt) : d('2020-01-01'),
  }).returning({ id: orders.id });

  await mockDb.insert(fundingPledges).values({
    id: opts.id,
    orderId: order.id,
    projectSlug: 'demo',
    rewardId: 'cd',
    rewardTitle: 'CD',
    unitAmount: 10000,
    quantity: 1,
    paymentMethod: 'toss',
    holdExpiresAt: d('2020-01-01'),
    paidAt: opts.paidAt === undefined ? d('2020-01-01') : opts.paidAt ? d(opts.paidAt) : null,
    deliveredAt: opts.deliveredAt == null ? null : (opts.deliveredAt instanceof Date ? opts.deliveredAt : d(opts.deliveredAt)),
    shippingName: opts.shippingName === undefined ? '김후원' : opts.shippingName,
    shippingPhone: opts.shippingName === null ? null : '010-1234-5678',
    shippingPostcode: opts.shippingName === null ? null : '12345',
    shippingAddress1: opts.shippingName === null ? null : '서울시 은평구',
    adminMemo: opts.adminMemo === undefined ? null : opts.adminMemo,
    supporterMessage: opts.supporterMessage === undefined ? '함께해 주셔서 고맙습니다' : opts.supporterMessage,
    createdAt: opts.createdAt ? d(opts.createdAt) : d('2020-01-01'),
    updatedAt: d('2020-01-01'),
  });
};

const pledgeOf = async (id: string) =>
  (await mockDb.select().from(fundingPledges).where(eq(fundingPledges.id, id)))[0];

beforeAll(async () => {
  client = createClient({ url: ':memory:' });
  mockDb = drizzle(client, { schema });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
});

beforeEach(async () => {
  await client.execute('DELETE FROM funding_pledges');
  await client.execute('DELETE FROM orders');
  seq = 0;
});

afterAll(() => client.close());

describe('파기 대상 판정', () => {
  it('기산점 없음(deliveredAt null)은 파기하지 않는다', async () => {
    await addPledge({ id: 'not-delivered', deliveredAt: null, paidAt: '2020-01-01' });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(0);
    expect((await pledgeOf('not-delivered')).shippingName).toBe('김후원');
  });

  it('전달 후 1년이 안 지났으면 보관한다', async () => {
    await addPledge({ id: 'young', deliveredAt: '2026-01-01', paidAt: '2020-01-01' });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(0);
    expect((await pledgeOf('young')).shippingName).toBe('김후원');
  });

  it('전달 후 1년이 지나고 법정 보존(5년)도 지났으면 배송지·admin_memo를 파기한다', async () => {
    await addPledge({
      id: 'old',
      deliveredAt: '2024-01-01', // NOW-1년(2025-08-24)보다 앞
      paidAt: '2020-01-01', // NOW-5년(2021-08-24)보다 앞
      adminMemo: '010-1234-5678로 통화, 재발송 요청',
    });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(1);
    const row = await pledgeOf('old');
    expect(row.shippingName).toBeNull();
    expect(row.shippingPhone).toBeNull();
    expect(row.shippingPostcode).toBeNull();
    expect(row.shippingAddress1).toBeNull();
    expect(row.adminMemo).toBeNull();
    expect(row.supporterMessage).toBeNull();
    // 운영 기록으로 남기는 값은 보존 — 모금액 집계에 쓰이는 금액·리워드 정보는 안 건드린다.
    expect(row.unitAmount).toBe(10000);
    expect(row.rewardId).toBe('cd');
    expect(row.deliveredAt).not.toBeNull();
  });

  /**
   * 이 저장소의 핵심 판정. 전달 후 1년이 지났어도, 결제(재화공급 기록)로부터 법정 보존
   * 5년이 아직 안 지났으면 파기하지 않는다. 전자상거래법이 프라이버시 파기 약속보다
   * 우선한다.
   */
  it('전달 후 1년은 지났지만 법정 보존 5년이 안 지났으면 보관한다', async () => {
    await addPledge({
      id: 'legal-hold',
      deliveredAt: '2024-01-01', // 1년 지남
      paidAt: '2023-01-01', // 5년(2021-08-24) 안 지남
    });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(0);
    expect((await pledgeOf('legal-hold')).shippingName).toBe('김후원');
  });

  it('paidAt이 없는 행은 createdAt으로 법정 보존을 판정한다', async () => {
    await addPledge({
      id: 'no-paid-recent',
      deliveredAt: '2024-01-01',
      paidAt: null,
      createdAt: '2023-01-01', // 5년 안 지남 → 보관
    });
    await addPledge({
      id: 'no-paid-old',
      deliveredAt: '2024-01-01',
      paidAt: null,
      createdAt: '2019-01-01', // 5년 지남 → 파기
    });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(1);
    expect((await pledgeOf('no-paid-recent')).shippingName).toBe('김후원');
    expect((await pledgeOf('no-paid-old')).shippingName).toBeNull();
  });

  it('이미 파기된 후원은 다시 파기하지 않는다(idempotent)', async () => {
    await addPledge({ id: 'twice', deliveredAt: '2024-01-01', paidAt: '2020-01-01' });
    const first = await purgeExpiredFundingPersonalData(NOW);
    expect(first.purged).toBe(1);
    const second = await purgeExpiredFundingPersonalData(NOW);
    expect(second.purged).toBe(0);
  });

  it('배송지·admin_memo·응원 메시지가 이미 비어 있던 행은 파기 대상에서 자연히 빠진다', async () => {
    await addPledge({
      id: 'digital',
      deliveredAt: '2024-01-01',
      paidAt: '2020-01-01',
      shippingName: null,
      adminMemo: null,
      supporterMessage: null,
    });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(0);
  });

  /**
   * 응원 메시지도 파기 대상이다 — 처리방침 6항이 "선택" 수집 항목으로 명시하고, 8항의
   * "1년 뒤 파기" 약속은 6항 나열 항목 전부에 걸린다(예외 문구 없음). 서포터 명단 공개
   * 화면이 아직 없어(코드에 확인됨) "공개 게시물이라 보존해야 한다"는 반례도 없다.
   */
  it('응원 메시지도 배송지·admin_memo와 함께 파기한다', async () => {
    await addPledge({
      id: 'has-message',
      deliveredAt: '2024-01-01',
      paidAt: '2020-01-01',
      shippingName: null,
      adminMemo: null,
      supporterMessage: '집회에 함께하지 못해 마음으로 응원합니다',
    });
    const r = await purgeExpiredFundingPersonalData(NOW);
    expect(r.purged).toBe(1);
    expect((await pledgeOf('has-message')).supporterMessage).toBeNull();
  });

  it('orders.customer_name 등 공유 테이블 컬럼은 건드리지 않는다', async () => {
    await addPledge({ id: 'shared-table', deliveredAt: '2024-01-01', paidAt: '2020-01-01' });
    await purgeExpiredFundingPersonalData(NOW);
    const [order] = await mockDb.select().from(orders).where(eq(orders.manageToken, 'tok_shared-table'));
    expect(order.customerName).toBe('김후원');
    expect(order.customerEmail).toBe('a@example.com');
  });

  /**
   * REWARD_RETENTION_YEARS를 1 → 2로 바꿔도 위 케이스들은 전부 초록으로 남는다(시드가
   * 경계에서 너무 멀다). 아래는 정확히 1년 경계를 초 단위로 찌른다 — 이 값이 실제로
   * "1년"을 재는지, 다른 값으로 바뀌면 빨개지는지를 보장한다.
   */
  describe('1년 경계(초 단위)', () => {
    const boundary = new Date(NOW);
    boundary.setFullYear(boundary.getFullYear() - REWARD_RETENTION_YEARS); // 2025-08-24T18:00:00Z

    it('경계 1초 전에 전달된 후원은 파기한다', async () => {
      await addPledge({
        id: 'just-before',
        deliveredAt: new Date(boundary.getTime() - 1000),
        paidAt: WELL_BEYOND_LEGAL_HOLD,
      });
      const r = await purgeExpiredFundingPersonalData(NOW);
      expect(r.purged).toBe(1);
    });

    it('경계와 정확히 같은 시각에 전달된 후원은 아직 보관한다(lt는 미만이지 이하가 아니다)', async () => {
      await addPledge({ id: 'exact', deliveredAt: new Date(boundary.getTime()), paidAt: WELL_BEYOND_LEGAL_HOLD });
      const r = await purgeExpiredFundingPersonalData(NOW);
      expect(r.purged).toBe(0);
    });

    it('경계 1초 후에 전달된 후원은 아직 보관한다', async () => {
      await addPledge({
        id: 'just-after',
        deliveredAt: new Date(boundary.getTime() + 1000),
        paidAt: WELL_BEYOND_LEGAL_HOLD,
      });
      const r = await purgeExpiredFundingPersonalData(NOW);
      expect(r.purged).toBe(0);
    });
  });

  /**
   * REWARD_RETENTION_YEARS와 처리방침 문구(PRIVACY_RETENTION_TEXT)가 같은 값을 말해야
   * 한다는 규칙을 주석이 아니라 테스트로 고정한다. 둘 중 하나만 바꾸면 이 테스트가 빨개진다.
   */
  it('REWARD_RETENTION_YEARS는 PRIVACY_RETENTION_TEXT가 말하는 기간과 같다', () => {
    expect(PRIVACY_RETENTION_TEXT).toContain(`${REWARD_RETENTION_YEARS}년`);
  });
});
