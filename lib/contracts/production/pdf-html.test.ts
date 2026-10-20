/** @jest-environment node */

import type { ProductionContract, ProductionContractSigner } from '../../../db/schema';
import { LEGACY_PRODUCTION_CLAUSES } from './clauses';
import { buildProductionPdfHtml } from './pdf-html';
import { buildDefaultProductionTerms, canonicalTermsJson } from './terms';

const signedAt = new Date('2026-10-18T05:00:00Z');
const terms = buildDefaultProductionTerms();

const contract = {
  id: 'c1',
  kind: 'single',
  status: 'signed',
  title: '홍길동님 음원 제작 용역 계약',
  clientName: '홍길동 <script>',
  clientStageName: '길동밴드',
  clientEmail: 'g@example.com',
  clientPhone: '010-1234-5678',
  termsJson: canonicalTermsJson(terms),
  content: '# 본문',
  contentHash: `p1:${'a'.repeat(64)}`,
  signedAt,
} as unknown as ProductionContract;

const signer = (overrides: Partial<ProductionContractSigner>) =>
  ({
    status: 'signed',
    signedAt,
    ipAddress: '203.0.113.7',
    signatureData: null,
    identityVerifiedAt: null,
    agreedClauses: null,
    ...overrides,
  }) as ProductionContractSigner;

const html = buildProductionPdfHtml({
  contract,
  terms,
  clauses: LEGACY_PRODUCTION_CLAUSES,
  signers: [
    signer({ role: 'client', name: '홍길동', email: 'g@example.com', identityVerifiedAt: signedAt, agreedClauses: JSON.stringify(['revisions', 'rights']) }),
    signer({ role: 'operator', name: '스튜디오 놀 대표 황경하', email: 'hello@studionol.co.kr', adminActor: 'kyungha' }),
  ],
});

describe('제작 계약서 PDF HTML', () => {
  it('사용자 값을 이스케이프한다', () => {
    expect(html).toContain('홍길동 &lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('서명란은 스튜디오 → 의뢰인 순서이고, 운영자는 직인 자리를 갖는다', () => {
    expect(html.indexOf('<h3 style="margin: 0 0 6px;">스튜디오</h3>')).toBeLessThan(
      html.indexOf('<h3 style="margin: 0 0 6px;">의뢰인</h3>'),
    );
    expect(html).toContain('<span class="seal"></span>');
  });

  it('체크한 조항만 동의로 적는다', () => {
    expect(html.match(/✓ 동의/g)).toHaveLength(2);
    expect(html.match(/미동의/g)).toHaveLength(LEGACY_PRODUCTION_CLAUSES.length - 2);
  });

  it('법정대리인이 있으면 대리인의 동의도 서명자 이름을 붙여 남긴다', () => {
    const withGuardian = buildProductionPdfHtml({
      contract,
      terms,
      clauses: LEGACY_PRODUCTION_CLAUSES,
      signers: [
        signer({ role: 'client', name: '홍길동', email: 'g@example.com', agreedClauses: JSON.stringify(['revisions']) }),
        signer({ role: 'guardian', name: '홍부모', email: 'p@example.com', agreedClauses: JSON.stringify(['revisions', 'rights']) }),
      ],
    });
    expect(withGuardian.match(/의뢰인 ✓ 동의/g)).toHaveLength(1);
    expect(withGuardian.match(/법정대리인 ✓ 동의/g)).toHaveLength(2);
  });

  it('본인 확인과 문서 지문을 문서 안에 남긴다', () => {
    expect(html).toContain('연락처 뒷자리 대조 완료');
    expect(html).toContain(`p1:${'a'.repeat(64)}`);
  });
});
