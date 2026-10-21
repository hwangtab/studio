/** @jest-environment node */
/**
 * 레슨 수강 등록·회차·수납과 매출을 실 DB(in-memory libSQL)로 본다.
 * 지키는 것: ① 등록이 회차와 컨트롤 룸 블록을 함께 만들고 겹치면 거절 ② 결석은 보강 없이 소화, 스튜디오 휴강은 끝에 한 회차 붙임·되돌리면 삭제
 * ③ 마지막 회차를 표시하면 수료 ④ 중도 종료가 남은 회차를 취소하고 블록을 푼다 ⑤ 수납이 레슨 매출이 되고 카드 레슨 구독은 레슨 유형으로 옮겨진다.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));

/* eslint-disable import/first */
import { createEnrollment, deleteLessonPayment, endEnrollment, findSlotConflicts, getEnrollmentDetail, listEnrollments, loadLessonQueues, recordLessonPayment, rescheduleSession, setSessionStatus } from './service';
import { loadLessonRevenueRows, reclassifyLessonSubscriptions } from '../ops/lessonRevenue';
import type { EnrollmentInput } from './rules';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const count = async (q: string) => Number(((await client.execute(q)).rows[0] as unknown as { n: number }).n);
const NOW = new Date('2026-10-21T03:00:00Z'); // KST 2026-10-21 12:00

const input = (over: Partial<EnrollmentInput> = {}): EnrollmentInput => ({
  studentName: '김수강', payMethod: 'bank', courseWeeks: 12, startDate: '2026-10-28', startTime: '14:00', durationMin: 60, monthlyAmount: 350000, note: null, ...over,
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
  for (const t of ['lesson_payments', 'lesson_sessions', 'lesson_enrollments', 'availability_blocks', 'bookings', 'orders']) await client.execute(`DELETE FROM ${t}`);
});

const create = async (over: Partial<EnrollmentInput> = {}) => {
  const r = await createEnrollment(input(over), 'admin');
  if (!r.ok) throw new Error(r.message);
  return r.id;
};

describe('수강 등록', () => {
  it('과정 길이만큼 회차와 예약 불가 블록을 만든다', async () => {
    const id = await create();
    const detail = await getEnrollmentDetail(id);
    expect(detail?.sessions).toHaveLength(12);
    expect(detail?.sessions[0]).toMatchObject({ seq: 1, scheduledOn: '2026-10-28', startTime: '14:00', status: 'scheduled' });
    expect(await count('SELECT COUNT(*) AS n FROM availability_blocks WHERE room_number IS NULL')).toBe(12);
    // 블록 시간이 KST 14:00~15:00(= UTC 05:00~06:00)이다.
    const block = (await client.execute('SELECT start_at, end_at FROM availability_blocks ORDER BY start_at LIMIT 1')).rows[0] as unknown as { start_at: number; end_at: number };
    expect(new Date(Number(block.start_at) * 1000).toISOString()).toBe('2026-10-28T05:00:00.000Z');
    expect(Number(block.end_at) - Number(block.start_at)).toBe(3600);
  });

  it('녹음실 예약이나 다른 수업과 겹치면 등록하지 않고 겹치는 날짜를 알린다', async () => {
    await create();
    const clash = await createEnrollment(input({ studentName: '박겹침', startTime: '14:30' }), 'admin');
    expect(clash).toMatchObject({ ok: false });
    expect(clash.ok === false && clash.message).toContain('2026-10-28');
    expect(await count('SELECT COUNT(*) AS n FROM lesson_enrollments')).toBe(1);

    // 녹음실 예약(확정)과도 겹친다 — 14:00~15:00 사이에 걸치는 예약.
    await client.executeMultiple(`PRAGMA foreign_keys = OFF; INSERT INTO orders (id, order_no, manage_token, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, status) VALUES ('o1','NO-1','t1','session','x','-','a@b.c',1,0,1,'paid'); INSERT INTO bookings (id, order_id, product_id, service_type, start_at, end_at, duration_hours, status) VALUES ('b1','o1','recording-hourly','recording', ${Math.floor(new Date('2026-11-04T05:30:00Z').getTime() / 1000)}, ${Math.floor(new Date('2026-11-04T07:30:00Z').getTime() / 1000)}, 2, 'confirmed'); PRAGMA foreign_keys = ON;`);
    const conflicts = await findSlotConflicts([{ on: '2026-11-04', time: '15:00', durationMin: 60 }]);
    expect(conflicts[0]?.reason).toContain('녹음실 예약');
  });
});

