import { and, inArray, isNull, lt, or, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { lessonContracts, lessonEnrollments } from '../../../db/schema';
import { kstDateString } from '../../booking/kst';

/**
 * 프로듀싱 레슨의 개인정보 보관 기간.
 * - 수강 계약서(이름·생년월일·연락처·주소·서명): 수강이 끝난 날부터 **3년**(계약서 제10조 2항 — 고칠 때는 lesson-template.md와 처리방침(data/privacyPolicy.ts)도 함께).
 * - 수강 등록의 이름·메모와 수납 기록에 묶인 이름: 수강이 끝난 날부터 **5년**(대금 결제·거래 기록의 법정 보존 기간 — 수납 금액·날짜 자체는 장부로 남긴다).
 * "수강이 끝난 날" = 중도 종료일, 없으면 마지막 회차 날짜.
 */
export const LESSON_CONTRACT_RETENTION_YEARS = 3;
export const LESSON_RECORD_RETENTION_YEARS = 5;

const PURGED_MARK = '(개인정보 파기됨)';

const boundaryDate = (now: Date, years: number): string => {
  const b = new Date(now);
  b.setFullYear(b.getFullYear() - years);
  return kstDateString(b);
};

/** 수강이 끝난 날(KST 날짜) — 없으면 null(아직 회차가 남았거나 회차가 없는 수강). */
const ENDED_ON_SQL = sql`COALESCE(e.ended_on, (SELECT CASE WHEN SUM(CASE WHEN s.status = 'scheduled' THEN 1 ELSE 0 END) = 0 THEN MAX(s.scheduled_on) END FROM lesson_sessions s WHERE s.enrollment_id = e.id))`;

export const purgeExpiredLessonPersonalData = async (now: Date = new Date()): Promise<{ contractsPurged: number; enrollmentsCleared: number }> => {
  const db = getDb();
  const contractBoundary = boundaryDate(now, LESSON_CONTRACT_RETENTION_YEARS);
  const recordBoundary = boundaryDate(now, LESSON_RECORD_RETENTION_YEARS);
  const boundaryTime = new Date(now);
  boundaryTime.setFullYear(boundaryTime.getFullYear() - LESSON_CONTRACT_RETENTION_YEARS);

  // 계약서 — 체결된 계약은 수강이 끝난 날 기준, 체결되지 않은 계약은 만료·마지막 수정 기준(음원 제작 계약과 같다).
  const ended = await db.all<{ id: string }>(sql`
    SELECT c.id AS id FROM lesson_contracts c JOIN lesson_enrollments e ON e.id = c.enrollment_id
    WHERE c.status = 'signed' AND c.purged_at IS NULL AND ${ENDED_ON_SQL} < ${contractBoundary}
  `);
  const unsigned = await db.select({ id: lessonContracts.id }).from(lessonContracts).where(and(
    or(
      and(inArray(lessonContracts.status, ['sent', 'expired']), lt(lessonContracts.expiresAt, boundaryTime)),
      and(inArray(lessonContracts.status, ['cancelled', 'draft']), lt(lessonContracts.updatedAt, boundaryTime)),
    ),
    lt(lessonContracts.createdAt, boundaryTime),
    isNull(lessonContracts.purgedAt),
  ));
  const ids = [...new Set([...ended.map((r) => r.id), ...unsigned.map((r) => r.id)])];
  if (ids.length > 0) {
    await db.update(lessonContracts).set({
      studentName: PURGED_MARK, studentEmail: PURGED_MARK, studentPhone: PURGED_MARK, studentBirthdate: null, studentAddress: null,
      content: PURGED_MARK, signatureData: null, signerIp: null, signerUserAgent: null, operatorIp: null, signToken: null, notificationError: null,
      purgedAt: now, updatedAt: now,
    }).where(and(inArray(lessonContracts.id, ids), isNull(lessonContracts.purgedAt)));
  }

  // 수강 등록의 이름·메모 — 5년.
  const old = await db.all<{ id: string }>(sql`
    SELECT e.id AS id FROM lesson_enrollments e
    WHERE e.student_name <> ${PURGED_MARK} AND ${ENDED_ON_SQL} < ${recordBoundary}
  `);
  if (old.length > 0) {
    await db.update(lessonEnrollments).set({ studentName: PURGED_MARK, note: null, updatedAt: now }).where(inArray(lessonEnrollments.id, old.map((r) => r.id)));
  }
  return { contractsPurged: ids.length, enrollmentsCleared: old.length };
};
