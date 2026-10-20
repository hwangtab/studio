import { createHash } from 'node:crypto';

import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import { sized, toSeconds } from '../integrity';
import type { ProductionClause } from './clauses';

/**
 * 제작 계약 서명 시점 문서의 지문 — `p1:<sha256 hex>`.
 *
 * 원리는 연습실 지문(lib/contracts/integrity.ts)과 같다: 문서를 이루는 값을 라벨·길이를 붙여 한 문자열로
 * 모으고 SHA-256을 남긴다. 레지스트리는 따로 둔다. 연습실 v3·v4와 섞으면 "이 지문을 어느 표의 어느 형식으로
 * 재계산하는가"가 흐려진다. 접두사 p가 제작 계약을 뜻한다.
 *
 * 덮는 것: 계약서에 인쇄되거나 관리자 화면에 나오는 값 전부 — 본문, 계약 조건(terms_json), 의뢰인 정보,
 * 동의 항목, 서명자 전원(운영자 포함)의 서명 정황. 열람 기록은 넣지 않는다(서명된 문서가 아니라 그 주변
 * 정황이다 — 연습실 contracts.firstViewedAt 주석).
 *
 * 형식을 바꾸면 버전을 올리고 옛 builder를 남긴다. 지우면 그 버전으로 서명된 계약이 전부 검증 불가가 된다.
 */
/**
 * p2(0072): 서명자의 연락처·관계를 덮는다 — 법정대리인 칸이 계약서에 인쇄되기 때문이다. p1으로 서명된 계약은
 * p1 그대로 재계산한다(레지스트리에서 지우면 그 계약이 전부 검증 불가가 된다).
 */
type ProductionFingerprintVersion = 'p1' | 'p2';
const FINGERPRINT_VERSION: ProductionFingerprintVersion = 'p2';

/** 서명자 순서를 고정한다 — 배열 순서가 DB 조회 순서에 따라 바뀌면 같은 문서의 지문이 달라진다. */
const ROLE_ORDER: Record<ProductionContractSigner['role'], number> = { operator: 0, client: 1, guardian: 2 };

export type ProductionFingerprintSigner = Pick<
  ProductionContractSigner,
  'role' | 'name' | 'email' | 'signedAt' | 'ipAddress' | 'signatureData' | 'identityVerifiedAt' | 'adminActor'
> &
  Partial<Pick<ProductionContractSigner, 'phone' | 'relation'>>;

export interface ProductionFingerprintInput {
  contract: Pick<
    ProductionContract,
    | 'id'
    | 'kind'
    | 'title'
    | 'clientName'
    | 'clientStageName'
    | 'clientEmail'
    | 'clientPhone'
    | 'clientBirthdate'
    | 'clientAddress'
    | 'termsJson'
    | 'totalAmount'
    | 'templateHash'
    | 'content'
  >;
  clauses: readonly ProductionClause[];
  signers: readonly ProductionFingerprintSigner[];
  /** 계약 성립 시각(마지막 필수 서명). */
  signedAt: Date;
}

const buildCanonicalForm = (
  { contract, clauses, signers, signedAt }: ProductionFingerprintInput,
  version: ProductionFingerprintVersion,
): string => {
  const ordered = [...signers].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  return [
    `fingerprint:${version}`,
    `contract:${contract.id}`,
    `kind:${contract.kind}`,
    sized('title', contract.title),
    sized('clientName', contract.clientName),
    sized('clientStageName', contract.clientStageName),
    sized('clientEmail', contract.clientEmail),
    sized('clientPhone', contract.clientPhone),
    sized('clientBirthdate', contract.clientBirthdate),
    sized('clientAddress', contract.clientAddress),
    sized('terms', contract.termsJson),
    `totalAmount:${contract.totalAmount}`,
    sized('templateHash', contract.templateHash),
    `signedAt:${toSeconds(signedAt)}`,
    sized('content', contract.content),
    `clauseCount:${clauses.length}`,
    ...clauses.flatMap((clause, index) => [
      sized(`clause[${index}].key`, clause.key),
      sized(`clause[${index}].number`, clause.clauseNumber),
      sized(`clause[${index}].title`, clause.title),
      // 요약 문장은 있을 때만 — 옛 계약(points 없음)의 지문 문자열이 바뀌지 않게.
      ...(clause.points ? clause.points.map((point, p) => sized(`clause[${index}].point[${p}]`, point)) : []),
    ]),
    `signerCount:${ordered.length}`,
    ...ordered.flatMap((signer, index) => [
      sized(`signer[${index}].role`, signer.role),
      sized(`signer[${index}].name`, signer.name),
      sized(`signer[${index}].email`, signer.email),
      ...(version === 'p2'
        ? [sized(`signer[${index}].phone`, signer.phone ?? null), sized(`signer[${index}].relation`, signer.relation ?? null)]
        : []),
      sized(`signer[${index}].adminActor`, signer.adminActor),
      `signer[${index}].signedAt:${toSeconds(signer.signedAt)}`,
      `signer[${index}].identityVerifiedAt:${toSeconds(signer.identityVerifiedAt)}`,
      sized(`signer[${index}].ip`, signer.ipAddress),
      sized(`signer[${index}].signature`, signer.signatureData),
    ]),
  ].join('\n');
};

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const fingerprintFor = (version: ProductionFingerprintVersion, input: ProductionFingerprintInput): string =>
  `${version}:${sha256(buildCanonicalForm(input, version))}`;

export const computeProductionFingerprint = (input: ProductionFingerprintInput): string =>
  fingerprintFor(FINGERPRINT_VERSION, input);

export type ProductionFingerprintCheck =
  | { status: 'match'; fingerprint: string }
  | { status: 'mismatch'; expected: string; actual: string }
  | { status: 'unverifiable'; reason: 'none' | 'malformed' | 'unknown-version'; stored: string | null };

/**
 * 저장된 지문과 재계산 값을 대조한다. 연습실과 같이 "모른다"(unverifiable)와 "다르다"(mismatch)를 나눈다 —
 * 형식 차이를 변조로 오인하지 않게. 파기된 계약은 호출부가 먼저 거른다(본문이 지워져 반드시 어긋난다).
 */
export const verifyProductionFingerprint = (
  stored: string | null,
  input: ProductionFingerprintInput,
): ProductionFingerprintCheck => {
  if (!stored) return { status: 'unverifiable', reason: 'none', stored: null };
  const match = /^(p\d+):([0-9a-f]{64})$/.exec(stored.trim());
  if (!match) return { status: 'unverifiable', reason: 'malformed', stored };
  const version = match[1];
  if (version !== 'p1' && version !== 'p2') return { status: 'unverifiable', reason: 'unknown-version', stored };

  const actual = fingerprintFor(version, input);
  return actual === stored.trim() ? { status: 'match', fingerprint: stored } : { status: 'mismatch', expected: stored, actual };
};