describe('회차 표시', () => {
  it('결석은 보강 없이 소화되고, 표시하면 블록이 풀리며, 되돌리면 다시 잠긴다', async () => {
    const id = await create();
    const s1 = (await getEnrollmentDetail(id))!.sessions[0];
    expect(await setSessionStatus({ sessionId: s1.id, status: 'absent' })).toMatchObject({ ok: true });
    let detail = (await getEnrollmentDetail(id))!;
    expect(detail.sessions).toHaveLength(12); // 보충 회차가 붙지 않는다
    expect(detail.sessions[0]).toMatchObject({ status: 'absent', blockId: null });
    expect(await count('SELECT COUNT(*) AS n FROM availability_blocks')).toBe(11);
    expect(await setSessionStatus({ sessionId: s1.id, status: 'scheduled' })).toMatchObject({ ok: true });
    detail = (await getEnrollmentDetail(id))!;
    expect(detail.sessions[0].blockId).not.toBeNull();
    expect(await count('SELECT COUNT(*) AS n FROM availability_blocks')).toBe(12);
  });

  it('스튜디오 휴강은 과정 끝에 한 회차를 붙이고, 되돌리면 그 회차를 지운다', async () => {
    const id = await create({ courseWeeks: 12 });
    const first = (await getEnrollmentDetail(id))!.sessions[0];
    await setSessionStatus({ sessionId: first.id, status: 'studio_cancelled' });
    let detail = (await getEnrollmentDetail(id))!;
    expect(detail.sessions).toHaveLength(13);
    expect(detail.sessions[12]).toMatchObject({ seq: 13, scheduledOn: '2027-01-20', extendsSessionId: first.id });
    await setSessionStatus({ sessionId: first.id, status: 'scheduled' });
    detail = (await getEnrollmentDetail(id))!;
    expect(detail.sessions).toHaveLength(12);
    expect(await count('SELECT COUNT(*) AS n FROM availability_blocks')).toBe(12);
  });

  it('보충 회차가 이미 진행됐으면 휴강을 되돌릴 수 없다', async () => {
    const id = await create();
    const first = (await getEnrollmentDetail(id))!.sessions[0];
    await setSessionStatus({ sessionId: first.id, status: 'studio_cancelled' });
    const extra = (await getEnrollmentDetail(id))!.sessions.find((s) => s.extendsSessionId === first.id)!;
    await setSessionStatus({ sessionId: extra.id, status: 'done' });
    expect(await setSessionStatus({ sessionId: first.id, status: 'scheduled' })).toMatchObject({ ok: false });
  });

  it('예정 회차를 모두 소화하면 수료, 다시 되돌리면 수강 중', async () => {
    const id = await create({ courseWeeks: 12 });
    const sessions = (await getEnrollmentDetail(id))!.sessions;
    for (const s of sessions) await setSessionStatus({ sessionId: s.id, status: s.seq % 2 ? 'done' : 'absent' });
    expect((await getEnrollmentDetail(id))!.enrollment.status).toBe('completed');
    await setSessionStatus({ sessionId: sessions[11].id, status: 'scheduled' });
    expect((await getEnrollmentDetail(id))!.enrollment.status).toBe('active');
  });

  it('일정 변경은 겹치지 않을 때만 되고 블록이 함께 옮겨진다', async () => {
    const id = await create();
    const [s1, s2] = (await getEnrollmentDetail(id))!.sessions;
    expect(await rescheduleSession({ sessionId: s1.id, date: s2.scheduledOn, time: '14:00' })).toMatchObject({ ok: false }); // 다음 회차 자리
    expect(await rescheduleSession({ sessionId: s1.id, date: '2026-10-29', time: '16:00' })).toMatchObject({ ok: true });
    const moved = (await getEnrollmentDetail(id))!.sessions[0];
    expect(moved).toMatchObject({ scheduledOn: '2026-10-29', startTime: '16:00' });
    const block = (await client.execute({ sql: 'SELECT start_at FROM availability_blocks WHERE id = ?', args: [moved.blockId!] })).rows[0] as unknown as { start_at: number };
    expect(new Date(Number(block.start_at) * 1000).toISOString()).toBe('2026-10-29T07:00:00.000Z');
  });

  it('중도 종료는 남은 예정 회차를 취소하고 블록을 푼다', async () => {
    const id = await create();
    const first = (await getEnrollmentDetail(id))!.sessions[0];
    await setSessionStatus({ sessionId: first.id, status: 'done' });
    expect(await endEnrollment({ enrollmentId: id, reason: '개인 사정', endedOn: '2026-11-05' })).toMatchObject({ ok: true });
    const detail = (await getEnrollmentDetail(id))!;
    expect(detail.enrollment).toMatchObject({ status: 'ended', endedOn: '2026-11-05' });
    expect(detail.sessions.filter((s) => s.status === 'dropped')).toHaveLength(11);
    expect(await count('SELECT COUNT(*) AS n FROM availability_blocks')).toBe(0);
    expect(await setSessionStatus({ sessionId: first.id, status: 'scheduled' })).toMatchObject({ ok: false });
  });
});

