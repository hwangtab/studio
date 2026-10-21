import { createHash } from 'node:crypto';

import type { LessonContract } from '../../../db/schema';
import { sized, toSeconds } from '../integrity';
import type { LessonClause } from './clauses';

/**
 * 수강 계약 서명 시점 문서의 지문 — `l1:<sha256 hex>`. 원리는 연습실·제작 계약 지문과 같다: 문서를 이루는 값을 라벨·길이를 붙여 한 문자열로 모으고
 * SHA-256을 남긴다. 레지스트리는 따로 둔다(접두사 l = 레슨). 형식을 바꾸면 버전을 올리고 옛 builder를 남긴다 — 지우면 그 버전으로 서명된 계약이 검증 불가가 된다.
 * 열람 기록은 넣지 않는다(서명된 문서가 아니라 그 주변 정황이다).
 */
type Version = 'l1';
const VERSION: Version = 'l1';

export interface LessonFingerprintInput {
  contract: Pick<LessonContract,
    'id' | 'enrollmentId' | 'studentName' | 'studentEmail' | 'studentPhone' | 'studentBirthdate' | 'studentAddress'
    | 'termsJson' | 'templateHash' | 'content' | 'operatorActor' | 'operatorSignedAt' | 'operatorIp' | 'signatureData' | 'signerIp' | 'identityVerifiedAt'>;
  clauses: readonly LessonClause[];
  /** 계약 성립 시각 = 수강생 서명 시각. */
  signedAt: Date;
}

const canonical = ({ contract: c, clauses, signedAt }: LessonFingerprintInput, version: Version): string => [
  `fingerprint:${version}`,
  `contract:${c.id}`,
  `enrollment:${c.enrollmentId}`,
  sized('studentName', c.studentName),
  sized('studentEmail', c.studentEmail),
  sized('studentPhone', c.studentPhone),
  sized('studentBirthdate', c.studentBirthdate),
  sized('studentAddress', c.studentAddress),
  sized('terms', c.termsJson),
  sized('templateHash', c.templateHash),
  `signedAt:${toSeconds(signedAt)}`,
  sized('content', c.content),
  `clauseCount:${clauses.length}`,
  ...clauses.flatMap((clause, i) => [
    sized(`clause[${i}].key`, clause.key),
    sized(`clause[${i}].number`, clause.clauseNumber),
    sized(`clause[${i}].title`, clause.title),
    ...clause.points.map((point, p) => sized(`clause[${i}].point[${p}]`, point)),
  ]),
  sized('operator.actor', c.operatorActor),
  `operator.signedAt:${toSeconds(c.operatorSignedAt)}`,
  sized('operator.ip', c.operatorIp),
  `student.identityVerifiedAt:${toSeconds(c.identityVerifiedAt)}`,
  sized('student.ip', c.signerIp),
  sized('student.signature', c.signatureData),
].join('\n');

const fingerprintFor = (version: Version, input: LessonFingerprintInput): string =>
  `${version}:${createHash('sha256').update(canonical(input, version), 'utf8').digest('hex')}`;

export const computeLessonFingerprint = (input: LessonFingerprintInput): string => fingerprintFor(VERSION, input);

export type LessonFingerprintCheck =
  | { status: 'match'; fingerprint: string }
  | { status: 'mismatch'; expected: string; actual: string }
  | { status: 'unverifiable'; reason: 'none' | 'malformed' | 'unknown-version'; stored: string | null };

/** 저장된 지문과 재계산 값을 대조한다. "모른다"(unverifiable)와 "다르다"(mismatch)를 나눈다. 파기된 계약은 호출부가 먼저 거른다. */
export const verifyLessonFingerprint = (stored: string | null, input: LessonFingerprintInput): LessonFingerprintCheck => {
  if (!stored) return { status: 'unverifiable', reason: 'none', stored: null };
  const match = /^(l\d+):([0-9a-f]{64})$/.exec(stored.trim());
  if (!match) return { status: 'unverifiable', reason: 'malformed', stored };
  if (match[1] !== 'l1') return { status: 'unverifiable', reason: 'unknown-version', stored };
  const actual = fingerprintFor('l1', input);
  return actual === stored.trim() ? { status: 'match', fingerprint: stored } : { status: 'mismatch', expected: stored, actual };
};
