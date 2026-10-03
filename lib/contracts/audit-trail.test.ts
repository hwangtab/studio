/** @jest-environment node */

import type { Contract, ContractAttachment, ContractClause, Signature } from '../../db/schema';
import { buildAuditTrail } from './audit-trail';
import {
  buildFingerprintInput,
  computeContractFingerprint,
  computeFingerprintHexForVersion,
} from './integrity';

const SIGNED_AT = new Date('2026-09-01T05:00:00.000Z');
const SENT_AT = new Date('2026-08-30T01:00:00.000Z');
const VIEWED_AT = new Date('2026-08-30T02:30:00.000Z');

const baseContract = {
  id: 'c-1',
  title: '홍길동 302호',
  customerName: '홍길동',
  customerBirthdate: '1990-01-02',
  customerEmail: 'hong@example.com',
  customerPhone: '010-1234-5678',
  customerAddress: '서울시 은평구',
  roomNumber: '302',
  roomArea: '3m × 2m',
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2027-03-01T00:00:00.000Z'),
  monthlyRent: 360000,
  depositAmount: 360000,
  paymentDay: 1,
  content: '계약 본문',
  description: null,
  specialTerms: null,
  status: 'signed',
  rulesAgreedAt: SIGNED_AT,
  sentAt: SENT_AT,
  signedAt: SIGNED_AT,
  firstViewedAt: VIEWED_AT,
  lastViewedAt: VIEWED_AT,
  viewCount: 1,
  firstViewedIp: '203.0.113.9',
  identityVerifiedAt: SIGNED_AT,
  contentHash: null,
  expiresAt: null,
  signToken: 'tok',
  signTokenUsedAt: SIGNED_AT,
  pdfUrl: null,
  pdfGeneratedAt: null,
  notificationError: null,
  notifiedAt: null,
  terminatedAt: null,
  terminationReason: null,
  purgedAt: null,
  createdAt: new Date('2026-08-29T01:00:00.000Z'),
  updatedAt: SIGNED_AT,
} as unknown as Contract;

const signature = {
  id: 's-1',
  contractId: 'c-1',
  signerName: '홍길동',
  signerEmail: 'hong@example.com',
  signerRole: 'customer',
  status: 'signed',
  signedAt: SIGNED_AT,
  ipAddress: '203.0.113.9',
  userAgent: 'Mozilla/5.0',
  signatureData: 'data:image/png;base64,AAA',
  createdAt: SENT_AT,
  updatedAt: SIGNED_AT,
} as unknown as Signature;

const clauses: ContractClause[] = [
  { clauseNumber: '1', title: '개인정보 수집·이용', agreedAt: SIGNED_AT } as ContractClause,
  { clauseNumber: '2', title: '전자서명 효력', agreedAt: SIGNED_AT } as ContractClause,
];

const attachments: ContractAttachment[] = [
  { type: 'rules', title: '공동생활 이용수칙', content: '수칙 본문' } as ContractAttachment,
];

const load = (overrides: Partial<Contract> = {}, sig: Signature | null = signature) => ({
  ...baseContract,
  ...overrides,
  signatures: sig ? [sig] : [],
  contractClauses: clauses,
  contractAttachments: attachments,
});

/** 실제로 서명했을 때 남았을 지문. */
const validHash = (contract: Contract) =>
  computeContractFingerprint(
    buildFingerprintInput(contract, {
      attachments,
      clauses,
      signatureData: signature.signatureData ?? '',
      signer: {
        name: signature.signerName,
        email: signature.signerEmail,
        ipAddress: signature.ipAddress,
      },
      signedAt: SIGNED_AT,
      identityVerifiedAt: contract.identityVerifiedAt,
    }),
  );

