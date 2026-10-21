import { randomBytes } from 'node:crypto';

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  availabilityBlocks, lessonEnrollments, lessonPayments, lessonSessions,
  type LessonEnrollment, type LessonPayment, type LessonSession,
} from '../../db/schema';
import { kstDateString } from '../booking/kst';
import { occupiedBookingSql } from '../booking/service';
import { addDays, arrearsOf, sessionDates, slotRange, type EnrollmentInput, type PaymentInput } from './rules';

/**
 * 프로듀싱 레슨 운영 — 수강 등록·회차·수납. 규칙의 근거는 docs/lesson-management-design-2026-10.md.
 *
 * - **수강 등록 한 건이 과정 길이만큼 회차를 미리 만든다**(12주면 12행, 첫 수업일부터 매주 같은 요일·시각).
 * - 회차마다 컨트롤 룸을 막는 **"예약 불가 블록"**(`availability_blocks`, 녹음실)을 건다 — 웹 예약이 그 시간을 못 잡는다. 완료·결석·휴강이 되면 푼다.
 *   등록 때 녹음실 예약·다른 블록과 겹치는 회차가 하나라도 있으면 **등록을 거절**한다(겹치는 날짜를 알려 준다).
 * - **결석은 보강하지 않는다**(운영자 결정 2026-10-21) — 결석한 회차는 소화된 것으로 센다. 스튜디오 사정 휴강만 과정 끝에 회차를 하나 더 붙인다.
 * - 구글 캘린더에는 올리지 않는다 — 녹음실 예약 캘린더의 손으로 넣은 일정은 사이트가 예약으로 자동 등록해 버린다(lib/booking/calendarAutoImport.ts).
 * - 카드(정기결제) 수강은 구독이 정본이고 여기서는 `subscription_id`로 가리킨다. 계좌·현금 수납은 `lesson_payments`가 정본이다.
 * 표가 없는 DB(0081 전)에서는 읽기·쓰기가 던진다 — 호출부가 "마이그레이션 0081 필요"로 알린다.
 */

const newId = (): string => randomBytes(16).toString('hex');
const BLOCK_MEMO = '프로듀싱 레슨';

export interface SlotConflict {
  on: string;
  time: string;
  reason: string;
}

