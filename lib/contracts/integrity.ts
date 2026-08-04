import { createHash } from 'crypto';

import type { Contract, ContractAttachment, ContractClause } from '../../db/schema';

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

/**
 * 지문 형식 버전.
 *
 * 대상 필드가 바뀌면 같은 문서라도 다른 값이 나온다. 버전을 앞에 박아 두면 "왜 대조가
 * 실패하는가"를 따질 때 형식 변경 때문인지 변조 때문인지 구분할 수 있다.
 *
 * v3에서 덮는 범위를 넓혔다. v2는 계약 본문과 금액·기간만 덮어, 계약서에 함께 인쇄되는
 * 제목·이메일·주소·납부일과 첨부 제목·조항 목록, 그리고 서명자 이름·이메일·IP가 지문
 * 밖에 있었다. 특히 서명자 정보는 "누가 서명했는가"에 대한 유일한 기록인데 바꿔도 지문이
 * 그대로였다. v2로 만들어진 지문은 v3로 재계산하면 당연히 어긋난다 — 형식이 다르기 때문이며
 * 변조가 아니다.
 */
const FINGERPRINT_VERSION = 'v3';

/** 지문 안에 들어가는 첨부 정보. type이 바뀌면 어떤 문서가 첨부됐는지가 달라진다. */
export interface FingerprintAttachment {
  type: string;
  title: string;
  content: string | null;
}

/** 지문 안에 들어가는 동의 조항. 계약서에 "동의함"으로 인쇄된다. */
export interface FingerprintClause {
  clauseNumber: string;
  title: string;
}

/** 서명 행위의 주체와 정황. 계약서 서명란에 그대로 인쇄된다. */
export interface FingerprintSigner {
  name: string;
  email: string;
  ipAddress: string | null;
}

export interface ContractFingerprintInput {
  contractId: string;
  /**
   * 계약서에 인쇄되는 값들.
   *
   * 본문(content)에도 같은 내용이 들어 있지만 따로 넣는다. PDF의 요약 표와 관리자 화면은
   * 본문이 아니라 이 컬럼들을 그대로 출력하므로, 컬럼만 고치면 본문은 멀쩡한 채로 인쇄되는
   * 금액이 달라진다. 지문이 표시되는 값을 덮지 않으면 목적을 잃는다.
   */
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string | null;
  roomNumber: string;
  startDate: Date;
  endDate: Date;
  monthlyRent: number;
  depositAmount: number;
  paymentDay: number;
  /** 계약 본문(서명 시점 스냅샷) */
  content: string;
  /** 첨부 문서 — 이용수칙 등, 계약 시점 사본 */
  attachments: ReadonlyArray<FingerprintAttachment>;
  /** 개별 동의를 받은 조항 목록 */
  clauses: ReadonlyArray<FingerprintClause>;
  /** 서명 이미지 데이터 URL */
  signatureData: string;
  signer: FingerprintSigner;
  signedAt: Date;
  /** 본인 확인 시각. 계약서에 인쇄되므로 함께 덮는다. */
  identityVerifiedAt: Date | null;
}

/**
 * 서명 시각을 초 단위로 맞춘다.
 *
 * DB의 타임스탬프는 초 단위로 저장되므로, 밀리초까지 넣어 지문을 만들면 저장 과정에서
 * 잘려 나간 만큼 재계산 값이 달라진다. 그러면 아무것도 변조되지 않았는데도 대조가 늘
 * 실패해, 무결성 검증이 있으나 없으나 같아진다.
 */
const toSeconds = (date: Date | null): string =>
  date ? String(Math.floor(date.getTime() / 1000)) : '';

/** 길이를 앞에 붙여 값의 경계를 못 박는다. 붙이지 않으면 값 안에 구분자를 심어 흉내낼 수 있다. */
const sized = (label: string, value: string | null): string => {
  const text = value ?? '';
  return `${label}:${text.length}:${text}`;
};

