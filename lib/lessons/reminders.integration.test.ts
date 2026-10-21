/** @jest-environment node */
/**
 * 수업 전날 안내 메일을 실 DB(in-memory libSQL)로 본다.
 * 지키는 것: ① 서명한 계약이 있는 활성 수강의 내일 수업만 ② 같은 회차는 두 번 보내지 않음(크론 겹침 포함) ③ 실패는 기록하고 다시 보내지 않음
 * ④ 계약 없음·서명 전·파기·중도 종료는 건너뜀 ⑤ 홍보 문구 없음.
 */
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import * as schema from '../../db/schema';

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
jest.mock('../../db/client', () => ({ getDb: () => mockDb }));
const sendEmail = jest.fn();
jest.mock('../email/resend', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

/* eslint-disable import/first */
import { buildLessonReminderEmail, sendLessonReminders } from './reminders';
/* eslint-enable import/first */

const MIGRATIONS = path.join(process.cwd(), 'drizzle/migrations');
let client: Client;
const NOW = new Date('2026-10-21T01:00:00Z'); // KST 10:00 → 내일 = 2026-10-22

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
  sendEmail.mockReset().mockResolvedValue({ ok: true, status: 200 });
  for (const t of ['lesson_reminders', 'lesson_contracts', 'lesson_sessions', 'lesson_enrollments']) await client.execute(`DELETE FROM ${t}`);
});

let n = 0;
const seed = async (o: { enrollment?: string; contract?: string | null; purged?: boolean; on?: string; session?: string } = {}) => {
  n += 1;
  const eid = `e${n}`;
  await client.execute({
    sql: `INSERT INTO lesson_enrollments (id, student_name, pay_method, course_weeks, start_date, start_time, duration_min, monthly_amount, status) VALUES (?, '김수강', 'bank', 12, '2026-10-01', '14:00', 60, 350000, ?)`,
    args: [eid, o.enrollment ?? 'active'],
  });
  await client.execute({
    sql: `INSERT INTO lesson_sessions (id, enrollment_id, seq, scheduled_on, start_time, duration_min, status) VALUES (?, ?, 1, ?, '14:00', 60, ?)`,
    args: [`s${n}`, eid, o.on ?? '2026-10-22', o.session ?? 'scheduled'],
  });
  if (o.contract !== null) {
    await client.execute({
      sql: `INSERT INTO lesson_contracts (id, enrollment_id, status, student_name, student_email, student_phone, terms_json, clauses_json, template, template_hash, content, signed_at, purged_at)
            VALUES (?, ?, ?, '김수강', 'kim@example.com', '01012345678', '{}', '[]', 't', 'h', 'c', unixepoch(), ?)`,
      args: [`c${n}`, eid, o.contract ?? 'signed', o.purged ? 1 : null],
    });
  }
  return `s${n}`;
};

describe('수업 전날 안내', () => {
  it('서명한 계약이 있는 활성 수강의 내일 수업에 한 통 보낸다', async () => {
    await seed();
    const r = await sendLessonReminders(NOW);
    expect(r).toMatchObject({ considered: 1, sent: 1, failed: [] });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: 'kim@example.com' });
    expect(sendEmail.mock.calls[0][0].subject).toContain('10/22(목) 14:00~15:00');
  });

  it('같은 회차는 두 번 보내지 않는다(다시 돌려도, 동시에 돌려도)', async () => {
    await seed();
    await Promise.all([sendLessonReminders(NOW), sendLessonReminders(NOW)]);
    await sendLessonReminders(NOW);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('내일이 아닌 수업·결석 처리된 수업·계약 없음·서명 전·파기·중도 종료는 건너뛴다', async () => {
    await seed({ on: '2026-10-23' });
    await seed({ session: 'absent' });
    await seed({ contract: null });
    await seed({ contract: 'sent' });
    await seed({ purged: true });
    await seed({ enrollment: 'ended' });
    const r = await sendLessonReminders(NOW);
    expect(r.considered).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('안내 뒤 회차를 옮기면 새 일정으로 한 번 더 안내한다', async () => {
    const id = await seed();
    await sendLessonReminders(NOW);
    await client.execute(`UPDATE lesson_sessions SET start_time = '16:00' WHERE id = '${id}'`);
    const r = await sendLessonReminders(NOW);
    expect(r.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].subject).toContain('16:00');
  });

  it('발송 실패는 기록하고 다시 보내지 않는다', async () => {
    const id = await seed();
    sendEmail.mockResolvedValue({ ok: false, errorCode: 'API_ERROR' });
    const r = await sendLessonReminders(NOW);
    expect(r.failed).toEqual([{ refId: `${id}@2026-10-22T14:00`, code: 'API_ERROR' }]);
    const row = (await client.execute(`SELECT error FROM lesson_reminders WHERE ref_id LIKE '${id}@%'`)).rows[0] as unknown as { error: string };
    expect(row.error).toBe('API_ERROR');
    sendEmail.mockClear();
    await sendLessonReminders(NOW);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('메일에 홍보·혜택 문구가 없고 수강생 이름은 escape한다', () => {
    const mail = buildLessonReminderEmail({ scheduled_on: '2026-10-22', start_time: '14:00', duration_min: 60, student_name: '<b>x</b>' });
    expect(mail.html).not.toContain('<b>x</b>');
    expect(`${mail.text}${mail.html}`).not.toMatch(/할인|혜택|이벤트|재등록|연장 등록|프로모션/);
    expect(mail.text).toContain('보강하지 않아요');
  });
});