/** 이 시간대가 녹음실 예약·다른 예약 불가 블록과 겹치는가 — `exceptBlockIds`는 이 수업 자신의 블록이다. */
export const findSlotConflicts = async (
  slots: ReadonlyArray<{ on: string; time: string; durationMin: number }>,
  exceptBlockIds: readonly string[] = [],
): Promise<SlotConflict[]> => {
  const db = getDb();
  const conflicts: SlotConflict[] = [];
  for (const slot of slots) {
    const { start, end } = slotRange(slot.on, slot.time, slot.durationMin);
    const s = Math.floor(start.getTime() / 1000);
    const e = Math.floor(end.getTime() / 1000);
    const booking = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM bookings b
      WHERE b.room_number IS NULL AND b.start_at < ${e} AND b.end_at > ${s} AND ${occupiedBookingSql('b')}
    `);
    if (Number(booking[0]?.n ?? 0) > 0) {
      conflicts.push({ on: slot.on, time: slot.time, reason: '녹음실 예약과 겹쳐요' });
      continue;
    }
    const exceptSql = exceptBlockIds.length > 0 ? sql` AND ab.id NOT IN (${sql.join(exceptBlockIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
    const blocks = await db.all<{ n: number }>(sql`
      SELECT COUNT(*) AS n FROM availability_blocks ab
      WHERE ab.room_number IS NULL AND ab.start_at < ${e} AND ab.end_at > ${s}${exceptSql}
    `);
    if (Number(blocks[0]?.n ?? 0) > 0) conflicts.push({ on: slot.on, time: slot.time, reason: '다른 수업·예약 불가 시간과 겹쳐요' });
  }
  return conflicts;
};

const conflictMessage = (conflicts: SlotConflict[]): string => {
  const shown = conflicts.slice(0, 4).map((c) => `${c.on} ${c.time} — ${c.reason}`).join(' / ');
  return `${conflicts.length}회차가 다른 일정과 겹쳐요: ${shown}${conflicts.length > 4 ? ' …' : ''}. 시작 날짜·시각을 바꿔 다시 등록해 주세요.`;
};

export type CreateResult = { ok: true; id: string } | { ok: false; message: string };

export const createEnrollment = async (input: EnrollmentInput, actor: string): Promise<CreateResult> => {
  const dates = sessionDates(input.startDate, input.courseWeeks);
  const conflicts = await findSlotConflicts(dates.map((on) => ({ on, time: input.startTime, durationMin: input.durationMin })));
  if (conflicts.length > 0) return { ok: false, message: conflictMessage(conflicts) };

  const db = getDb();
  const id = newId();
  const sessionRows = dates.map((on, i) => ({ id: newId(), seq: i + 1, on, blockId: newId() }));
  await db.batch([
    db.insert(lessonEnrollments).values({
      id, studentName: input.studentName, payMethod: input.payMethod, courseWeeks: input.courseWeeks,
      startDate: input.startDate, startTime: input.startTime, durationMin: input.durationMin, monthlyAmount: input.monthlyAmount,
      note: input.note, createdBy: actor,
    }),
    ...sessionRows.map((r) => {
      const { start, end } = slotRange(r.on, input.startTime, input.durationMin);
      return db.insert(availabilityBlocks).values({ id: r.blockId, roomNumber: null, startAt: start, endAt: end, memo: BLOCK_MEMO });
    }),
    ...sessionRows.map((r) => db.insert(lessonSessions).values({
      id: r.id, enrollmentId: id, seq: r.seq, scheduledOn: r.on, startTime: input.startTime, durationMin: input.durationMin, blockId: r.blockId,
    })),
  ]);
  return { ok: true, id };
};

const releaseBlock = async (blockId: string | null): Promise<void> => {
  if (blockId) await getDb().delete(availabilityBlocks).where(eq(availabilityBlocks.id, blockId));
};

const createBlock = async (date: string, time: string, durationMin: number): Promise<string> => {
  const id = newId();
  const { start, end } = slotRange(date, time, durationMin);
  await getDb().insert(availabilityBlocks).values({ id, roomNumber: null, startAt: start, endAt: end, memo: BLOCK_MEMO });
  return id;
};

/** 예정 회차가 하나도 안 남으면 수료, 다시 생기면 수강 중으로 — 중도 종료는 건드리지 않는다. */
const syncCompletion = async (enrollmentId: string): Promise<void> => {
  const db = getDb();
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, enrollmentId));
  if (!enrollment || enrollment.status === 'ended') return;
  const left = await db.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM lesson_sessions WHERE enrollment_id = ${enrollmentId} AND status = 'scheduled'`);
  const next = Number(left[0]?.n ?? 0) === 0 ? 'completed' : 'active';
  if (next !== enrollment.status) {
    await db.update(lessonEnrollments).set({ status: next, updatedAt: new Date() }).where(eq(lessonEnrollments.id, enrollmentId));
  }
};

export type SessionTarget = 'scheduled' | 'done' | 'absent' | 'studio_cancelled';
export type ActionResult = { ok: true; warnings: string[] } | { ok: false; message: string };

export const setSessionStatus = async (input: { sessionId: string; status: SessionTarget; topic?: string | null; homework?: string | null }): Promise<ActionResult> => {
  const db = getDb();
  const [session] = await db.select().from(lessonSessions).where(eq(lessonSessions.id, input.sessionId));
  if (!session) return { ok: false, message: '회차를 찾을 수 없어요.' };
  if (session.status === 'dropped') return { ok: false, message: '중도 종료로 취소된 회차예요.' };
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, session.enrollmentId));
  if (!enrollment || enrollment.status === 'ended') return { ok: false, message: '중도 종료된 수강이라 회차를 바꿀 수 없어요.' };
  const warnings: string[] = [];
  const target = input.status;
  const noteSet = {
    ...(input.topic !== undefined ? { topic: input.topic && input.topic.trim() !== '' ? input.topic.trim().slice(0, 300) : null } : {}),
    ...(input.homework !== undefined ? { homework: input.homework && input.homework.trim() !== '' ? input.homework.trim().slice(0, 300) : null } : {}),
  };

  if (target === session.status) {
    if (Object.keys(noteSet).length > 0) await db.update(lessonSessions).set({ ...noteSet, updatedAt: new Date() }).where(eq(lessonSessions.id, session.id));
    return { ok: true, warnings };
  }

  // 스튜디오 휴강을 되돌리면 그 휴강이 붙인 보충 회차를 지운다 — 보충 회차가 이미 진행됐으면 되돌릴 수 없다.
  if (session.status === 'studio_cancelled' && target !== 'studio_cancelled') {
    const extensions = await db.select().from(lessonSessions).where(eq(lessonSessions.extendsSessionId, session.id));
    if (extensions.some((x) => x.status !== 'scheduled')) return { ok: false, message: '이 휴강이 붙인 보충 회차가 이미 진행돼 되돌릴 수 없어요.' };
    for (const x of extensions) {
      await releaseBlock(x.blockId);
      await db.delete(lessonSessions).where(eq(lessonSessions.id, x.id));
    }
  }

  let blockId: string | null = session.blockId;
  if (target === 'scheduled') {
    if (!blockId) {
      const conflicts = await findSlotConflicts([{ on: session.scheduledOn, time: session.startTime, durationMin: session.durationMin }]);
      if (conflicts.length > 0) return { ok: false, message: conflictMessage(conflicts) };
      blockId = await createBlock(session.scheduledOn, session.startTime, session.durationMin);
    }
  } else {
    await releaseBlock(blockId);
    blockId = null;
  }

  if (target === 'studio_cancelled') {
    // 과정 끝에 보충 회차 하나 — 스튜디오 사정이라 수강생의 회차가 줄지 않게(결석과 다르다).
    const all = await db.select().from(lessonSessions).where(eq(lessonSessions.enrollmentId, enrollment.id));
    const last = all.reduce((acc, s) => (s.scheduledOn > acc ? s.scheduledOn : acc), session.scheduledOn);
    const on = addDays(last, 7);
    const conflicts = await findSlotConflicts([{ on, time: session.startTime, durationMin: session.durationMin }]);
    const extBlock = conflicts.length === 0 ? await createBlock(on, session.startTime, session.durationMin) : null;
    if (conflicts.length > 0) warnings.push(`보충 회차(${on} ${session.startTime})가 다른 일정과 겹쳐 시간을 막지 못했어요 — 상세에서 일정 변경으로 옮겨 주세요.`);
    await db.insert(lessonSessions).values({
      id: newId(), enrollmentId: enrollment.id, seq: Math.max(...all.map((s) => s.seq)) + 1, scheduledOn: on,
      startTime: session.startTime, durationMin: session.durationMin, blockId: extBlock, extendsSessionId: session.id,
    });
  }

  await db.update(lessonSessions).set({ status: target, blockId, ...noteSet, updatedAt: new Date() }).where(eq(lessonSessions.id, session.id));
  await syncCompletion(enrollment.id);
  return { ok: true, warnings };
};

export const rescheduleSession = async (input: { sessionId: string; date: string; time: string }): Promise<ActionResult> => {
  const db = getDb();
  const [session] = await db.select().from(lessonSessions).where(eq(lessonSessions.id, input.sessionId));
  if (!session) return { ok: false, message: '회차를 찾을 수 없어요.' };
  if (session.status !== 'scheduled') return { ok: false, message: '예정 회차만 일정을 바꿀 수 있어요.' };
  const conflicts = await findSlotConflicts([{ on: input.date, time: input.time, durationMin: session.durationMin }], session.blockId ? [session.blockId] : []);
  if (conflicts.length > 0) return { ok: false, message: conflictMessage(conflicts) };
  const { start, end } = slotRange(input.date, input.time, session.durationMin);
  let blockId = session.blockId;
  if (blockId) {
    await db.update(availabilityBlocks).set({ startAt: start, endAt: end }).where(eq(availabilityBlocks.id, blockId));
  } else {
    blockId = await createBlock(input.date, input.time, session.durationMin);
  }
  await db.update(lessonSessions).set({ scheduledOn: input.date, startTime: input.time, blockId, updatedAt: new Date() }).where(eq(lessonSessions.id, session.id));
  return { ok: true, warnings: [] };
};

export const endEnrollment = async (input: { enrollmentId: string; reason: string; endedOn: string }): Promise<ActionResult> => {
  const db = getDb();
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, input.enrollmentId));
  if (!enrollment) return { ok: false, message: '수강 등록을 찾을 수 없어요.' };
  if (enrollment.status === 'ended') return { ok: false, message: '이미 중도 종료됐어요.' };
  const pending = await db.select().from(lessonSessions).where(and(eq(lessonSessions.enrollmentId, enrollment.id), eq(lessonSessions.status, 'scheduled')));
  for (const s of pending) await releaseBlock(s.blockId);
  if (pending.length > 0) {
    await db.update(lessonSessions).set({ status: 'dropped', blockId: null, updatedAt: new Date() })
      .where(inArray(lessonSessions.id, pending.map((s) => s.id)));
  }
  await db.update(lessonEnrollments).set({ status: 'ended', endedOn: input.endedOn, endedReason: input.reason.trim().slice(0, 200), updatedAt: new Date() })
    .where(eq(lessonEnrollments.id, enrollment.id));
  return { ok: true, warnings: [] };
};

export const updateEnrollmentNote = async (enrollmentId: string, note: string): Promise<boolean> => {
  const result = await getDb().update(lessonEnrollments).set({ note: note.trim() === '' ? null : note.trim().slice(0, 300), updatedAt: new Date() }).where(eq(lessonEnrollments.id, enrollmentId));
  return Number(result.rowsAffected) > 0;
};

export const recordLessonPayment = async (enrollmentId: string, input: PaymentInput, actor: string): Promise<string | null> => {
  const db = getDb();
  const [enrollment] = await db.select({ id: lessonEnrollments.id }).from(lessonEnrollments).where(eq(lessonEnrollments.id, enrollmentId));
  if (!enrollment) return null;
  const id = newId();
  await db.insert(lessonPayments).values({
    id, enrollmentId, paidOn: input.paidOn, amount: input.amount, vatAmount: input.vatAmount, periodLabel: input.periodLabel,
    method: input.method, memo: input.memo, receiptIssued: input.receiptIssued, createdBy: actor,
  });
  return id;
};

/** 소프트 삭제 — 누가 언제 지웠는지 남긴다. 이미 지웠거나 없으면 false. */
export const deleteLessonPayment = async (paymentId: string, actor: string, now: Date = new Date()): Promise<boolean> => {
  const result = await getDb().update(lessonPayments).set({ deletedAt: now, deletedBy: actor }).where(and(eq(lessonPayments.id, paymentId), isNull(lessonPayments.deletedAt)));
  return Number(result.rowsAffected) > 0;
};

export interface LessonListRow {
  enrollment: LessonEnrollment;
  total: number;
  consumed: number;
  nextSession: { scheduledOn: string; startTime: string } | null;
  /** 지난 회차인데 아직 완료·결석 표시가 안 된 수. */
  unmarked: number;
  lastPaidOn: string | null;
  paidTotal: number;
  /** 계좌·현금 선불의 미수금(수강 중일 때만, 카드는 0) — arrearsOf. */
  arrears: number;
  /** 아직 남은 마지막 예정 회차의 날짜 — 종료 임박 판정용. 예정 회차가 없으면 null. */
  lastScheduledOn: string | null;
}

export const listEnrollments = async (now: Date = new Date()): Promise<LessonListRow[]> => {
  const db = getDb();
  const today = kstDateString(now);
  const enrollments = await db.select().from(lessonEnrollments).orderBy(asc(lessonEnrollments.status), asc(lessonEnrollments.startDate));
  if (enrollments.length === 0) return [];
  const sessions = await db.select().from(lessonSessions);
  const payments = await db.select().from(lessonPayments).where(isNull(lessonPayments.deletedAt));
  return enrollments.map((enrollment) => {
    const mine = sessions.filter((s) => s.enrollmentId === enrollment.id);
    const live = mine.filter((s) => s.status !== 'studio_cancelled' && s.status !== 'dropped');
    const upcoming = mine.filter((s) => s.status === 'scheduled' && s.scheduledOn >= today).sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
    const paid = payments.filter((p) => p.enrollmentId === enrollment.id);
    return {
      enrollment,
      total: live.length,
      consumed: live.filter((s) => s.status === 'done' || s.status === 'absent').length,
      nextSession: upcoming[0] ? { scheduledOn: upcoming[0].scheduledOn, startTime: upcoming[0].startTime } : null,
      unmarked: mine.filter((s) => s.status === 'scheduled' && s.scheduledOn < today).length,
      lastPaidOn: paid.map((p) => p.paidOn).sort().pop() ?? null,
      paidTotal: paid.reduce((sum, p) => sum + p.amount, 0),
      arrears: enrollment.status === 'active'
        ? arrearsOf({ payMethod: enrollment.payMethod, monthlyAmount: enrollment.monthlyAmount, sessions: mine, payments: paid, today }).arrears
        : 0,
      lastScheduledOn: mine.filter((s) => s.status === 'scheduled').map((s) => s.scheduledOn).sort().pop() ?? null,
    };
  });
};

export interface LessonDetail {
  enrollment: LessonEnrollment;
  sessions: LessonSession[];
  payments: LessonPayment[];
}

export const getEnrollmentDetail = async (id: string): Promise<LessonDetail | null> => {
  const db = getDb();
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, id));
  if (!enrollment) return null;
  const sessions = await db.select().from(lessonSessions).where(eq(lessonSessions.enrollmentId, id)).orderBy(asc(lessonSessions.scheduledOn), asc(lessonSessions.seq));
  const payments = await db.select().from(lessonPayments).where(and(eq(lessonPayments.enrollmentId, id), isNull(lessonPayments.deletedAt))).orderBy(asc(lessonPayments.paidOn));
  return { enrollment, sessions, payments };
};

/** 대시보드 큐 — 수강 중인 수강의 지난 예정 회차(표시 대기)·오늘 수업. 표가 없으면 던진다. */
export const loadLessonQueues = async (now: Date = new Date()): Promise<{ unmarked: number; today: number }> => {
  const today = kstDateString(now);
  const rows = await getDb().all<{ unmarked: number; today: number }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN s.scheduled_on < ${today} THEN 1 ELSE 0 END), 0) AS unmarked,
      COALESCE(SUM(CASE WHEN s.scheduled_on = ${today} THEN 1 ELSE 0 END), 0) AS today
    FROM lesson_sessions s JOIN lesson_enrollments e ON e.id = s.enrollment_id
    WHERE s.status = 'scheduled' AND e.status = 'active'
  `);
  return { unmarked: Number(rows[0]?.unmarked ?? 0), today: Number(rows[0]?.today ?? 0) };
};
