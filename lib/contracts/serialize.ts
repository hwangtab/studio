import type {
  Contract,
  ContractAttachment,
  ContractClause,
  Signature,
} from '../../db/schema';
import { getEffectiveStatus } from './status';
import { buildSignUrl } from './token';

type SerializeValue<V> = V extends Date ? string : V extends Date | null ? string | null : V;

/** Date 필드를 ISO 문자열로 바꾼 형태. getServerSideProps·API 응답의 공통 타입. */
export type Serialized<T> = { [K in keyof T]: SerializeValue<T[K]> };

export type SerializedContract = Omit<Serialized<Contract>, 'signToken'>;
export type SerializedSignature = Serialized<Signature>;
export type SerializedClause = Serialized<ContractClause>;
export type SerializedAttachment = Serialized<ContractAttachment>;

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
    signTokenUsedAt: iso(contract.signTokenUsedAt),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
};

export interface AdminSerializedContract extends SerializedContract {
  /** 관리자가 고객에게 전달할 서명 링크. 서명 전(sent/expired) 상태에서만 의미가 있다. */
  signUrl: string;
}

export const serializeContractForAdmin = (
  contract: Contract,
  now: Date = new Date(),
): AdminSerializedContract => ({
  ...serializeContract(contract, now),
  signUrl: buildSignUrl(contract.id, contract.signToken),
});

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

export const serializeAttachment = (attachment: ContractAttachment): SerializedAttachment => ({
  ...attachment,
  agreedAt: iso(attachment.agreedAt),
  createdAt: attachment.createdAt.toISOString(),
});
