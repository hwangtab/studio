import type { Contract, ContractAttachment, ContractClause, Signature } from '../../db/schema';
import { formatDateTime } from './format';
import {
  buildFingerprintInput,
  formatFingerprintForDisplay,
  verifyContractFingerprint,
} from './integrity';

/**
 * 계약 하나의 감사추적.
 *
 * 계약서 PDF와 별개 문서로 둔다. 상용 서비스가 감사추적을 계약서에 인쇄하지 않고 별도
 * 파일(DocuSign의 Certificate of Completion)로 내는 것과 같은 이유다 — 계약서는 당사자가
 * 합의한 내용이고, 감사추적은 그 합의가 어떻게 이루어졌는지에 대한 우리 기록이다. 섞으면
 * 문서 지문에 열람 횟수 같은 사후 변동 값이 들어가 대조가 늘 어긋난다.
 *
 * 이 화면이 답해야 하는 질문은 하나다 — "서명한 적 없다"는 주장에 무엇을 내놓을 것인가.
 */

export type FingerprintVerdict =
  /** 아직 서명 전이라 대조할 지문이 없다. */
  | { kind: 'unsigned' }
  /** 서명은 됐는데 지문이 남아 있지 않다(지문 도입 이전 계약). */
  | { kind: 'missing' }
  /** 개인정보를 파기해 본문·서명 이미지가 지워졌다. 대조하면 반드시 어긋난다 — 변조가 아니다. */
  | { kind: 'purged'; stored: string; storedShort: string }
  /**
   * 지문은 있는데 그 형식으로는 재계산할 수 없다 — 변조가 아니라 "모른다"다.
   * unversioned: v4 이전에 저장된 맨 hex라 어느 형식으로 만든 것인지 알 수 없다.
   * unknown-version: 이 코드가 모르는 버전(미래 버전으로 만든 값, 또는 레지스트리에서 지워진 버전).
   * malformed: 지문 형식 자체가 아니다.
   * 이 셋을 mismatch로 띄우면 형식 차이를 변조 사고로 오인하게 된다(integrity.ts 주석).
   */
  | {
      kind: 'unverifiable';
      reason: 'unversioned' | 'unknown-version' | 'malformed';
      stored: string;
      storedShort: string;
    }
  /** legacyVersion: 접두사 없는 옛 지문을 그 버전으로 재계산해 맞았다 — 형식만 옛것이지 대조는 확실하다. */
  | { kind: 'match'; stored: string; storedShort: string; legacyVersion?: string }
  | { kind: 'mismatch'; stored: string; storedShort: string; actual: string; actualShort: string };

export interface AuditEvent {
  /** 이 사건이 무엇인가. */
  label: string;
  at: Date;
  /** 시각 옆에 붙는 근거 — IP·수신처·서명자 등. 없으면 시각만 보인다. */
  detail?: string;
  /**
   * 서명 부인에 직접 맞서는 사건인지. 발송·열람·본인확인·서명 넷이 여기 해당하며,
   * 이 넷이 이어져야 "받아서, 열어 보고, 본인임을 확인하고, 서명했다"는 사슬이 된다.
   */
  chain?: boolean;
}

export interface AuditTrail {
  events: AuditEvent[];
  fingerprint: FingerprintVerdict;
  /** 사슬에서 비어 있는 칸. 비어 있지 않으면 그대로 화면에 경고로 뜬다. */
  chainGaps: string[];
}

type LoadedContract = Contract & {
  signatures: Signature[];
  contractClauses: ContractClause[];
  contractAttachments: ContractAttachment[];
};

const customerSignatureOf = (contract: LoadedContract): Signature | null =>
  contract.signatures.find(
    (signature) => signature.signerRole === 'customer' && signature.status === 'signed',
  ) ?? null;

const verifyFingerprint = (contract: LoadedContract): FingerprintVerdict => {
  const signature = customerSignatureOf(contract);

  if (!signature || !signature.signedAt) return { kind: 'unsigned' };
  if (!contract.contentHash) return { kind: 'missing' };

  const stored = contract.contentHash;
  const storedShort = formatFingerprintForDisplay(stored);

  /**
   * 파기된 계약은 대조하지 않는다.
   *
   * 파기는 본문·이름·서명 이미지를 의도적으로 지우는 일이라, 다시 계산하면 반드시 어긋난다.
   * 그것을 "변조 감지"로 띄우면 우리가 규정대로 한 일을 사고로 오인하게 된다.
   */
  if (contract.purgedAt) return { kind: 'purged', stored, storedShort };

  /**
   * 재계산은 integrity.ts에 맡긴다. 저장된 지문의 버전 접두사를 읽어 **그 버전의** canonical
   * builder로 다시 계산하므로, 형식이 바뀐 뒤에도 옛 계약이 제 형식대로 대조된다. 예전엔
   * 여기서 현재 버전으로 계산해 `===`로만 비교해서, 버전이 다른 지문이 전부 "변조"로 떴다.
   */
  const check = verifyContractFingerprint(
    stored,
    buildFingerprintInput(contract, {
      attachments: contract.contractAttachments,
      clauses: contract.contractClauses,
      signatureData: signature.signatureData ?? '',
      signer: {
        name: signature.signerName,
        email: signature.signerEmail,
        ipAddress: signature.ipAddress,
      },
      signedAt: signature.signedAt,
      identityVerifiedAt: contract.identityVerifiedAt,
    }),
  );

  switch (check.status) {
    case 'match':
      return {
        kind: 'match',
        stored,
        storedShort,
        ...(check.legacy ? { legacyVersion: check.version } : {}),
      };
    case 'mismatch':
      return {
        kind: 'mismatch',
        stored,
        storedShort,
        actual: check.actual,
        actualShort: formatFingerprintForDisplay(check.actual),
      };
    case 'unverifiable':
      // 'none'은 위의 !contract.contentHash 가드가 먼저 걸러 여기 오지 않는다.
      return {
        kind: 'unverifiable',
        reason: check.reason === 'none' ? 'malformed' : check.reason,
        stored,
        storedShort,
      };
  }
};