describe('목록·대시보드 큐', () => {
  it('지난 예정 회차를 표시 대기로 센다', async () => {
    const id = await create({ startDate: '2026-10-07' }); // 10/7·10/14 은 지난 회차, 10/21 은 오늘
    const rows = await listEnrollments(NOW);
    expect(rows[0]).toMatchObject({ total: 12, consumed: 0, unmarked: 2, lastPaidOn: null });
    expect(rows[0].nextSession).toEqual({ scheduledOn: '2026-10-21', startTime: '14:00' });
    expect(await loadLessonQueues(NOW)).toEqual({ unmarked: 2, today: 1 });
    expect(id).toBeTruthy();
  });
});

describe('미수금', () => {
  it('시작된 회차의 달 수만큼 못 받았으면 목록에 미수로 나오고, 수납을 기록하면 사라진다', async () => {
    const id = await create({ startDate: '2026-10-07' }); // 10/7·10/14·10/21 이 도래 → 한 달 치
    expect((await listEnrollments(NOW))[0].arrears).toBe(350000);
    await recordLessonPayment(id, { paidOn: '2026-10-07', amount: 350000, vatAmount: 0, periodLabel: '10월', method: '현금', memo: null, receiptIssued: false }, 'admin');
    expect((await listEnrollments(NOW))[0].arrears).toBe(0);
  });
});

describe('수납·매출', () => {
  it('계좌·현금 수납이 레슨 매출 행이 되고, 지우면 빠진다', async () => {
    const id = await create();
    const paymentId = await recordLessonPayment(id, { paidOn: '2026-10-20', amount: 350000, vatAmount: 0, periodLabel: '10월', method: '계좌 입금', memo: null, receiptIssued: false }, 'admin');
    expect(paymentId).toBeTruthy();
    const range = { from: new Date('2026-09-30T15:00:00Z'), toExclusive: new Date('2026-10-31T15:00:00Z') };
    const rows = await loadLessonRevenueRows(range);
    expect(rows.map((r) => [r.type, r.gross, r.vat, r.method])).toEqual([['lesson', 350000, 0, '계좌 입금']]);
    expect(JSON.stringify(rows)).not.toContain('김수강');
    expect(await deleteLessonPayment(paymentId!, 'admin')).toBe(true);
    expect(await deleteLessonPayment(paymentId!, 'admin')).toBe(false);
    expect(await loadLessonRevenueRows(range)).toEqual([]);
  });

  it('레슨 구독의 주문만 레슨 유형으로 옮긴다', async () => {
    await client.executeMultiple(`PRAGMA foreign_keys = OFF;
      INSERT INTO orders (id, order_no, manage_token, type, customer_name, customer_phone, customer_email, item_amount, vat_amount, total_amount, status) VALUES ('ol','NO-L','t1','subscription','x','-','a@b.c',350000,35000,385000,'paid'), ('op','NO-P','t2','subscription','x','-','a@b.c',360000,36000,396000,'paid');
      INSERT INTO subscriptions (id, kind, customer_name, customer_phone, customer_email, customer_key, manage_token, item_amount, vat_amount, total_amount, billing_day, status) VALUES ('sl','lesson','x','-','a@b.c','sub_l','m1',350000,35000,385000,1,'active'), ('sp','practice-room','x','-','a@b.c','sub_p','m2',360000,36000,396000,1,'active');
      INSERT INTO subscription_payments (id, subscription_id, order_id, cycle_ym, attempt, amount, status) VALUES ('p1','sl','ol','2026-10',1,385000,'paid'), ('p2','sp','op','2026-10',1,396000,'paid');
      PRAGMA foreign_keys = ON;`);
    const base = { at: new Date('2026-10-05T03:00:00Z'), projectSlug: null, method: '카드', gross: 385000, vat: 35000, refunded: 0, offline: false };
    const out = await reclassifyLessonSubscriptions([
      { ...base, orderNo: 'NO-L', type: 'subscription' },
      { ...base, orderNo: 'NO-P', type: 'subscription', gross: 396000 },
      { ...base, orderNo: 'NO-S', type: 'session' },
    ]);
    expect(out.map((r) => [r.orderNo, r.type])).toEqual([['NO-L', 'lesson'], ['NO-P', 'subscription'], ['NO-S', 'session']]);
    // 연습실 월 이용료 구독은 유형은 구독 그대로, 분야는 연습실.
    expect(out.map((r) => r.line)).toEqual([undefined, 'practice', undefined]);
  });
});
