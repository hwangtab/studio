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
// v4(2026-08-25): customerBirthdate·roomArea 추가. 두 값은 관리자 화면이 컬럼에서 직접
// 출력하는데(admin/contracts/[id]/index.tsx) 지문이 덮지 않아, 본문과 컬럼이 어긋난 상태를
// 탐지하지 못했다. 특히 생년월일은 동명이인을 가르는 유일한 항목이다(validation.ts).
//
// v4부터 저장값에 버전을 접두사로 박는다(`v4:<sha256 hex>`). 그 전까지는 맨 hex만 저장해서,
// 저장된 지문만 보고는 어느 형식으로 만든 것인지 알 수 없었다 — 형식이 바뀐 뒤 재계산하면
// 불일치가 나는데 그것이 형식 차이인지 변조인지 구분할 수 없다는 뜻이다. 접두사가 있으면
// 그 버전의 canonical builder로 재계산해 대조하고, 모르는 버전은 "검증 불가"로 답한다.
// (이 전환은 실계약이 0건일 때 이뤄져 마이그레이션이 없다.)
// v3(접두사 없이 저장되던 시절의 형식)는 실계약 1건이 그 형식으로 서명돼 있어 레지스트리에
// 남긴다(2026-08-25 실 DB 확인). 접두사 없는 지문은 v3로 재계산해 맞으면 대조 성공으로,
// 안 맞으면 "검증 불가"로 답한다 — v2일 수도 있어 불일치(변조)로 단정할 수 없기 때문이다.
export type FingerprintVersion = 'v3' | 'v4';
const FINGERPRINT_VERSION: FingerprintVersion = 'v4';
/** 접두사 없는 옛 지문을 재계산할 때 가정하는 버전. 실계약이 존재하는 마지막 무접두사 형식. */
const LEGACY_UNVERSIONED_VERSION: FingerprintVersion = 'v3';

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
  customerBirthdate: string | null;
  roomNumber: string;
  roomArea: string | null;
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
const buildCanonicalForm = (
  input: ContractFingerprintInput,
  version: FingerprintVersion = FINGERPRINT_VERSION,
): string =>
  [
    `fingerprint:${version}`,
    `contract:${input.contractId}`,
    sized('title', input.title),
    sized('customerName', input.customerName),
    sized('customerEmail', input.customerEmail),
    sized('customerPhone', input.customerPhone),
    sized('customerAddress', input.customerAddress),
    // v4에서 추가된 두 줄. v3 형식을 재현할 때는 빼야 그때의 지문이 나온다
    // (git 24d50cf49d^ 의 buildCanonicalForm과 문자 단위로 같아야 한다).
    ...(version === 'v4' ? [sized('customerBirthdate', input.customerBirthdate)] : []),
    sized('roomNumber', input.roomNumber),
    ...(version === 'v4' ? [sized('roomArea', input.roomArea)] : []),
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

/**
 * 버전별 canonical builder. 새 형식을 도입하면 여기에 항목을 **추가**하고 옛 것은 남긴다 —
 * 옛 버전으로 서명된 계약을 그 버전 그대로 재계산해 대조하기 위해서다. 항목을 지우는 순간
 * 그 버전의 계약은 전부 "검증 불가"가 된다.
 */
const CANONICAL_BUILDERS: Record<FingerprintVersion, (input: ContractFingerprintInput) => string> = {
  v3: (input) => buildCanonicalForm(input, 'v3'),
  v4: (input) => buildCanonicalForm(input, 'v4'),
};

const isKnownVersion = (value: string): value is FingerprintVersion => value in CANONICAL_BUILDERS;

const sha256 = (canonical: string): string =>
  createHash('sha256').update(canonical, 'utf8').digest('hex');

/** 특정 버전 형식의 hex(접두사 없음). 옛 지문 재계산과 테스트에 쓴다. */
export const computeFingerprintHexForVersion = (
  version: FingerprintVersion,
  input: ContractFingerprintInput,
): string => sha256(CANONICAL_BUILDERS[version](input));

/** 저장·인쇄되는 값. `v4:<sha256 hex>` — 버전이 값의 일부다. */
export const computeContractFingerprint = (input: ContractFingerprintInput): string =>
  `${FINGERPRINT_VERSION}:${computeFingerprintHexForVersion(FINGERPRINT_VERSION, input)}`;

export interface ParsedFingerprint {
  version: string;
  hex: string;
}

/**
 * 저장된 지문을 버전과 hex로 나눈다. 접두사가 없는 값(v4 이전에 저장된 맨 hex — 실계약은
 * 없지만 형식상 가능)은 version을 빈 문자열로 돌려주고, 아예 지문이 아닌 값은 null.
 */
export const parseFingerprint = (stored: string | null | undefined): ParsedFingerprint | null => {
  if (!stored) return null;
  const match = /^(?:(v\d+):)?([0-9a-f]{64})$/i.exec(stored.trim());
  if (!match) return null;
  return { version: match[1] ?? '', hex: match[2].toLowerCase() };
};

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
  customerBirthdate: contract.customerBirthdate,
  roomNumber: contract.roomNumber,
  roomArea: contract.roomArea,
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

/**
 * 대조 결과. "불일치"를 곧바로 "변조"라고 말하지 않기 위해 갈래를 나눈다.
 *
 * - match: 저장 지문 = 그 버전으로 재계산한 지문. 문서가 서명 당시 그대로다.
 * - mismatch: 같은 버전으로 재계산했는데 다르다. **변조 의심** — 즉시 확인 대상.
 * - unverifiable: 대조 자체를 할 수 없다. 사유를 함께 준다.
 *     none            지문이 저장되지 않았다(서명 전이거나 옛 데이터)
 *     malformed       지문 형식이 아니다
 *     unversioned     v4 이전의 맨 hex — 어느 형식인지 알 수 없어 재계산 불가
 *     unknown-version 이 코드가 모르는 버전(미래 버전 코드로 만든 값, 또는 레지스트리에서 지워진 버전)
 *
 * "파기됨"은 여기서 다루지 않는다 — 파기 여부는 DB의 purgedAt이 말해 주므로 DB를 아는
 * 쪽(verifyStoredContract)이 재계산 전에 걸러낸다.
 */
export type FingerprintCheck =
  /** legacy: 접두사 없는 옛 지문을 v3로 가정해 재계산했더니 맞았다(SHA-256 우연 일치는 불가능). */
  | { status: 'match'; version: FingerprintVersion; fingerprint: string; legacy?: true }
  | { status: 'mismatch'; version: FingerprintVersion; expected: string; actual: string }
  | {
      status: 'unverifiable';
      reason: 'none' | 'malformed' | 'unversioned' | 'unknown-version';
      stored: string | null;
    };

/** 보관된 지문과, 그 지문의 버전으로 다시 계산한 지문을 대조한다. */
export const verifyContractFingerprint = (
  stored: string | null,
  input: ContractFingerprintInput,
): FingerprintCheck => {
  if (!stored) return { status: 'unverifiable', reason: 'none', stored: null };

  const parsed = parseFingerprint(stored);
  if (!parsed) return { status: 'unverifiable', reason: 'malformed', stored };

  if (!parsed.version) {
    // 접두사 없는 옛 지문. 실계약이 있는 마지막 무접두사 형식(v3)으로 재계산해 본다.
    // 맞으면 확실히 그 문서다(해시 우연 일치 불가). 안 맞으면 v2였을 수도, 변조일 수도
    // 있어 어느 쪽이라고 말할 수 없다 — mismatch가 아니라 unverifiable로 답한다.
    const legacyHex = computeFingerprintHexForVersion(LEGACY_UNVERSIONED_VERSION, input);
    if (legacyHex === parsed.hex) {
      return { status: 'match', version: LEGACY_UNVERSIONED_VERSION, fingerprint: stored, legacy: true };
    }
    return { status: 'unverifiable', reason: 'unversioned', stored };
  }

  if (!isKnownVersion(parsed.version)) {
    return { status: 'unverifiable', reason: 'unknown-version', stored };
  }

  const version = parsed.version;
  const actualHex = sha256(CANONICAL_BUILDERS[version](input));
  if (actualHex === parsed.hex) {
    return { status: 'match', version, fingerprint: stored };
  }
  return { status: 'mismatch', version, expected: stored, actual: `${version}:${actualHex}` };
};

/**
 * 화면·PDF에 싣기 위한 짧은 표기. 전체 64자는 눈으로 대조하기 어렵다.
 * 버전 접두사는 떼고 hex 앞 8자만 — `A1B2-C3D4`.
 */
export const formatFingerprintForDisplay = (fingerprint: string): string => {
  const hex = parseFingerprint(fingerprint)?.hex ?? fingerprint;
  return hex.slice(0, 8).toUpperCase().match(/.{1,4}/g)?.join('-') ?? hex.slice(0, 8).toUpperCase();
};
