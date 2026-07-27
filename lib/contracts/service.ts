import { and, eq, lte } from 'drizzle-orm';

import { db } from '../../db/client';
import {
  contractAttachments,
  contractClauses,
  contracts,
  signatures,
  type Contract,
} from '../../db/schema';
import { sendContractCreatedEmail, sendOperatorContractNotification } from './email';
import { computeExpiresAt } from './status';
import { buildContractContent } from './template';
import { buildSignUrl, generateSignToken } from './token';
import type { CreateContractPayload } from './validation';

/**
 * 서명 시 필수 동의를 받는 조항. 계약 생성 시 contract_clauses로 복제해 두고,
 * 서명 시점에 각 항목의 agreedAt을 기록한다(동의 이력의 증거).
 */
export const REQUIRED_CLAUSES = [
  { clauseNumber: '제5조', title: '보증금 및 그 납부 면제' },
  { clauseNumber: '제6조', title: '금지행위' },
  { clauseNumber: '제9조', title: '계약의 해지' },
  { clauseNumber: '제12조', title: '개인정보의 수집 및 이용' },
] as const;

export const REQUIRED_ATTACHMENTS = [
  { type: 'rules', title: '공동생활 이용수칙' },
] as const;

/**
 * 만료 기한이 지난 발송 건을 expired로 내린다. 크론 대신 목록·서명 페이지 접근 시
 * 호출하는 lazy 방식이다. 실패해도 호출부의 주 흐름은 막지 않는다.
 */
export const expireOverdueContracts = async (now: Date = new Date()): Promise<number> => {
  try {
    const result = await db
      .update(contracts)
      .set({ status: 'expired', updatedAt: now })
      .where(and(eq(contracts.status, 'sent'), lte(contracts.expiresAt, now)));
    return result.rowsAffected ?? 0;
  } catch (error: unknown) {
    console.error('[contracts/service] Failed to expire overdue contracts:', error);
    return 0;
  }
};

/** 계약을 draft로 생성한다. 이메일은 발송하지 않는다(발송은 별도 액션). */
export const createContract = async (data: CreateContractPayload): Promise<Contract> => {
  const content = buildContractContent({
    customerName: data.customerName,
    customerBirthdate: data.customerBirthdate,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    roomNumber: data.roomNumber,
    roomArea: data.roomArea,
    startDate: data.startDate,
    endDate: data.endDate,
    monthlyRent: data.monthlyRent,
    depositAmount: data.depositAmount,
    paymentDay: data.paymentDay,
    contractDate: new Date().toISOString(),
    specialTerms: data.specialTerms,
  });

  const [contract] = await db
    .insert(contracts)
    .values({
      title: data.title,
      customerName: data.customerName,
      customerBirthdate: data.customerBirthdate,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      roomNumber: data.roomNumber,
      roomArea: data.roomArea ?? '3m × 2m',
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      monthlyRent: data.monthlyRent,
      depositAmount: data.depositAmount,
      paymentDay: data.paymentDay ?? 1,
      content,
      status: 'draft',
      signToken: generateSignToken(),
      specialTerms: data.specialTerms ? JSON.stringify(data.specialTerms) : undefined,
    })
    .returning();

  await db.insert(signatures).values({
    contractId: contract.id,
    signerName: data.customerName,
    signerEmail: data.customerEmail,
    signerRole: 'customer',
    status: 'pending',
  });

  await db.insert(contractClauses).values(
    REQUIRED_CLAUSES.map((clause) => ({
      contractId: contract.id,
      clauseNumber: clause.clauseNumber,
      title: clause.title,
    })),
  );

  await db.insert(contractAttachments).values(
    REQUIRED_ATTACHMENTS.map((attachment) => ({
      contractId: contract.id,
      type: attachment.type,
      title: attachment.title,
    })),
  );

  return contract;
};

