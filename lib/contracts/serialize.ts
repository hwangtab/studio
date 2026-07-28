import type {
  Contract,
  ContractAttachment,
  ContractClause,
  Signature,
} from '../../db/schema';
import { getEffectiveStatus, type ContractStatus } from './status';
import { buildSignUrl } from './token';

type SerializeValue<V> = V extends Date ? string : V extends Date | null ? string | null : V;

/** Date 필드를 ISO 문자열로 바꾼 형태. getServerSideProps·API 응답의 공통 타입. */
export type Serialized<T> = { [K in keyof T]: SerializeValue<T[K]> };

export type SerializedContract = Omit<Serialized<Contract>, 'signToken'>;
export type SerializedSignature = Serialized<Signature>;
export type SerializedClause = Serialized<ContractClause>;
export type SerializedAttachment = Omit<Serialized<ContractAttachment>, 'content'>;

const iso = (date: Date | null): string | null => (date ? date.toISOString() : null);

/**
 * signToken은 서명 링크를 아는 것과 같으므로 응답에 절대 포함하지 않는다.
 * 관리자에게 링크가 필요하면 serializeContractForAdmin의 signUrl을 쓴다.
 */
export const serializeContract = (contract: Contract, now: Date = new Date()): SerializedContract => {
  const { signToken: _signToken, ...rest } = contract;

  return {
    ...rest,
    // 만료는 lazy 판정이라 DB 반영 전 조회일 수 있다. 표시값은 항상 실효 상태로 맞춘다.
    status: getEffectiveStatus(contract, now),
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    sentAt: iso(contract.sentAt),
    signedAt: iso(contract.signedAt),
    expiresAt: iso(contract.expiresAt),
    rulesAgreedAt: iso(contract.rulesAgreedAt),
    pdfGeneratedAt: iso(contract.pdfGeneratedAt),
    notifiedAt: iso(contract.notifiedAt),
    signTokenUsedAt: iso(contract.signTokenUsedAt),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
};

export interface AdminSerializedContract extends SerializedContract {
  /**
   * 관리자가 고객에게 전달할 서명 링크.
   *
   * 서명이 끝났거나 취소된 계약에서는 빈 문자열이다 — 링크는 토큰을 그대로 담고 있어
   * 넘길 이유가 없는 상태까지 관리자 화면 HTML에 실어 둘 필요가 없다.
   */
  signUrl: string;
}

const SIGN_URL_STATUSES = new Set<ContractStatus>(['draft', 'sent', 'expired']);

export const serializeContractForAdmin = (
  contract: Contract,
  now: Date = new Date(),
): AdminSerializedContract => {
  const serialized = serializeContract(contract, now);

  return {
    ...serialized,
    signUrl: SIGN_URL_STATUSES.has(serialized.status)
      ? buildSignUrl(contract.id, contract.signToken)
      : '',
  };
};

export const serializeSignature = (signature: Signature): SerializedSignature => ({
  ...signature,
  signedAt: iso(signature.signedAt),
  createdAt: signature.createdAt.toISOString(),
  updatedAt: signature.updatedAt.toISOString(),
});

export const serializeClause = (clause: ContractClause): SerializedClause => ({
  ...clause,
  agreedAt: iso(clause.agreedAt),
  createdAt: clause.createdAt.toISOString(),
});

/**
 * 첨부 본문(content)은 응답에서 뺀다. 수 KB짜리 이용수칙 전문을 목록·상세 응답마다
 * 실어 나를 이유가 없다 — 화면에 필요한 곳(서명 페이지)은 rulesContent로 따로 받는다.
 */
export const serializeAttachment = (attachment: ContractAttachment): SerializedAttachment => {
  const { content: _content, ...rest } = attachment;

  return {
    ...rest,
    agreedAt: iso(attachment.agreedAt),
    createdAt: attachment.createdAt.toISOString(),
  };
};
