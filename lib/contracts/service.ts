import { randomUUID } from 'node:crypto';

import { and, eq, gte, inArray, isNull, lte, ne, or } from 'drizzle-orm';

import { getDb } from '../../db/client';
import {
  contractAttachments,
  contractClauses,
  contracts,
  signatures,
  type Contract,
} from '../../db/schema';
import { resetIdentityAttempts } from './admin-rate-limit';
import { sendContractCreatedEmail, sendOperatorContractNotification } from './email';
import { computeExpiresAt, type ContractStatus } from './status';
import { buildContractContent, buildRulesContent } from './template';
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

/**
 * 같은 호실을 이미 쓰고 있는 계약을 찾는다. 있으면 그 계약을 돌려준다.
 *
 * 연습실 호실은 한 사람이 쓰는 것을 전제로 하고(계약서 제6조 4항이 제3자 사용을
 * 금지한다), 겹치는 계약이 둘 다 서명되면 두 고객이 같은 방을 배정받는다. 두 계약
 * 모두 효력이 있어 어느 쪽도 물러설 근거가 없는 분쟁이 된다.
 *
 * ## 서명된 계약과 발송 대기 계약을 다르게 본다
 *
 * 서명된 계약은 **종료 처리를 하기 전까지 계속 방을 쓰는 것으로 본다.** 계약서 제3조는
 * 만료일까지 어느 쪽도 통지하지 않으면 1개월씩 자동 갱신된다고 정하므로, 종료일이 지났다는
 * 사실만으로 방이 비었다고 볼 수 없다. 기간 겹침만 보면 갱신해서 계속 쓰는 방이 만료일
 * 다음 날부터 "비어 있음"이 되어, 이중 임대를 막으려고 만든 검사가 조용히 무력해진다.
 *
 * 반대로 중도 퇴실로 방이 일찍 빈 경우에는 종료 처리를 하면 그 즉시 새 계약을 만들 수 있다.
 * 어느 쪽이든 "지금 이 방을 누가 쓰는가"에 대한 답은 운영자가 적은 것이지 날짜 계산이 아니다.
 *
 * 아직 서명 전인 발송 건은 기간 겹침으로 본다 — 서명될지 알 수 없는 계약이 방을 무기한
 * 잡아 두면 곤란하고, 만료되면 검사에서 빠진다.
 *
 * 확정된 것만 본다 — draft는 아직 고객에게 가지 않았고, 취소·만료·종료 건은 효력이 없다.
 */
export const findRoomConflict = async (params: {
  roomNumber: string;
  startDate: Date;
  endDate: Date;
  excludeContractId?: string;
}): Promise<Contract | null> => {
  const conditions = [
    eq(contracts.roomNumber, params.roomNumber),
    or(
      // 서명된 계약: 종료 처리 전까지 점유. 새 계약이 그 시작일 이후에 걸치면 충돌이다.
      and(
        eq(contracts.status, 'signed'),
        isNull(contracts.terminatedAt),
        lte(contracts.startDate, params.endDate),
      ),
      // 발송 대기: 기간이 하루라도 겹치면 충돌. 종료일 당일도 아직 이용 기간이다.
      and(
        eq(contracts.status, 'sent'),
        lte(contracts.startDate, params.endDate),
        gte(contracts.endDate, params.startDate),
      ),
    ),
  ];

  if (params.excludeContractId) {
    conditions.push(ne(contracts.id, params.excludeContractId));
  }

  const [conflict] = await getDb().select().from(contracts).where(and(...conditions)).limit(1);
  return conflict ?? null;
};

/**
 * 이용이 끝났음을 기록한다. 계약 문서 자체(본문·서명·지문)는 건드리지 않는다.
 *
 * 서명된 계약만 대상이다. 되돌릴 수 없으므로 호출부가 확인을 받아야 한다.
 * 이미 종료된 계약에는 아무 일도 일어나지 않고 null을 돌려준다(중복 클릭·경쟁 요청 방어).
 */
