import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  contractAttachments,
  contractClauses,
  contracts,
  signatures,
  type Contract,
} from '../../db/schema';
import { sendContractCreatedEmail, sendOperatorContractNotification } from './email';
import { computeExpiresAt, type ContractStatus } from './status';
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
    const result = await getDb()
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

  const [contract] = await getDb()
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

  await getDb().insert(signatures).values({
    contractId: contract.id,
    signerName: data.customerName,
    signerEmail: data.customerEmail,
    signerRole: 'customer',
    status: 'pending',
  });

  await getDb().insert(contractClauses).values(
    REQUIRED_CLAUSES.map((clause) => ({
      contractId: contract.id,
      clauseNumber: clause.clauseNumber,
      title: clause.title,
    })),
  );

  await getDb().insert(contractAttachments).values(
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

  const [updated] = await getDb()
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
  await getDb()
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
 * 발송할 때마다 signToken을 새로 발급한다. draft 단계에서도 관리자 화면에 서명 링크가
 * 보이므로, 발송 전에 새어 나간 토큰이 발송 후까지 살아 있으면 안 된다. 재발송이면
 * 같은 이유로 이전 링크가 무효가 된다.
 *
 * 동시 요청은 두 가지로 막는다. 허용 상태를 UPDATE 조건에 걸고, 직전 발송 이후
 * 짧은 쿨다운을 둔다. 상태만으로는 부족하다 — 재발송은 sent에서 sent로 가므로 조건이
 * 그대로 참이라, 두 요청이 모두 통과해 토큰이 연달아 바뀌고 먼저 보낸 메일의 링크가
 * 그 자리에서 죽는다.
 *
 * 이메일은 호출부가 응답을 보낸 뒤 이어서 처리하도록 분리했다.
 */
const RESEND_COOLDOWN_MS = 10_000;

export const markContractSent = async (
  contractId: string,
  options: { allowedStatuses: readonly ContractStatus[] },
): Promise<SendContractResult | null> => {
  const now = new Date();
  const cooldownBoundary = new Date(now.getTime() - RESEND_COOLDOWN_MS);

  const [contract] = await getDb()
    .update(contracts)
    .set({
      status: 'sent',
      sentAt: now,
      expiresAt: computeExpiresAt(now),
      signedAt: null,
      signTokenUsedAt: null,
      signToken: generateSignToken(),
      updatedAt: now,
    })
    .where(
      and(
        eq(contracts.id, contractId),
        inArray(contracts.status, [...options.allowedStatuses]),
        // 첫 발송은 sentAt이 비어 있어 그대로 통과한다.
        or(isNull(contracts.sentAt), lte(contracts.sentAt, cooldownBoundary)),
      ),
    )
    .returning();

  if (!contract) return null;

  return { contract, signUrl: buildSignUrl(contract.id, contract.signToken) };
};

/**
 * 알림 메일 결과를 계약에 남긴다.
 *
 * 발송은 응답 이후에 처리되므로 실패해도 사용자에게 전달할 방법이 없다. 결과를
 * 기록해 두어야 관리자 화면에서 "메일이 안 나갔다"는 사실이 드러나고, 재발송이든
 * 링크 직접 전달이든 손을 쓸 수 있다.
 */
const recordNotificationResult = async (
  contractId: string,
  error: string | null,
): Promise<void> => {
  try {
    await getDb()
      .update(contracts)
      .set({ notificationError: error, notifiedAt: new Date() })
      .where(eq(contracts.id, contractId));
  } catch (dbError: unknown) {
    console.error('[contracts/service] Failed to record notification result:', dbError);
  }
};

/**
 * 발송 알림 메일(고객 + 운영자).
 *
 * 고객 메일 실패만 계약에 기록한다 — 운영자 알림은 못 받아도 관리자가 화면에서 상태를
 * 볼 수 있지만, 고객이 서명 링크를 못 받으면 계약 자체가 멈추기 때문이다.
 */
export const sendContractNotifications = async (
  contract: Contract,
  signUrl: string,
): Promise<void> => {
  try {
    const [customerResult, operatorResult] = await Promise.all([
      sendContractCreatedEmail(contract, signUrl),
      sendOperatorContractNotification(contract, false),
    ]);

    if (!operatorResult.ok) {
      console.error('[contracts/service] Operator notification failed:', operatorResult);
    }

    if (!customerResult.ok) {
      console.error('[contracts/service] Customer email failed:', customerResult);
      await recordNotificationResult(
        contract.id,
        `서명 요청 메일 발송 실패 (${customerResult.errorCode ?? 'UNKNOWN'})`,
      );
      return;
    }

    await recordNotificationResult(contract.id, null);
  } catch (error: unknown) {
    console.error('[contracts/service] Failed to send contract emails:', error);
    await recordNotificationResult(contract.id, '서명 요청 메일 발송 중 오류가 발생했습니다.');
  }
};

export const cancelContract = async (contractId: string): Promise<Contract> => {
  const [contract] = await getDb()
    .update(contracts)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(contracts.id, contractId))
    .returning();
  return contract;
};

export const deleteContract = async (contractId: string): Promise<void> => {
  // SQLite 외래키 CASCADE가 PRAGMA에 의존하므로 자식 행을 명시적으로 지운다.
  await getDb().delete(signatures).where(eq(signatures.contractId, contractId));
  await getDb().delete(contractClauses).where(eq(contractClauses.contractId, contractId));
  await getDb().delete(contractAttachments).where(eq(contractAttachments.contractId, contractId));
  await getDb().delete(contracts).where(eq(contracts.id, contractId));
};
