import { randomUUID } from 'node:crypto';

import { and, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { getDb } from '../../../db/client';
import { lessonContracts, lessonEnrollments, type LessonContract } from '../../../db/schema';
import { computeExpiresAt } from '../status';
import { hashTemplate } from '../template-snapshot';
import { generateSignToken } from '../token';
import { buildLessonClauses, parseLessonClauses } from './clauses';
import { sendLessonOperatorNotification, sendLessonSignedEmail, sendLessonSignRequestEmail } from './email';
import { computeLessonFingerprint } from './integrity';
import { buildLessonCompleteUrl, buildLessonSignUrl } from './links';
import { checkLessonAction } from './status';
import { buildLessonContent, hasDraftMarker, readLessonTemplate } from './template';
import { buildLessonTerms, canonicalLessonTermsJson, parseLessonTerms } from './terms';

/**
 * 수강 계약의 상태를 바꾸는 쓰기. 음원 제작 계약 service.ts와 같은 규칙:
 * - 허용 상태를 UPDATE 조건에 건다(읽기와 쓰기 사이 틈에서 동시 요청이 서명된 계약의 본문까지 바꾸는 것을 막는다).
 * - 조건이 맞지 않으면 null/false를 돌려 호출부가 409로 거절하게 한다.
 * - 서명자가 한 명이라 서명과 성립을 **한 문장**으로 쓴다 — 본문(계약일 = 서명 시각)과 지문을 미리 계산해 넣는다.
 */

/** 발송 버튼 연타·동시 요청 방어. */
const RESEND_COOLDOWN_MS = 10_000;

export interface LessonContractInput {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
}

export type CreateLessonContractResult = { ok: true; contract: LessonContract } | { ok: false; message: string };

const nameOk = (v: string): boolean => v.trim() !== '' && v.trim().length <= 50;
const emailOk = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) && v.trim().length <= 254;
const phoneOk = (v: string): boolean => v.replace(/\D/g, '').length >= 9 && v.trim().length <= 20;

export const validateLessonContractInput = (raw: unknown): { ok: true; value: LessonContractInput } | { ok: false; message: string } => {
  const b = (raw ?? {}) as Record<string, unknown>;
  const studentName = typeof b.studentName === 'string' ? b.studentName.trim() : '';
  const studentEmail = typeof b.studentEmail === 'string' ? b.studentEmail.trim() : '';
  const studentPhone = typeof b.studentPhone === 'string' ? b.studentPhone.trim() : '';
  if (!nameOk(studentName)) return { ok: false, message: '수강생 이름을 1~50자로 적어 주세요.' };
  if (!emailOk(studentEmail)) return { ok: false, message: '이메일 형식이 올바르지 않아요.' };
  if (!phoneOk(studentPhone)) return { ok: false, message: '연락처를 확인해 주세요(본인 확인에 뒤 4자리를 써요).' };
  return { ok: true, value: { studentName, studentEmail, studentPhone } };
};