describe('지문 대조', () => {
  it('보관된 지문과 다시 계산한 값이 같으면 일치로 본다', () => {
    const contract = { ...baseContract };
    const trail = buildAuditTrail(load({ contentHash: validHash(contract) }));

    expect(trail.fingerprint.kind).toBe('match');
  });

  it('서명 뒤 본문이 바뀌면 불일치로 잡는다', () => {
    const contract = { ...baseContract };
    const hash = validHash(contract);
    const trail = buildAuditTrail(load({ contentHash: hash, content: '몰래 바꾼 본문' }));

    expect(trail.fingerprint.kind).toBe('mismatch');
    if (trail.fingerprint.kind === 'mismatch') {
      expect(trail.fingerprint.stored).toBe(hash);
      expect(trail.fingerprint.actual).not.toBe(hash);
    }
  });

  it('서명 뒤 금액이 바뀌어도 잡는다', () => {
    const hash = validHash({ ...baseContract });
    const trail = buildAuditTrail(load({ contentHash: hash, monthlyRent: 100000 }));

    expect(trail.fingerprint.kind).toBe('mismatch');
  });

  /** 파기는 우리가 규정대로 지운 것이다. 이걸 변조로 띄우면 사고로 오인하게 된다. */
  it('개인정보를 파기한 계약은 대조하지 않는다', () => {
    const hash = validHash({ ...baseContract });
    const trail = buildAuditTrail(
      load({ contentHash: hash, content: '(개인정보 파기됨)', purgedAt: new Date() }),
    );

    expect(trail.fingerprint.kind).toBe('purged');
  });

  it('서명 전이면 대조할 것이 없다고 말한다', () => {
    const trail = buildAuditTrail(load({ status: 'sent', signedAt: null }, null));
    expect(trail.fingerprint.kind).toBe('unsigned');
  });

  it('지문 없이 서명된 옛 계약은 missing으로 구분한다', () => {
    const trail = buildAuditTrail(load({ contentHash: null }));
    expect(trail.fingerprint.kind).toBe('missing');
  });

  /**
   * 형식 차이는 변조가 아니다. 예전엔 현재 버전으로 계산해 `===`로만 비교해서, 버전이
   * 다른 지문이 전부 "서명 당시 문서와 다릅니다"(mismatch)로 떴다 — 규정대로 형식을 바꾼
   * 일이 변조 사고로 보였다.
   */
  it('버전 접두사 없는 맨 hex(v4 이전)는 mismatch가 아니라 unverifiable/unversioned', () => {
    const trail = buildAuditTrail(load({ contentHash: 'a'.repeat(64) }));

    expect(trail.fingerprint.kind).toBe('unverifiable');
    if (trail.fingerprint.kind === 'unverifiable') {
      expect(trail.fingerprint.reason).toBe('unversioned');
      expect(trail.fingerprint.stored).toBe('a'.repeat(64));
    }
  });

  it('모르는 버전의 지문은 unverifiable/unknown-version', () => {
    const trail = buildAuditTrail(load({ contentHash: `v99:${'b'.repeat(64)}` }));

    expect(trail.fingerprint.kind).toBe('unverifiable');
    if (trail.fingerprint.kind === 'unverifiable') {
      expect(trail.fingerprint.reason).toBe('unknown-version');
    }
  });

  it('저장된 지문은 버전이 접두사로 박혀 있다', () => {
    expect(validHash({ ...baseContract })).toMatch(/^v4:[0-9a-f]{64}$/);
  });

  /**
   * 실 DB에 접두사 없는 v3 형식으로 서명된 계약이 있다(2026-08-25 확인). 그 지문은 v3로
   * 재계산하면 맞아야 하고, 화면은 "옛 형식이지만 대조됨"이라고 말해야 한다.
   */
  it('접두사 없는 v3 지문은 v3로 재계산해 match(legacyVersion=v3)로 본다', () => {
    const contract = { ...baseContract };
    const bareV3 = computeFingerprintHexForVersion(
      'v3',
      buildFingerprintInput(contract, {
        attachments,
        clauses,
        signatureData: signature.signatureData ?? '',
        signer: {
          name: signature.signerName,
          email: signature.signerEmail,
          ipAddress: signature.ipAddress,
        },
        signedAt: SIGNED_AT,
        identityVerifiedAt: contract.identityVerifiedAt,
      }),
    );
    const trail = buildAuditTrail(load({ contentHash: bareV3 }));

    expect(trail.fingerprint.kind).toBe('match');
    if (trail.fingerprint.kind === 'match') {
      expect(trail.fingerprint.legacyVersion).toBe('v3');
    }
  });
});

describe('사건 목록', () => {
  it('시간 순으로 정렬한다', () => {
    const { events } = buildAuditTrail(load({ contentHash: validHash({ ...baseContract }) }));
    const times = events.map((event) => event.at.getTime());

    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('발송·열람·본인확인·서명을 사슬로 표시한다', () => {
    const { events } = buildAuditTrail(load());
    const chain = events.filter((event) => event.chain).map((event) => event.label);

    expect(chain).toEqual(['서명 링크 발송', '링크 최초 열람', '본인확인 통과', '전자서명 완료']);
  });

  it('최초 열람에 IP를 붙인다', () => {
    const { events } = buildAuditTrail(load());
    const viewed = events.find((event) => event.label === '링크 최초 열람');

    expect(viewed?.detail).toBe('IP 203.0.113.9');
  });

  it('한 번만 열었으면 마지막 열람은 따로 적지 않는다', () => {
    const { events } = buildAuditTrail(load());
    expect(events.some((event) => event.label === '링크 마지막 열람')).toBe(false);
  });

  it('여러 번 열었으면 마지막 열람과 횟수를 적는다', () => {
    const later = new Date('2026-08-31T04:00:00.000Z');
    const { events } = buildAuditTrail(load({ viewCount: 3, lastViewedAt: later }));
    const last = events.find((event) => event.label === '링크 마지막 열람');

    expect(last?.detail).toBe('총 3회 열람');
  });
});

describe('사슬의 빈 칸', () => {
  it('빠짐없이 기록된 계약은 경고하지 않는다', () => {
    expect(buildAuditTrail(load()).chainGaps).toEqual([]);
  });

  it('열람 기록이 없으면 그 사실을 알린다', () => {
    const { chainGaps } = buildAuditTrail(load({ firstViewedAt: null, viewCount: 0 }));
    expect(chainGaps.some((gap) => gap.includes('열람 기록'))).toBe(true);
  });

  it('본인확인·서명 IP가 없으면 각각 알린다', () => {
    const { chainGaps } = buildAuditTrail(load({ identityVerifiedAt: null }), );
    expect(chainGaps.some((gap) => gap.includes('본인확인'))).toBe(true);
  });

  /** 서명 전 계약에 "기록이 없다"고 경고하면 매번 뜬다 — 아직 일어나지 않은 일이다. */
  it('서명 전에는 빈 칸을 따지지 않는다', () => {
    const { chainGaps } = buildAuditTrail(
      load({ status: 'sent', signedAt: null, firstViewedAt: null, identityVerifiedAt: null }, null),
    );
    expect(chainGaps).toEqual([]);
  });
});