/**
 * 해시 대상을 사람이 읽을 수 있는 형태로 조립한다.
 *
 * 필드 경계를 개행과 라벨로 명확히 나눈다. 값을 그냥 이어 붙이면 서로 다른 조합이 같은
 * 문자열이 될 수 있어(예: 본문 끝과 첨부 시작이 붙는 경우) 지문이 충돌한다. 사용자가 값을
 * 넣을 수 있는 자리는 길이까지 앞에 박아 개행을 섞어도 구조를 흉내낼 수 없게 한다.
 */
const buildCanonicalForm = (input: ContractFingerprintInput): string =>
  [
    `fingerprint:${FINGERPRINT_VERSION}`,
    `contract:${input.contractId}`,
    sized('title', input.title),
    sized('customerName', input.customerName),
    sized('customerEmail', input.customerEmail),
    sized('customerPhone', input.customerPhone),
    sized('customerAddress', input.customerAddress),
    sized('roomNumber', input.roomNumber),
    `startDate:${toSeconds(input.startDate)}`,
    `endDate:${toSeconds(input.endDate)}`,
    `monthlyRent:${input.monthlyRent}`,
    `depositAmount:${input.depositAmount}`,
    `paymentDay:${input.paymentDay}`,
    `identityVerifiedAt:${toSeconds(input.identityVerifiedAt)}`,
    `signedAt:${toSeconds(input.signedAt)}`,
    sized('content', input.content),
    `attachmentCount:${input.attachments.length}`,
    ...input.attachments.flatMap((attachment, index) => [
      sized(`attachment[${index}].type`, attachment.type),
      sized(`attachment[${index}].title`, attachment.title),
      sized(`attachment[${index}].content`, attachment.content),
    ]),
    `clauseCount:${input.clauses.length}`,
    ...input.clauses.flatMap((clause, index) => [
      sized(`clause[${index}].number`, clause.clauseNumber),
      sized(`clause[${index}].title`, clause.title),
    ]),
    sized('signerName', input.signer.name),
    sized('signerEmail', input.signer.email),
    sized('signerIp', input.signer.ipAddress),
    sized('signature', input.signatureData),
  ].join('\n');

export const computeContractFingerprint = (input: ContractFingerprintInput): string =>
  createHash('sha256').update(buildCanonicalForm(input), 'utf8').digest('hex');

/**
 * 계약 레코드에서 지문 입력을 만든다.
 *
 * 호출부마다 필드를 손으로 나열하면 하나가 빠져도 조용히 지나가고, 그 필드는 지문의
 * 보호 밖에 남는다. 한곳에서 뽑아 쓴다.
 *
 * 조항·첨부의 동의 시각(agreedAt)은 따로 넣지 않는다. 서명과 같은 트랜잭션에서 같은 시각이
 * 찍히므로 signedAt이 이미 그것을 덮는다.
 */
export const buildFingerprintInput = (
  contract: Contract,
  options: {
    attachments: ReadonlyArray<Pick<ContractAttachment, 'type' | 'title' | 'content'>>;
    clauses: ReadonlyArray<Pick<ContractClause, 'clauseNumber' | 'title'>>;
    signatureData: string;
    signer: FingerprintSigner;
    /** 서명 처리 중이라면 그때 쓰는 시각을, 이미 서명된 계약이라면 저장된 값을 넘긴다. */
    signedAt: Date;
    identityVerifiedAt: Date | null;
  },
): ContractFingerprintInput => ({
  contractId: contract.id,
  title: contract.title,
  customerName: contract.customerName,
  customerEmail: contract.customerEmail,
  customerPhone: contract.customerPhone,
  customerAddress: contract.customerAddress,
  roomNumber: contract.roomNumber,
  startDate: contract.startDate,
  endDate: contract.endDate,
  monthlyRent: contract.monthlyRent,
  depositAmount: contract.depositAmount,
  paymentDay: contract.paymentDay,
  content: contract.content,
  attachments: options.attachments.map((attachment) => ({
    type: attachment.type,
    title: attachment.title,
    content: attachment.content,
  })),
  clauses: options.clauses.map((clause) => ({
    clauseNumber: clause.clauseNumber,
    title: clause.title,
  })),
  signatureData: options.signatureData,
  signer: options.signer,
  signedAt: options.signedAt,
  identityVerifiedAt: options.identityVerifiedAt,
});

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
