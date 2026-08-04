import { and, eq, exists, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from '../../db/schema';
import { contractAttachments, contractClauses, contracts, signatures } from '../../db/schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface SignStatementInput {
  contractId: string;
  signatureId: string;
  now: Date;
  signatureData: string;
  ipAddress: string | null;
  userAgent: string;
  contentHash: string;
}

/**
 * 서명 확정에 필요한 쓰기 묶음.
 *
 * batch는 트랜잭션이지만, 조건부 UPDATE가 0행인 것은 실패가 아니다 — 트랜잭션은 그대로
 * 커밋되고 호출부는 rowsAffected를 보고 409를 돌려줄 뿐이라, 이미 쓰인 것은 되돌아가지
 * 않는다. 그래서 모든 문장이 "계약이 아직 서명 대기"라는 같은 조건에 걸려야 한다.
 *
 * 계약 쪽에만 조건을 걸어 두면, 관리자가 계약을 취소한 순간과 서명 제출이 겹쳤을 때
 * 계약은 그대로인데 서명행만 signed로 확정된다. 그 계약은 재발송해도 서명 대기 행이
 * 없어 영원히 서명할 수 없게 된다.
 *
 * 계약 UPDATE가 맨 뒤에 있는 것이 중요하다. 앞에 두면 그것이 status를 signed로 바꾼 뒤
 * 뒤따르는 EXISTS가 전부 거짓이 되어, 정상 서명에서도 아무것도 기록되지 않는다.
 *
 * 반환 순서: [서명행, 조항, 첨부, 계약]
 */
export const buildSignStatements = (db: Database, input: SignStatementInput) => {
  const { contractId, signatureId, now, signatureData, ipAddress, userAgent, contentHash } = input;

  const contractAwaitingSignature = exists(
    db
      .select({ ok: sql`1` })
      .from(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.status, 'sent'))),
  );

  return [
    db
      .update(signatures)
      .set({
        status: 'signed',
        signedAt: now,
        signatureData,
        ipAddress,
        userAgent,
        updatedAt: now,
      })
      .where(
        and(
          eq(signatures.id, signatureId),
          eq(signatures.status, 'pending'),
          contractAwaitingSignature,
        ),
      ),
    // 동의 시각은 최초 서명 때만 남긴다(재실행이 감사 기록을 밀어내지 않도록).
    db
      .update(contractClauses)
      .set({ agreedAt: now })
      .where(
        and(
          eq(contractClauses.contractId, contractId),
          isNull(contractClauses.agreedAt),
          contractAwaitingSignature,
        ),
      ),
    db
      .update(contractAttachments)
      .set({ agreedAt: now })
      .where(
        and(
          eq(contractAttachments.contractId, contractId),
          isNull(contractAttachments.agreedAt),
          contractAwaitingSignature,
        ),
      ),
    db
      .update(contracts)
      .set({
        status: 'signed',
        signedAt: now,
        signTokenUsedAt: now,
        rulesAgreed: true,
        rulesAgreedAt: now,
        identityVerifiedAt: now,
        contentHash,
        updatedAt: now,
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.status, 'sent'))),
  ] as const;
};
