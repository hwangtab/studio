import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import type { Serialized } from '../serialize';
import { parseStoredClauses, type ProductionClause } from './clauses';
import { buildProductionSignUrl } from './links';
import { getEffectiveProductionStatus } from './status';
import { parseStoredTerms, type ProductionTerms } from './terms';

/**
 * 관리자 화면·API 응답용 형태. 연습실 serialize.ts와 같은 원칙:
 *
 * - 서명 토큰은 싣지 않는다(토큰을 아는 것은 서명 링크를 아는 것과 같다). 관리자에게 링크가 필요한 상태에서만
 *   signUrl로 준다.
 * - 템플릿 원문은 싣지 않는다 — 수 KB를 매 응답에 실을 이유가 없고, 화면은 완성된 본문(content)을 그린다.
 * - 상태는 만료가 반영된 실효 상태로 준다(lazy 만료).
 */
export type SerializedProductionSigner = Omit<Serialized<ProductionContractSigner>, 'signToken'>;

export interface AdminSerializedProductionContract
  extends Omit<Serialized<ProductionContract>, 'template' | 'termsJson' | 'clausesJson'> {
  terms: ProductionTerms;
  clauses: ProductionClause[];
  signers: SerializedProductionSigner[];
  /** 서명 대기·만료 상태에서만 채운다. 그 밖에는 빈 문자열. */
  signUrl: string;
}

const SIGNER_ORDER: readonly ProductionContractSigner['role'][] = ['operator', 'client', 'guardian'];

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

export const serializeProductionSigner = (signer: ProductionContractSigner): SerializedProductionSigner => {
  const { signToken: _signToken, ...rest } = signer;
  return {
    ...rest,
    identityVerifiedAt: iso(signer.identityVerifiedAt),
    firstViewedAt: iso(signer.firstViewedAt),
    lastViewedAt: iso(signer.lastViewedAt),
    signedAt: iso(signer.signedAt),
    createdAt: signer.createdAt.toISOString(),
    updatedAt: signer.updatedAt.toISOString(),
  };
};

export const serializeProductionContractForAdmin = (
  contract: ProductionContract & { signers: ProductionContractSigner[] },
  now: Date = new Date(),
): AdminSerializedProductionContract => {
  const { template: _template, termsJson, clausesJson, signers, ...rest } = contract;
  const status = getEffectiveProductionStatus(contract, now);
  const clientToken = signers.find((signer) => signer.role === 'client')?.signToken ?? null;

  return {
    ...rest,
    status,
    terms: parseStoredTerms(termsJson),
    clauses: parseStoredClauses(clausesJson),
    // 계약서 서명란과 같은 순서(스튜디오 → 의뢰인 → 대리인). DB 조회 순서는 보장되지 않는다.
    signers: [...signers].sort((a, b) => SIGNER_ORDER.indexOf(a.role) - SIGNER_ORDER.indexOf(b.role)).map(serializeProductionSigner),
    signUrl: (status === 'sent' || status === 'expired') && clientToken ? buildProductionSignUrl(contract.id, clientToken) : '',
    sentAt: iso(contract.sentAt),
    expiresAt: iso(contract.expiresAt),
    signedAt: iso(contract.signedAt),
    pdfGeneratedAt: iso(contract.pdfGeneratedAt),
    notifiedAt: iso(contract.notifiedAt),
    completedAt: iso(contract.completedAt),
    terminatedAt: iso(contract.terminatedAt),
    purgedAt: iso(contract.purgedAt),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
};