export const terminateContract = async (
  contractId: string,
  options: { reason: string; terminatedAt?: Date },
): Promise<Contract | null> => {
  const now = new Date();

  const [contract] = await getDb()
    .update(contracts)
    .set({
      status: 'terminated',
      terminatedAt: options.terminatedAt ?? now,
      terminationReason: options.reason,
      updatedAt: now,
    })
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.status, 'signed'),
        isNull(contracts.terminatedAt),
      ),
    )
    .returning();

  return contract ?? null;
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

  // 첨부 문서는 계약 시점 내용을 그대로 떠서 보관한다 — 원본 파일이 바뀌어도
  // 이미 체결된 계약의 첨부는 달라지지 않아야 한다.
  const rulesContent = buildRulesContent();

  /**
   * 네 개의 쓰기를 한 트랜잭션으로 묶는다.
   *
   * 나눠 실행하면 중간에 끊겼을 때 반쪽 계약이 남는다. 서명행 없이 계약만 있으면 고객이
   * 서명 페이지까지 가서도 제출이 거부되고(서명 대기 행이 없다), 동의 조항이 비어 있으면
   * 필수 동의를 하나도 받지 않은 채로 서명이 통과한다. 어느 쪽도 화면에서는 정상으로
   * 보이므로 운영자가 알아채는 시점이 고객의 전화다.
   *
   * 계약 ID를 먼저 만들어야 나머지가 그것을 참조할 수 있어, 서버가 만들던 기본값을
   * 여기서 직접 정한다.
   */
  const contractId = randomUUID();
  const now = new Date();

  await getDb().batch([
    getDb().insert(contracts).values({
      id: contractId,
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
      createdAt: now,
      updatedAt: now,
    }),
    getDb().insert(signatures).values({
      contractId,
      signerName: data.customerName,
      signerEmail: data.customerEmail,
      signerRole: 'customer',
      status: 'pending',
    }),
    getDb().insert(contractClauses).values(
      REQUIRED_CLAUSES.map((clause) => ({
        contractId,
        clauseNumber: clause.clauseNumber,
        title: clause.title,
      })),
    ),
    getDb().insert(contractAttachments).values(
      REQUIRED_ATTACHMENTS.map((attachment) => ({
        contractId,
        type: attachment.type,
        title: attachment.title,
        content: attachment.type === 'rules' ? rulesContent : null,
      })),
    ),
  ]);

  const contract = await getDb().query.contracts.findFirst({
    where: eq(contracts.id, contractId),
  });

  if (!contract) {
    throw new Error('계약을 만들었지만 다시 읽지 못했습니다.');
  }

  return contract;
};

/**
 * draft 상태 계약의 내용을 갱신하고 본문을 다시 만든다.
 *
 * 허용 상태를 UPDATE 조건에 함께 건다. 호출부가 미리 상태를 확인하지만 읽기와 쓰기
 * 사이에는 틈이 있어, 조건이 없으면 동시 요청으로 이미 서명된 계약의 본문까지 바꿀 수
 * 있다 — 고객이 동의하지 않은 내용에 서명이 붙은 형태가 되므로 문서 위조에 해당한다.
 * 조건이 맞지 않으면 null을 돌려 호출부가 거절하게 한다.
 */
export const updateDraftContract = async (
  contractId: string,
  data: CreateContractPayload,
): Promise<Contract | null> => {
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
    .where(and(eq(contracts.id, contractId), eq(contracts.status, 'draft')))
    .returning();

  if (!updated) return null;

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

  /**
   * 본인 확인 시도 기록을 지운다.
   *
   * 누적 상한에 걸려 잠긴 링크를 푸는 유일한 수단이다. 오타를 반복한 고객이 연락해 오면
   * 관리자가 다시 보내는 것으로 해결되고, 새 토큰이 나가므로 그 전에 쌓인 시도를 이어서
   * 세는 것도 맞지 않는다.
   */
  await resetIdentityAttempts(contract.id);

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

/** 서명 전 계약만 취소한다. 확정된 계약이 취소 상태로 바뀌지 않도록 조건을 건다. */
export const cancelContract = async (contractId: string): Promise<Contract | null> => {
  const [contract] = await getDb()
    .update(contracts)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(contracts.id, contractId),
        inArray(contracts.status, ['draft', 'sent', 'expired'] satisfies ContractStatus[]),
      ),
    )
    .returning();

  return contract ?? null;
};

/**
 * 계약을 지운다. 지울 수 있었으면 true.
 *
 * 계약 행을 조건부로 먼저 지우고, 성공했을 때만 딸린 기록을 정리한다. 순서를 뒤집으면
 * 조건이 맞지 않아 계약은 남았는데 서명 기록만 사라지는 최악의 결과가 나온다.
 * 서명이 끝난 계약은 어떤 경로로도 지워지면 안 된다 — 서명·동의 이력이 유일한 증거다.
 */
export const deleteContract = async (contractId: string): Promise<boolean> => {
  const [deleted] = await getDb()
    .delete(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        inArray(contracts.status, ['draft', 'cancelled'] satisfies ContractStatus[]),
      ),
    )
    .returning({ id: contracts.id });

  if (!deleted) return false;

  // SQLite 외래키 CASCADE가 PRAGMA에 의존하므로 남은 자식 행을 명시적으로 지운다.
  await getDb().batch([
    getDb().delete(signatures).where(eq(signatures.contractId, contractId)),
    getDb().delete(contractClauses).where(eq(contractClauses.contractId, contractId)),
    getDb().delete(contractAttachments).where(eq(contractAttachments.contractId, contractId)),
  ]);

  return true;
};
