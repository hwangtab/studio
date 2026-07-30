import { createHash } from 'crypto';

/**
 * 서명된 문서의 무결성 지문.
 *
 * DB 변조는 애플리케이션 수준에서 막았지만, 그것만으로는 "이 문서가 서명 당시의 그것과
 * 같다"를 애플리케이션 밖에서 증명할 수 없다. 서명 시점에 문서를 이루는 값들을 한 문자열로
 * 모아 SHA-256을 남겨 두면, 나중에 같은 방식으로 다시 계산해 대조할 수 있다.
 *
 * 공인 전자서명이나 타임스탬프 인증을 대신하지는 못한다. 다만 사후 변조를 탐지할 수단이
 * 아예 없는 상태와는 다르다.
 */
export interface ContractFingerprintInput {
  contractId: string;
  /** 계약 본문(서명 시점 스냅샷) */
  content: string;
  /** 첨부 문서 본문 — 이용수칙 등, 계약 시점 사본 */
  attachmentContents: ReadonlyArray<string | null>;
  /** 서명 이미지 데이터 URL */
  signatureData: string;
  signedAt: Date;
}

/**
 * 해시 대상을 사람이 읽을 수 있는 형태로 조립한다.
 *
 * 필드 경계를 개행과 라벨로 명확히 나눈다. 값을 그냥 이어 붙이면 서로 다른 조합이 같은
 * 문자열이 될 수 있어(예: 본문 끝과 첨부 시작이 붙는 경우) 지문이 충돌한다.
 */
const buildCanonicalForm = (input: ContractFingerprintInput): string =>
  [
    `contract:${input.contractId}`,
    `signedAt:${input.signedAt.toISOString()}`,
    `content:${input.content.length}:${input.content}`,
    ...input.attachmentContents.map(
      (attachment, index) => `attachment[${index}]:${attachment?.length ?? 0}:${attachment ?? ''}`,
    ),
    `signature:${input.signatureData.length}:${input.signatureData}`,
  ].join('\n');

export const computeContractFingerprint = (input: ContractFingerprintInput): string =>
  createHash('sha256').update(buildCanonicalForm(input), 'utf8').digest('hex');

/** 보관된 지문과 다시 계산한 지문을 대조한다. */
export const verifyContractFingerprint = (
  stored: string | null,
  input: ContractFingerprintInput,
): { ok: boolean; expected: string | null; actual: string } => {
  const actual = computeContractFingerprint(input);
  return { ok: stored === actual, expected: stored, actual };
};

/** 화면·PDF에 싣기 위한 짧은 표기. 전체 64자는 눈으로 대조하기 어렵다. */
export const formatFingerprintForDisplay = (hash: string): string =>
  hash.slice(0, 8).toUpperCase().match(/.{1,4}/g)?.join('-') ?? hash.slice(0, 8).toUpperCase();
