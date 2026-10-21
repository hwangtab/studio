import { sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import { buildContractEmailHtml } from '../contracts/email-template';
import { escapeHtml } from '../contracts/html-escape';
import { sendEmail } from '../email/resend';
import { kstDateString } from '../booking/kst';
import { addDays, weekdayOf, WEEKDAY_LABELS } from './rules';

/**
 * 레슨 수강생에게 **수업 전날** 일정을 안내하는 메일 — 수강 계약을 맺은(서명한) 분께만, 계약서에 적은 이메일로 보낸다. 매일 크론이 부른다.
 *
 * - 수강 계약의 이행 안내라 광고성 정보가 아니다 — 혜택·홍보·재등록 권유 문구를 넣지 말 것(처리방침 2항, 정보통신망법). 종료 임박·재등록 확인은 운영자 점검 메일이 맡는다.
 * - **기록을 먼저 넣고 보낸다**(`lesson_reminders`, (kind, ref_id) 유일) — 크론이 겹쳐도 한 통만 나간다. 실패는 기록에 남기고 다시 보내지 않는다(수업 전날 한 번뿐인 안내라 늦은 재발송이 혼란이다).
 * - 계약이 없거나(연락처를 모른다) 계약이 파기됐거나 수강이 중도 종료·수료면 보내지 않는다.
 * 표가 없는 DB(0083 전)에서는 던진다 — 호출부(크론)가 알린다.
 */

const STUDIO_ADDRESS = '서울특별시 은평구 통일로71길 2-1, 3층(대조동, 대조빌딩)';
const OPERATOR_PHONE = '010-4255-7893';

interface DueRow {
  session_id: string;
  scheduled_on: string;
  start_time: string;
  duration_min: number;
  student_name: string;
  student_email: string;
}

export interface ReminderResult {
  considered: number;
  sent: number;
  failed: Array<{ refId: string; code: string }>;
}

const reminderRef = (row: Pick<DueRow, 'session_id' | 'scheduled_on' | 'start_time'>): string => `${row.session_id}@${row.scheduled_on}T${row.start_time}`;

const mmdd = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export const buildLessonReminderEmail = (row: Pick<DueRow, 'scheduled_on' | 'start_time' | 'duration_min' | 'student_name'>): { subject: string; html: string; text: string } => {
  const day = `${mmdd(row.scheduled_on)}(${WEEKDAY_LABELS[weekdayOf(row.scheduled_on)]})`;
  const [h, m] = row.start_time.split(':').map(Number);
  const endTotal = h * 60 + m + row.duration_min;
  const end = `${String(Math.floor(endTotal / 60) % 24).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
  const when = `${day} ${row.start_time}~${end}`;
  const html = buildContractEmailHtml({
    heading: '내일 레슨 안내',
    paragraphs: [`${escapeHtml(row.student_name)}님, 안녕하세요. 스튜디오 놀입니다. 내일 레슨 일정을 안내드려요.`],
    rows: [
      { label: '일시', value: when, emphasis: true },
      { label: '장소', value: `스튜디오 놀 컨트롤 룸 · ${STUDIO_ADDRESS}` },
    ],
    notices: [
      '수업에 오지 않으면 그 회차는 진행된 것으로 보며 보강하지 않아요(수강 계약서 제4조).',
      `일정을 옮겨야 하면 지금 바로 ${OPERATOR_PHONE}으로 알려 주세요.`,
    ],
  });
  const text = [
    '[내일 레슨 안내]', '',
    `${row.student_name}님, 안녕하세요. 스튜디오 놀입니다. 내일 레슨 일정을 안내드려요.`, '',
    `일시: ${when}`, `장소: 스튜디오 놀 컨트롤 룸 · ${STUDIO_ADDRESS}`, '',
    '수업에 오지 않으면 그 회차는 진행된 것으로 보며 보강하지 않아요(수강 계약서 제4조).',
    `일정을 옮겨야 하면 지금 바로 ${OPERATOR_PHONE}으로 알려 주세요.`, '',
    '스튜디오 놀 · 본 메일은 발송 전용입니다.',
  ].join('\n');
  return { subject: `[스튜디오 놀] 내일 레슨 안내 — ${when}`, html, text };
};

export const sendLessonReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const db = getDb();
  const tomorrow = addDays(kstDateString(now), 1);
  const due = await db.all<DueRow>(sql`
    SELECT s.id AS session_id, s.scheduled_on AS scheduled_on, s.start_time AS start_time, s.duration_min AS duration_min,
           c.student_name AS student_name, c.student_email AS student_email
    FROM lesson_sessions s
    JOIN lesson_enrollments e ON e.id = s.enrollment_id
    JOIN lesson_contracts c ON c.id = (
      SELECT c2.id FROM lesson_contracts c2
      WHERE c2.enrollment_id = e.id AND c2.status = 'signed' AND c2.purged_at IS NULL ORDER BY c2.signed_at DESC LIMIT 1
    )
    WHERE s.status = 'scheduled' AND s.scheduled_on = ${tomorrow} AND e.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM lesson_reminders r WHERE r.kind = 'session' AND r.ref_id = s.id || '@' || s.scheduled_on || 'T' || s.start_time)
    ORDER BY s.start_time
  `);

  const result: ReminderResult = { considered: due.length, sent: 0, failed: [] };
  for (const row of due) {
    // 기록 키는 회차 id + 날짜 + 시각이다 — 안내 뒤에 운영자가 그 회차를 옮기면 새 일정으로 다시 한 번 안내한다(회차 id만 쓰면 옮긴 일정은 영영 안내가 없다).
    const refId = reminderRef(row);
    // 기록을 먼저 — 겹친 실행이 같은 회차를 또 보내지 않게. 0행이면 다른 실행이 이미 잡았다.
    const claim = await db.run(sql`INSERT INTO lesson_reminders (id, kind, ref_id) VALUES (lower(hex(randomblob(16))), 'session', ${refId}) ON CONFLICT (kind, ref_id) DO NOTHING`);
    if (Number(claim.rowsAffected) === 0) continue;
    try {
      const mail = buildLessonReminderEmail(row);
      const sent = await sendEmail({ to: row.student_email, ...mail });
      if (sent.ok) {
        result.sent += 1;
      } else {
        const code = sent.errorCode ?? 'send_failed';
        await db.run(sql`UPDATE lesson_reminders SET error = ${code} WHERE kind = 'session' AND ref_id = ${refId}`);
        result.failed.push({ refId, code });
      }
    } catch (error: unknown) {
      const code = error instanceof Error ? error.message.slice(0, 80) : 'send_exception';
      await db.run(sql`UPDATE lesson_reminders SET error = ${code} WHERE kind = 'session' AND ref_id = ${refId}`).catch(() => undefined);
      result.failed.push({ refId, code });
    }
  }
  return result;
};
