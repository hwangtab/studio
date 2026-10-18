import { and, eq, exists, gt, isNull, or, sql } from 'drizzle-orm';
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
  /** 서명자가 채운 자기 정보와 그것으로 완성한 본문, 그 본문으로 계산한 지문. */
  clientBirthdate: string;
  clientAddress: string;
  content: string;
  contentHash: string;
}

/**
 * 서명 확정 쓰기 묶음 — 연습실 sign-transaction.ts와 같은 원리다.
 *
 * batch는 트랜잭션이지만 조건부 UPDATE가 0행인 것은 실패가 아니라서, 앞 문장이 쓴 것은 그대로 커밋된다.
 * 그래서 두 문장이 같은 사건에 걸려야 한다:
 *
 * 1. 서명자 행: "이 서명자가 아직 대기 + 이 토큰 + 계약이 서명 대기이고 미만료"일 때만 signed.
 * 2. 계약 행: "계약이 아직 서명 대기 + 이 서명자가 이 토큰으로 서명됨"일 때만 signed.
 *
 * 계약을 뒤에 두는 이유: 앞에 두면 계약이 signed가 된 뒤 1의 EXISTS(계약 sent)가 거짓이 되어 서명자 행이
 * 기록되지 않는다. 1이 0행이면(재발송·취소·만료와 겹침) 2의 EXISTS가 거짓이라 계약도 그대로 남는다 —
 * "계약은 그대로인데 서명자만 signed" 같은 반쪽 상태가 생기지 않는다.
 *
 * 토큰 조건(#13, 연습실): 재발송은 토큰을 회전시킨다. 옛 링크로 폼을 채우는 사이 재발송됐다면 그 서명은
 * 커밋되면 안 된다 — "재발송하면 옛 링크는 즉시 무효"가 거짓이 된다.
 *
 * 반환 순서: [서명자, 계약]
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
        ),
      ),
  );

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
    db
      .update(productionContractSigners)
      .set({
        status: 'signed',
        signedAt: now,
        identityVerifiedAt: now,
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
      ),
    db
      .update(productionContracts)
      .set({
        status: 'signed',
        signedAt: now,
        clientBirthdate: input.clientBirthdate,
        clientAddress: input.clientAddress,
        content: input.content,
        contentHash: input.contentHash,
        updatedAt: now,
      })
      .where(
        and(
          eq(productionContracts.id, contractId),
          eq(productionContracts.status, 'sent'),
          signerSignedWithThisToken,
        ),
      ),
  ] as const;
};