/** draft 상태 계약의 내용을 갱신하고 본문을 다시 만든다. */
export const updateDraftContract = async (
  contractId: string,
  data: CreateContractPayload,
): Promise<Contract> => {
  const content = buildContractContent({
    customerName: data.customerName,
    customerBirthdate: data.customerBirthdate,
    customerPhone: data.customerPhone,
    customerAddress: data.customerAddress,
    roomNumber: data.roomNumber,
    roomArea: data.roomArea,
    startDate: data.startDate,
    endDate: data.endDate,
    monthlyRent: data.monthlyRent,
    depositAmount: data.depositAmount,
    paymentDay: data.paymentDay,
    contractDate: new Date().toISOString(),
    specialTerms: data.specialTerms,
  });

  const [updated] = await db
    .update(contracts)
    .set({
      title: data.title,
      customerName: data.customerName,
      customerBirthdate: data.customerBirthdate,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      roomNumber: data.roomNumber,
      roomArea: data.roomArea ?? '3m × 2m',
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      monthlyRent: data.monthlyRent,
      depositAmount: data.depositAmount,
      paymentDay: data.paymentDay ?? 1,
      content,
      specialTerms: data.specialTerms ? JSON.stringify(data.specialTerms) : null,
      updatedAt: new Date(),
    })
    .where(eq(contracts.id, contractId))
    .returning();

  // 서명자 정보도 함께 따라가야 서명 페이지의 기본값이 어긋나지 않는다.
  await db
    .update(signatures)
    .set({ signerName: data.customerName, signerEmail: data.customerEmail, updatedAt: new Date() })
    .where(and(eq(signatures.contractId, contractId), eq(signatures.status, 'pending')));

  return updated;
};

export interface SendContractResult {
  contract: Contract;
  signUrl: string;
}

/**
 * 계약을 발송한다(draft → sent, 또는 재발송).
 *
 * 재발송이면 signToken을 새로 발급해 이전 링크를 무효화한다. 이메일 발송은 호출부가
 * 응답을 보낸 뒤 이어서 처리할 수 있도록 별도 함수로 분리했다.
 */
export const markContractSent = async (
  contractId: string,
  options: { regenerateToken: boolean },
): Promise<SendContractResult> => {
  const now = new Date();
  const signToken = options.regenerateToken ? generateSignToken() : undefined;

  const [contract] = await db
    .update(contracts)
    .set({
      status: 'sent',
      sentAt: now,
      expiresAt: computeExpiresAt(now),
      signedAt: null,
      signTokenUsedAt: null,
      updatedAt: now,
      ...(signToken ? { signToken } : {}),
    })
    .where(eq(contracts.id, contractId))
    .returning();

  return { contract, signUrl: buildSignUrl(contract.id, contract.signToken) };
};

/** 발송 알림 메일(고객 + 운영자). 실패는 로그만 남기고 삼킨다 — 발송 자체는 이미 확정됐다. */
export const sendContractNotifications = async (
  contract: Contract,
  signUrl: string,
): Promise<void> => {
  try {
    const [customerResult, operatorResult] = await Promise.all([
      sendContractCreatedEmail(contract, signUrl),
      sendOperatorContractNotification(contract, false),
    ]);

    if (!customerResult.ok) {
      console.error('[contracts/service] Customer email failed:', customerResult);
    }
    if (!operatorResult.ok) {
      console.error('[contracts/service] Operator notification failed:', operatorResult);
    }
  } catch (error: unknown) {
    console.error('[contracts/service] Failed to send contract emails:', error);
  }
};

export const cancelContract = async (contractId: string): Promise<Contract> => {
  const [contract] = await db
    .update(contracts)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(contracts.id, contractId))
    .returning();
  return contract;
};

export const deleteContract = async (contractId: string): Promise<void> => {
  // SQLite 외래키 CASCADE가 PRAGMA에 의존하므로 자식 행을 명시적으로 지운다.
  await db.delete(signatures).where(eq(signatures.contractId, contractId));
  await db.delete(contractClauses).where(eq(contractClauses.contractId, contractId));
  await db.delete(contractAttachments).where(eq(contractAttachments.contractId, contractId));
  await db.delete(contracts).where(eq(contracts.id, contractId));
};