/** 수강 등록의 지금 조건으로 계약 초안을 만든다. 한 수강에는 취소되지 않은 계약이 하나만 있다. 메일은 보내지 않는다(발송은 운영자 서명). */
export const createLessonContract = async (enrollmentId: string, input: LessonContractInput, actor: string): Promise<CreateLessonContractResult> => {
  const db = getDb();
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, enrollmentId));
  if (!enrollment) return { ok: false, message: '수강 등록을 찾을 수 없어요.' };
  if (enrollment.status === 'ended') return { ok: false, message: '중도 종료된 수강에는 계약을 만들 수 없어요.' };
  const live = await db.select({ id: lessonContracts.id }).from(lessonContracts)
    .where(and(eq(lessonContracts.enrollmentId, enrollmentId), inArray(lessonContracts.status, ['draft', 'sent', 'signed', 'expired']), isNull(lessonContracts.purgedAt)));
  if (live.length > 0) return { ok: false, message: '이미 진행 중인 계약이 있어요. 바꾸려면 그 계약을 취소하고 새로 만들어 주세요.' };

  const terms = buildLessonTerms(enrollment);
  const template = readLessonTemplate();
  const id = randomUUID();
  const now = new Date();
  await db.insert(lessonContracts).values({
    id, enrollmentId, status: 'draft',
    studentName: input.studentName, studentEmail: input.studentEmail, studentPhone: input.studentPhone,
    termsJson: canonicalLessonTermsJson(terms),
    clausesJson: JSON.stringify(buildLessonClauses()),
    template, templateHash: hashTemplate(template),
    content: buildLessonContent({ studentName: input.studentName, studentPhone: input.studentPhone, terms, contractDate: null }, template),
    createdBy: actor, createdAt: now, updatedAt: now,
  });
  const [contract] = await db.select().from(lessonContracts).where(eq(lessonContracts.id, id));
  if (!contract) throw new Error('수강 계약을 만들었지만 다시 읽지 못했습니다.');
  return { ok: true, contract };
};

/** 초안의 수강생 정보를 고친다 — 본문도 같은 조건·지금 템플릿으로 다시 만든다. */
export const updateDraftLessonContract = async (contractId: string, input: LessonContractInput): Promise<LessonContract | null> => {
  const db = getDb();
  const [current] = await db.select().from(lessonContracts).where(eq(lessonContracts.id, contractId));
  if (!current) return null;
  const [enrollment] = await db.select().from(lessonEnrollments).where(eq(lessonEnrollments.id, current.enrollmentId));
  if (!enrollment) return null;
  const terms = buildLessonTerms(enrollment);
  const template = readLessonTemplate();
  const [updated] = await db.update(lessonContracts).set({
    studentName: input.studentName, studentEmail: input.studentEmail, studentPhone: input.studentPhone,
    termsJson: canonicalLessonTermsJson(terms), clausesJson: JSON.stringify(buildLessonClauses()),
    template, templateHash: hashTemplate(template),
    content: buildLessonContent({ studentName: input.studentName, studentPhone: input.studentPhone, terms, contractDate: null }, template),
    updatedAt: new Date(),
  }).where(and(eq(lessonContracts.id, contractId), eq(lessonContracts.status, 'draft'))).returning();
  return updated ?? null;
};

/** 만료 기한이 지난 발송 건을 expired로 내린다(lazy — 화면·서명 접근 시). 실패해도 주 흐름은 막지 않는다. */
export const expireOverdueLessonContracts = async (now: Date = new Date()): Promise<number> => {
  try {
    const result = await getDb().update(lessonContracts).set({ status: 'expired', updatedAt: now })
      .where(and(eq(lessonContracts.status, 'sent'), lte(lessonContracts.expiresAt, now)));
    return result.rowsAffected ?? 0;
  } catch (error: unknown) {
    console.error('[contracts/lesson/service] Failed to expire overdue contracts:', error);
    return 0;
  }
};

export type SendLessonResult =
  | { ok: true; contract: LessonContract; signUrl: string; emailSent: boolean }
  | { ok: false; code: 'not_found' | 'invalid_state' | 'draft_text' | 'cooldown'; message: string };

/**
 * 발송한다 — **운영자가 서명하는 행위이기도 하다.** draft → sent(첫 발송), sent·expired → sent(재발송, 새 토큰으로 옛 링크 즉시 무효).
 * **확정 전 표시가 남은 본문은 발송하지 않는다**(template.ts DRAFT_MARKER) — 환불 조항을 법률 확인하기 전에 실제로 나가는 일이 없게.
 * 메일이 실패해도 계약은 sent이고 링크를 돌려준다(운영자가 카톡으로 보낼 수 있게).
 */
