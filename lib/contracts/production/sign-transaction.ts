import { and, eq, exists, gt, isNull, not, or, sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/libsql';

import type * as schema from '../../../db/schema';
import { productionContracts, productionContractSigners } from '../../../db/schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface ProductionSignStatementInput {
  contractId: string;
  signerId: string;
  /** 이 서명이 쓴 토큰. 재발송으로 바뀌었거나 만료됐으면 커밋되면 안 된다. */
  signToken: string;
  now: Date;
  signatureData: string;
  ipAddress: string | null;
  userAgent: string;
  agreedClauseKeys: readonly string[];
  /**
   * 의뢰인 서명일 때만 — 서명자가 채운 생년월일·주소. 본문은 여기서 만들지 않는다: 계약일은 마지막 서명이
   * 끝난 때라, 성립 단계(buildFinalizeStatement)가 이 값으로 본문을 완성한다.
   */
  clientDetails?: { clientBirthdate: string; clientAddress: string };
  /**
   * 링크 계약(open-link.ts)에서만 — 의뢰인이 서명 화면에서 적은 이름·활동명·이메일·연락처. 계약 행과 의뢰인
   * 서명자 행(이름·이메일은 서명란과 지문에 들어간다)에 함께 적는다. 비어 있던 계약에만 적는다(조건 참조).
   */
  openClient?: { clientName: string; clientStageName: string | null; clientEmail: string; clientPhone: string };
}

/**
 * 서명 한 사람분의 쓰기 — 연습실 sign-transaction.ts와 같은 원리(문장마다 같은 사건에 조건을 건다).
 *
 * 1. 서명자 행: "이 서명자가 대기 + 이 토큰 + 계약이 서명 대기이고 미만료"일 때만 signed.
 * 2. (의뢰인이면) 생년월일·주소: "계약이 서명 대기 + 이 서명자가 이 토큰으로 서명됨"일 때만.
 *
 * 계약을 signed로 바꾸는 일은 여기서 하지 않는다 — 서명자가 둘 이상(의뢰인·법정대리인)이면 누가 마지막인지
 * 이 요청만으로는 모른다. 둘이 동시에 서명하면 각자 읽은 상태에 상대 서명이 없어, 지문에 한쪽이 빠진다.
 * 그래서 성립은 buildFinalizeStatement가 **다시 읽은** 상태로 따로 한다.
 *
 * 반환 순서: [서명자, (의뢰인 정보)]
 */
export const buildProductionSignStatements = (db: Database, input: ProductionSignStatementInput) => {
  const { contractId, signerId, signToken, now } = input;

  const contractAwaitingSignature = exists(
    db
      .select({ ok: sql`1` })
      .from(productionContracts)
      .where(
        and(
          eq(productionContracts.id, contractId),
          eq(productionContracts.status, 'sent'),
          or(isNull(productionContracts.expiresAt), gt(productionContracts.expiresAt, now)),
          // 링크 계약은 의뢰인 칸이 아직 비어 있을 때만 서명을 받는다 — 서명자 행만 signed가 되고 계약 행이 비어 있는 채로
          // 성립하는 일이 없게, 아래 계약 행 UPDATE와 같은 조건을 서명자 문장에도 건다(둘이 함께 0행이 된다).
          ...(input.openClient ? [eq(productionContracts.clientPhone, '')] : []),
        ),
      ),
  );

  const signerStatement = db
    .update(productionContractSigners)
    .set({
      status: 'signed',
      signedAt: now,
      // 링크 계약은 연락처 뒷자리 대조를 하지 않는다 — 하지 않은 확인을 기록하지 않는다(서명본 PDF가 이 값으로 적는다).
      identityVerifiedAt: input.openClient ? null : now,
      // 의뢰인 연락처는 계약 행이 정본이다(서명자 행 phone은 법정대리인만 쓴다, schema.ts).
      ...(input.openClient ? { name: input.openClient.clientName, email: input.openClient.clientEmail } : {}),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      signatureData: input.signatureData,
      agreedClauses: JSON.stringify(input.agreedClauseKeys),
      updatedAt: now,
    })
    .where(
      and(
        eq(productionContractSigners.id, signerId),
        eq(productionContractSigners.contractId, contractId),
        eq(productionContractSigners.status, 'pending'),
        eq(productionContractSigners.signToken, signToken),
        contractAwaitingSignature,
      ),
    );

  if (!input.clientDetails) return [signerStatement] as const;

  const signerSignedWithThisToken = exists(
    db
      .select({ ok: sql`1` })
      .from(productionContractSigners)
      .where(
        and(
          eq(productionContractSigners.id, signerId),
          eq(productionContractSigners.status, 'signed'),
          eq(productionContractSigners.signToken, signToken),
        ),
      ),
  );

  return [
    signerStatement,
    db
      .update(productionContracts)
      .set({ ...input.clientDetails, ...(input.openClient ?? {}), updatedAt: now })
      .where(
        and(
          eq(productionContracts.id, contractId),
          eq(productionContracts.status, 'sent'),
          signerSignedWithThisToken,
          // 링크 계약의 의뢰인 칸은 비어 있을 때만 채운다 — 운영자가 적은 의뢰인을 서명자가 덮어쓰지 못하게.
          ...(input.openClient ? [eq(productionContracts.clientPhone, '')] : []),
        ),
      ),
  ] as const;
};

/**
 * 계약 성립 — 필요한 서명자가 **모두** 서명했을 때만 signed로 바꾸고, 완성한 본문(계약일 = 지금)과 지문을 남긴다.
 *
 * 본문·지문은 호출부가 방금 다시 읽은 상태로 만들어 넘긴다. 조건에 "대기 중인 서명자가 없다"를 넣어, 읽은 뒤 누가
 * 새로 대기가 될 일은 없지만(서명은 되돌아가지 않는다) 상태가 이미 바뀐 계약을 덮지 않게 한다. 둘이 동시에
 * 마지막 서명을 했다면 둘 다 같은 상태를 읽어 같은 지문을 내고, 먼저 온 쪽만 1행이다.
 */
export const buildFinalizeStatement = (
  db: Database,
  input: { contractId: string; now: Date; content: string; contentHash: string },
) =>
  db
    .update(productionContracts)
    .set({ status: 'signed', signedAt: input.now, content: input.content, contentHash: input.contentHash, updatedAt: input.now })
    .where(
      and(
        eq(productionContracts.id, input.contractId),
        eq(productionContracts.status, 'sent'),
        isNull(productionContracts.purgedAt),
        not(
          exists(
            db
              .select({ ok: sql`1` })
              .from(productionContractSigners)
              .where(
                and(eq(productionContractSigners.contractId, input.contractId), eq(productionContractSigners.status, 'pending')),
              ),
          ),
        ),
      ),
    );
