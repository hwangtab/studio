/** @jest-environment node */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
const mockSendEmail = jest.fn();
jest.mock('../email/resend', () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));

// eslint-disable-next-line import/first
import {
  buildReviewRequestEmail,
  findReviewCandidates,
  REVIEW_REQUEST_ELIGIBLE_FROM,
  runReviewRequests,
} from './reviewRequests';

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;

beforeEach(async () => {
  client = createClient({ url: ':memory:' });
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(path.join(MIGRATIONS, file), 'utf-8').split('--> statement-breakpoint')) {
      if (stmt.trim()) await client.execute(stmt.trim());
    }
  }
  mockDb = drizzle(client, { schema });
  mockSendEmail.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => client.close());

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-10-05T02:00:00Z'); // 11:00 KST, 크론 시각
const AFTER_CUTOFF = new Date(REVIEW_REQUEST_ELIGIBLE_FROM.getTime() + HOUR);

let seq = 0;
const seedOrder = async (over: Partial<typeof schema.orders.$inferInsert> = {}) => {
  seq += 1;
  const [o] = await mockDb.insert(schema.orders).values({
    orderNo: `SNB-20261001-${String(seq).padStart(6, '0')}`,
    customerName: '홍길동',
    customerPhone: '010-0000-0000',
    customerEmail: `guest${seq}@studio-test.kr`,
    itemAmount: 250000, vatAmount: 25000, totalAmount: 275000,
    status: 'paid',
    manageToken: `tok-${seq}`,
    createdAt: AFTER_CUTOFF,
    ...over,
  }).returning();
  return o;
};

const seedBooking = async (orderId: string, endAgoHours: number, over: Partial<typeof schema.bookings.$inferInsert> = {}) => {
  const endAt = new Date(NOW.getTime() - endAgoHours * HOUR);
  const [b] = await mockDb.insert(schema.bookings).values({
    orderId, productId: 'recording-pro', serviceType: 'recording',
    startAt: new Date(endAt.getTime() - 3 * HOUR), endAt, durationHours: 3, status: 'confirmed',
    ...over,
  }).returning();
  return b;
};

const seedWork = async (orderId: string, deliveredAgoHours: number | null, status: 'delivered' | 'in_progress' = 'delivered') => {
  const [w] = await mockDb.insert(schema.workOrders).values({
    orderId, productId: 'mixing-level1', serviceType: 'mixing', songCount: 1, status,
    deliveredAt: deliveredAgoHours === null ? null : new Date(NOW.getTime() - deliveredAgoHours * HOUR),
  }).returning();
  return w;
};

describe('후기 요청 대상', () => {
  it('세션 다음 날·납품 다음 날의 결제 완료 건만 고른다', async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    await seedBooking(a.id, 20);
    await seedWork(b.id, 20);
    const c = await findReviewCandidates(NOW);
    expect(c.map((x) => x.kind).sort()).toEqual(['mixing', 'session']);
  });

  it('처리방침 개정 전에 접수된 주문은 보내지 않는다 — 그 고객은 이 목적에 동의한 적이 없다', async () => {
    const old = await seedOrder({ createdAt: new Date(REVIEW_REQUEST_ELIGIBLE_FROM.getTime() - HOUR) });
    await seedBooking(old.id, 20);
    expect(await findReviewCandidates(NOW)).toEqual([]);
  });

  it('끝난 지 12시간이 안 됐거나 7일이 넘은 건은 제외', async () => {
    const o = await seedOrder();
    await seedBooking(o.id, 3);
    await seedBooking(o.id, 24 * 8);
    expect(await findReviewCandidates(NOW)).toEqual([]);
  });

  it('취소·노쇼 예약, 환불 주문, 운영자 결제 테스트, 미납품 작업은 제외', async () => {
    const o1 = await seedOrder();
    await seedBooking(o1.id, 20, { status: 'cancelled' });
    const o2 = await seedOrder();
    await seedBooking(o2.id, 20, { status: 'no_show' });
    const o3 = await seedOrder({ status: 'refunded' });
    await seedBooking(o3.id, 20);
    const o4 = await seedOrder();
    await seedBooking(o4.id, 20, { serviceType: 'smoke-test', productId: 'smoke-test' });
    const o5 = await seedOrder();
    await seedWork(o5.id, null, 'in_progress');
    expect(await findReviewCandidates(NOW)).toEqual([]);
  });

  it('같은 이메일로 180일 안에 보낸 적이 있으면 건너뛴다 — 연습실 단골', async () => {
    const first = await seedOrder({ customerEmail: 'regular@studio-test.kr' });
    const b1 = await seedBooking(first.id, 24 * 30);
    await mockDb.insert(schema.reviewRequests).values({ kind: 'session', refId: b1.id, orderId: first.id, sentAt: new Date(NOW.getTime() - 24 * 30 * HOUR) });
    const again = await seedOrder({ customerEmail: 'regular@studio-test.kr' });
    await seedBooking(again.id, 20);
    expect(await findReviewCandidates(NOW)).toEqual([]);
  });

  it('같은 실행에서 한 주소에는 한 통만', async () => {
    const a = await seedOrder({ customerEmail: 'both@studio-test.kr' });
    const b = await seedOrder({ customerEmail: 'both@studio-test.kr' });
    await seedBooking(a.id, 20);
    await seedWork(b.id, 20);
    expect(await findReviewCandidates(NOW)).toHaveLength(1);
  });
});

describe('발송', () => {
  it('보내고 기록한다 — 다시 돌려도 두 번 가지 않는다', async () => {
    const o = await seedOrder();
    await seedBooking(o.id, 20);
    expect(await runReviewRequests(NOW)).toMatchObject({ sent: 1, failed: [] });
    expect(await runReviewRequests(NOW)).toMatchObject({ sent: 0 });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const rows = await mockDb.select().from(schema.reviewRequests);
    expect(rows).toHaveLength(1);
  });

  it('발송이 실패하면 기록을 되돌려 다음 날 다시 시도한다', async () => {
    const o = await seedOrder();
    await seedBooking(o.id, 20);
    mockSendEmail.mockResolvedValueOnce({ ok: false, errorCode: 'API_ERROR' });
    expect(await runReviewRequests(NOW)).toMatchObject({ sent: 0, failed: [{ code: 'API_ERROR' }] });
    expect(await mockDb.select().from(schema.reviewRequests)).toHaveLength(0);
    expect(await runReviewRequests(new Date(NOW.getTime() + 24 * HOUR))).toMatchObject({ sent: 1 });
  });

  it('메일에는 구글·네이버 링크가 있고 혜택이나 별점 유도는 없다', () => {
    const mail = buildReviewRequestEmail({
      kind: 'session', refId: 'r', orderId: 'o', customerName: '홍길동', customerEmail: 'a@b.kr',
      serviceLabel: '보컬 녹음 1프로', dateLabel: '2026-10-04',
    });
    expect(mail.text).toContain('https://g.page/r/');
    expect(mail.text).toContain('naver.me');
    expect(mail.text).toContain('한 번만');
    expect(mail.text).not.toMatch(/할인|쿠폰|적립|사은|혜택|별 ?5|5점|좋은 후기/);
  });
});