export const sendLessonContract = async (contractId: string, options: { adminActor: string; ipAddress: string | null }): Promise<SendLessonResult> => {
  const db = getDb();
  const [current] = await db.select().from(lessonContracts).where(eq(lessonContracts.id, contractId));
  if (!current || current.purgedAt) return { ok: false, code: 'not_found', message: '계약을 찾을 수 없어요.' };
  const action = current.status === 'draft' ? 'send' : 'resend';
  const allowed = checkLessonAction(current.status, action);
  if (!allowed.ok) return { ok: false, code: 'invalid_state', message: allowed.message };
  // 발송 전 본문을 지금 템플릿으로 다시 만들지 않는다(초안을 고칠 때 이미 떴다) — 표시가 남아 있으면 거절한다.
  if (hasDraftMarker(current.content) || hasDraftMarker(current.template)) {
    return { ok: false, code: 'draft_text', message: '계약서 문안에 확정 전 조항(제9조 환불)이 남아 있어 보낼 수 없어요. 교습비 반환 기준을 법률 확인한 뒤 문안을 확정해야 해요.' };
  }
  const now = new Date();
  const token = generateSignToken();
  const claimed = await db.update(lessonContracts).set({
    status: 'sent', sentAt: now, expiresAt: computeExpiresAt(now), signToken: token,
    operatorActor: options.adminActor, operatorSignedAt: now, operatorIp: options.ipAddress, notificationError: null, updatedAt: now,
  }).where(and(
    eq(lessonContracts.id, contractId),
    inArray(lessonContracts.status, action === 'send' ? ['draft'] : ['sent', 'expired']),
    or(isNull(lessonContracts.sentAt), lte(lessonContracts.sentAt, new Date(now.getTime() - RESEND_COOLDOWN_MS))),
    isNull(lessonContracts.purgedAt),
  )).returning();
  if (claimed.length === 0) return { ok: false, code: 'cooldown', message: '방금 이미 처리됐어요. 잠시 뒤 새로고침해 주세요.' };

  const contract = claimed[0];
  const signUrl = buildLessonSignUrl(contract.id, token);
  let emailSent = false;
  try {
    const mail = await sendLessonSignRequestEmail(contract, parseLessonTerms(contract.termsJson), signUrl);
    emailSent = mail.ok;
    if (!mail.ok) await db.update(lessonContracts).set({ notificationError: mail.errorCode ?? 'send_failed' }).where(eq(lessonContracts.id, contract.id));
  } catch (error: unknown) {
    console.error('[contracts/lesson/service] 서명 요청 메일 실패:', error instanceof Error ? error.message : String(error));
    await db.update(lessonContracts).set({ notificationError: 'send_exception' }).where(eq(lessonContracts.id, contract.id)).catch(() => undefined);
  }
  sendLessonOperatorNotification(contract, parseLessonTerms(contract.termsJson), false).catch((error: unknown) => {
    console.error('[contracts/lesson/service] 운영자 알림 실패:', error instanceof Error ? error.message : String(error));
  });
  return { ok: true, contract, signUrl, emailSent };
};

export const cancelLessonContract = async (contractId: string): Promise<boolean> => {
  const result = await getDb().update(lessonContracts).set({ status: 'cancelled', signToken: null, updatedAt: new Date() })
    .where(and(eq(lessonContracts.id, contractId), inArray(lessonContracts.status, ['draft', 'sent', 'expired']), isNull(lessonContracts.purgedAt)));
  return Number(result.rowsAffected) > 0;
};

export interface SignLessonInput {
  contractId: string;
  token: string;
  now: Date;
  signatureData: string;
  ipAddress: string | null;
  userAgent: string;
  agreedClauseKeys: readonly string[];
  studentBirthdate: string;
  studentAddress: string;
}

/**
 * 수강생 서명 + 계약 성립을 한 문장으로. 본문(계약일 = now)과 지문은 읽은 상태로 미리 만들어 넣고, UPDATE 조건이 "이 토큰·발송됨·미만료·운영자 서명 있음"일 때만
 * 쓴다 — 동시에 두 번 눌러도 먼저 온 쪽만 1행이다. 반환 false면 호출부가 실제 상태를 읽어 안내한다.
 */
