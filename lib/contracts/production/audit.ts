import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import { parseStoredClauses } from './clauses';
import { verifyProductionFingerprint } from './integrity';

/** 눈으로 대조하는 짧은 표기 `A1B2-C3D4`(연습실 formatFingerprintForDisplay와 같은 모양 — 접두사만 다르다). */
const shortOf = (fingerprint: string): string => {
  const hex = (fingerprint.split(':').pop() ?? fingerprint).slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
};

export type ProductionFingerprintVerdict =
  | { kind: 'unsigned' }
  | { kind: 'purged'; short: string }
  | { kind: 'match'; short: string; full: string }
  | { kind: 'mismatch'; short: string; full: string }
  | { kind: 'unverifiable'; reason: string };

/**
 * 관리자 상세 화면의 문서 지문 대조. "서명한 적 없다"·"내용이 달랐다"는 주장에 내놓을 것이 이 결과와
 * 서명자별 열람·서명 기록이다(연습실 audit-trail.ts와 같은 질문에 답한다).
 *
 * 연습실처럼 "모른다"와 "다르다"를 나눈다 — 파기된 계약은 본문이 지워져 반드시 어긋나므로 대조하지 않는다.
 */
export const verifyStoredProductionContract = (
  contract: ProductionContract & { signers: ProductionContractSigner[] },
): ProductionFingerprintVerdict => {
  if (!contract.signedAt) return { kind: 'unsigned' };

  const stored = contract.contentHash;
  if (contract.purgedAt) return { kind: 'purged', short: stored ? shortOf(stored) : '-' };

  try {
    const check = verifyProductionFingerprint(stored, {
      contract,
      clauses: parseStoredClauses(contract.clausesJson),
      signers: contract.signers,
      signedAt: contract.signedAt,
    });
    if (check.status === 'match') {
      return { kind: 'match', short: shortOf(check.fingerprint), full: check.fingerprint };
    }
    if (check.status === 'mismatch') {
      return { kind: 'mismatch', short: shortOf(check.expected), full: check.expected };
    }
    return { kind: 'unverifiable', reason: check.reason };
  } catch (error: unknown) {
    console.error('[contracts/production/audit] Failed to verify fingerprint:', error);
    return { kind: 'unverifiable', reason: 'error' };
  }
};