export const buildAuditTrail = (contract: LoadedContract): AuditTrail => {
  const signature = customerSignatureOf(contract);
  const events: AuditEvent[] = [];

  const push = (label: string, at: Date | null, detail?: string, chain?: boolean) => {
    if (at) events.push({ label, at, ...(detail ? { detail } : {}), ...(chain ? { chain } : {}) });
  };

  push('계약서 작성', contract.createdAt);
  push('서명 링크 발송', contract.sentAt, contract.customerEmail, true);
  push(
    '링크 최초 열람',
    contract.firstViewedAt,
    contract.firstViewedIp ? `IP ${contract.firstViewedIp}` : undefined,
    true,
  );

  // 한 번만 열었으면 최초 열람과 같은 줄이 두 번 뜬다. 다시 열었을 때만 의미가 있다.
  if (contract.viewCount > 1) {
    push('링크 마지막 열람', contract.lastViewedAt, `총 ${contract.viewCount}회 열람`);
  }

  push('본인확인 통과', contract.identityVerifiedAt, '연락처 뒷자리 대조', true);

  if (signature?.signedAt) {
    const parts = [signature.signerName];
    if (signature.ipAddress) parts.push(`IP ${signature.ipAddress}`);
    events.push({ label: '전자서명 완료', at: signature.signedAt, detail: parts.join(' · '), chain: true });
  }

  // 조항 동의는 서명과 같은 트랜잭션에서 같은 시각에 찍힌다. 줄마다 나열하면 같은 시각이
  // 반복될 뿐이라 개수만 남긴다.
  const agreedCount = contract.contractClauses.filter((clause) => clause.agreedAt).length;
  if (agreedCount > 0) {
    const agreedAt = contract.contractClauses.find((clause) => clause.agreedAt)?.agreedAt ?? null;
    push('동의 항목 확인', agreedAt, `${agreedCount}개 항목 개별 동의`);
  }

  push('계약서 PDF 보관', contract.pdfGeneratedAt);
  push('서명 완료 안내 발송', contract.notifiedAt, contract.notificationError ?? undefined);
  push('계약 종료 처리', contract.terminatedAt, contract.terminationReason ?? undefined);
  push('개인정보 파기', contract.purgedAt);

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const chainGaps: string[] = [];
  if (signature?.signedAt) {
    if (!contract.sentAt) chainGaps.push('발송 기록이 없습니다');
    if (!contract.firstViewedAt) {
      chainGaps.push('열람 기록이 없습니다 (열람 기록 도입 이전에 서명된 계약)');
    }
    if (!contract.identityVerifiedAt) chainGaps.push('본인확인 기록이 없습니다');
    if (!signature.ipAddress) chainGaps.push('서명 IP가 기록되지 않았습니다');
  }

  return { events, fingerprint: verifyFingerprint(contract), chainGaps };
};

/** 화면에 그대로 찍는 문자열. 시각은 Asia/Seoul로 못박은 format.ts를 쓴다. */
export const formatAuditTime = (at: Date): string => formatDateTime(at);

export interface SerializedAuditEvent {
  label: string;
  /** 이미 Asia/Seoul로 찍어 둔 표시용 문자열. 화면에서 다시 포맷하지 않는다. */
  time: string;
  detail?: string;
  chain?: boolean;
}

export interface SerializedAuditTrail {
  events: SerializedAuditEvent[];
  fingerprint: FingerprintVerdict;
  chainGaps: string[];
}

/**
 * getServerSideProps로 넘길 형태.
 *
 * 시각은 서버에서 문자열로 만들어 넘긴다. 브라우저에서 포맷하면 보는 사람의 시간대를 따라
 * 서명 시각이 다른 값으로 보인다 — 증거로 쓰는 화면에서 그건 그냥 틀린 값이다(format.ts 주석).
 */
export const serializeAuditTrail = (trail: AuditTrail): SerializedAuditTrail => ({
  events: trail.events.map((event) => ({
    label: event.label,
    time: formatAuditTime(event.at),
    ...(event.detail ? { detail: event.detail } : {}),
    ...(event.chain ? { chain: true } : {}),
  })),
  fingerprint: trail.fingerprint,
  chainGaps: trail.chainGaps,
});