export const signLessonContract = async (input: SignLessonInput): Promise<'signed' | 'conflict' | 'not_found'> => {
  const db = getDb();
  const [contract] = await db.select().from(lessonContracts).where(eq(lessonContracts.id, input.contractId));
  if (!contract || contract.signToken !== input.token) return 'not_found';
  const terms = parseLessonTerms(contract.termsJson);
  const clauses = parseLessonClauses(contract.clausesJson);
  const content = buildLessonContent({
    studentName: contract.studentName, studentPhone: contract.studentPhone, studentBirthdate: input.studentBirthdate, studentAddress: input.studentAddress, terms, contractDate: input.now,
  }, contract.template);
  const signed = {
    ...contract, studentBirthdate: input.studentBirthdate, studentAddress: input.studentAddress, content,
    signatureData: input.signatureData, signerIp: input.ipAddress, identityVerifiedAt: input.now,
  };
  const contentHash = computeLessonFingerprint({ contract: signed, clauses, signedAt: input.now });
  const result = await db.update(lessonContracts).set({
    status: 'signed', signedAt: input.now, studentBirthdate: input.studentBirthdate, studentAddress: input.studentAddress,
    content, contentHash, signatureData: input.signatureData, signerIp: input.ipAddress, signerUserAgent: input.userAgent,
    identityVerifiedAt: input.now, agreedClauses: JSON.stringify(input.agreedClauseKeys), signToken: contract.signToken, updatedAt: input.now,
  }).where(and(
    eq(lessonContracts.id, input.contractId),
    eq(lessonContracts.status, 'sent'),
    eq(lessonContracts.signToken, input.token),
    sql`${lessonContracts.operatorSignedAt} IS NOT NULL`,
    sql`(${lessonContracts.expiresAt} IS NULL OR ${lessonContracts.expiresAt} > ${Math.floor(input.now.getTime() / 1000)})`,
    isNull(lessonContracts.purgedAt),
  ));
  return Number(result.rowsAffected) > 0 ? 'signed' : 'conflict';
};

/** 체결 뒤 후처리 — 수강생 확인 메일과 운영자 알림. 실패해도 계약은 이미 성립했다(기록만 남긴다). */
export const finalizeSignedLessonContract = async (contractId: string): Promise<void> => {
  const db = getDb();
  const [contract] = await db.select().from(lessonContracts).where(eq(lessonContracts.id, contractId));
  if (!contract || contract.status !== 'signed' || !contract.signToken) return;
  const terms = parseLessonTerms(contract.termsJson);
  let failure: string | null = null;
  try {
    const mail = await sendLessonSignedEmail(contract, terms, buildLessonCompleteUrl(contract.id, contract.signToken));
    if (!mail.ok) failure = mail.errorCode ?? 'send_failed';
  } catch (error: unknown) {
    failure = error instanceof Error ? error.message.slice(0, 100) : 'send_exception';
  }
  await sendLessonOperatorNotification(contract, terms, true).catch((error: unknown) => {
    console.error('[contracts/lesson/service] 운영자 체결 알림 실패:', error instanceof Error ? error.message : String(error));
  });
  await db.update(lessonContracts).set({ notificationError: failure, notifiedAt: failure ? null : new Date() }).where(eq(lessonContracts.id, contractId));
};

/** 서명 화면을 처음 열었을 때만 시각을 남긴다. */
export const markLessonContractViewed = async (contractId: string, now: Date = new Date()): Promise<void> => {
  await getDb().update(lessonContracts).set({ firstViewedAt: now }).where(and(eq(lessonContracts.id, contractId), isNull(lessonContracts.firstViewedAt))).catch(() => undefined);
};

export const listLessonContractsFor = async (enrollmentId: string): Promise<LessonContract[]> =>
  getDb().select().from(lessonContracts).where(eq(lessonContracts.enrollmentId, enrollmentId)).orderBy(desc(lessonContracts.createdAt));
