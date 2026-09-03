/** @jest-environment node */

import {
  computeContractFingerprint,
  computeFingerprintHexForVersion,
  formatFingerprintForDisplay,
  verifyContractFingerprint,
  type ContractFingerprintInput,
} from './integrity';

const base = (): ContractFingerprintInput => ({
  contractId: 'contract-1',
  title: '홍길동 A호 이용계약',
  customerName: '홍길동',
  customerEmail: 'a@studionol.co.kr',
  customerPhone: '010-1234-5678',
  customerAddress: '서울시 은평구 대조동',
  customerBirthdate: '1990-01-02',
  roomNumber: 'A',
  roomArea: '3m × 2m',
  paymentDay: 1,
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  endDate: new Date('2026-12-01T00:00:00.000Z'),
  monthlyRent: 300000,
  depositAmount: 300000,
  content: '# 음악연습실 이용계약서\n\n월 이용료 300,000원',
  attachments: [{ type: 'rules', title: '공동생활 이용수칙', content: '# 공동생활 이용수칙\n\n금연' }],
  clauses: [{ clauseNumber: '제5조', title: '보증금 및 그 납부 면제' }],
  signatureData: 'data:image/png;base64,AAAA',
  signer: { name: '홍길동', email: 'a@studionol.co.kr', ipAddress: '203.0.113.9' },
  signedAt: new Date('2026-07-30T05:00:00.000Z'),
  identityVerifiedAt: new Date('2026-07-30T05:00:00.000Z'),
});

describe('문서 무결성 지문', () => {
  it('같은 입력에 항상 같은 지문을 낸다', () => {
    expect(computeContractFingerprint(base())).toBe(computeContractFingerprint(base()));
  });

  /** 저장·인쇄되는 값은 버전이 접두사로 박힌 `v4:<sha256 hex>`다 — 형식 변경과 변조를 구분하기 위해. */
  it('버전 접두사 + SHA-256(64자 16진수) 형태를 낸다', () => {
    expect(computeContractFingerprint(base())).toMatch(/^v4:[0-9a-f]{64}$/);
  });

  // 아래 항목이 하나라도 바뀌면 "그때 서명한 그 문서"가 아니다.
  it.each([
    ['계약 본문', { content: '# 음악연습실 이용계약서\n\n월 이용료 900,000원' }],
    ['첨부 내용', { attachments: [{ type: 'rules', title: '공동생활 이용수칙', content: '# 공동생활 이용수칙\n\n흡연 허용' }] }],
    ['서명 이미지', { signatureData: 'data:image/png;base64,BBBB' }],
    ['서명 시각', { signedAt: new Date('2026-07-30T05:00:01.000Z') }],
    ['계약 식별자', { contractId: 'contract-2' }],
    ['생년월일', { customerBirthdate: '1991-05-05' }],
    ['호실 면적', { roomArea: '4m × 3m' }],
  ])('%s가 바뀌면 지문이 달라진다', (_label, patch) => {
    const original = computeContractFingerprint(base());
    const changed = computeContractFingerprint({ ...base(), ...patch });
    expect(changed).not.toBe(original);
  });

  /**
   * DB 타임스탬프는 초 단위다. 밀리초까지 지문에 넣으면 저장 과정에서 잘려, 아무것도
   * 변조되지 않았는데도 재계산 값이 달라진다 — 무결성 검증이 늘 실패하는 상태가 된다.
   */
  it('같은 초 안의 밀리초 차이는 지문에 영향을 주지 않는다', () => {
    const withMs = computeContractFingerprint({
      ...base(),
      signedAt: new Date('2026-07-30T05:00:00.789Z'),
    });
    const truncated = computeContractFingerprint({
      ...base(),
      signedAt: new Date('2026-07-30T05:00:00.000Z'),
    });

    expect(withMs).toBe(truncated);
  });

  it('초가 다르면 여전히 지문이 달라진다', () => {
    const a = computeContractFingerprint({
      ...base(),
      signedAt: new Date('2026-07-30T05:00:00.999Z'),
    });
    const b = computeContractFingerprint({
      ...base(),
      signedAt: new Date('2026-07-30T05:00:01.000Z'),
    });

    expect(a).not.toBe(b);
  });

  it('DB 왕복(초 절삭) 후에도 대조가 통과한다', () => {
    const signedAt = new Date('2026-07-30T05:00:00.456Z');
    const stored = computeContractFingerprint({ ...base(), signedAt });

    // DB에 저장·조회하면 밀리초가 사라진 Date가 돌아온다
    const roundTripped = new Date(Math.floor(signedAt.getTime() / 1000) * 1000);
    expect(verifyContractFingerprint(stored, { ...base(), signedAt: roundTripped }).status).toBe('match');
  });

  /**
   * PDF의 "계약 요약" 표와 관리자 화면은 본문이 아니라 컬럼을 그대로 출력한다.
   * 지문이 컬럼을 덮지 않으면 본문은 멀쩡한 채 인쇄되는 금액만 달라질 수 있다.
   */
  it.each([
    ['월 이용료', { monthlyRent: 900000 }],
    ['보증금', { depositAmount: 0 }],
    ['이용자 이름', { customerName: '김철수' }],
    ['연락처', { customerPhone: '010-9999-9999' }],
    ['호실', { roomNumber: 'B' }],
    ['시작일', { startDate: new Date('2026-10-01T00:00:00.000Z') }],
    ['종료일', { endDate: new Date('2027-03-01T00:00:00.000Z') }],
    ['본인 확인 시각', { identityVerifiedAt: null }],
    ['계약 제목', { title: '다른 제목' }],
    ['이메일', { customerEmail: 'other@studionol.co.kr' }],
    ['주소', { customerAddress: '서울시 강남구' }],
    ['납부일', { paymentDay: 15 }],
    ['서명자 이름', { signer: { name: '김철수', email: 'a@studionol.co.kr', ipAddress: '203.0.113.9' } }],
    ['서명자 이메일', { signer: { name: '홍길동', email: 'x@studionol.co.kr', ipAddress: '203.0.113.9' } }],
    ['서명자 IP', { signer: { name: '홍길동', email: 'a@studionol.co.kr', ipAddress: '198.51.100.1' } }],
    ['첨부 종류', { attachments: [{ type: 'other', title: '공동생활 이용수칙', content: '# 공동생활 이용수칙\n\n금연' }] }],
    ['첨부 제목', { attachments: [{ type: 'rules', title: '다른 문서', content: '# 공동생활 이용수칙\n\n금연' }] }],
    ['동의 조항 번호', { clauses: [{ clauseNumber: '제6조', title: '보증금 및 그 납부 면제' }] }],
    ['동의 조항 제목', { clauses: [{ clauseNumber: '제5조', title: '다른 조항' }] }],
  ])('%s만 바뀌어도 지문이 달라진다', (_label, patch) => {
    expect(computeContractFingerprint({ ...base(), ...patch })).not.toBe(
      computeContractFingerprint(base()),
    );
  });

  it('첨부가 없는 계약과 빈 첨부가 있는 계약을 구분한다', () => {
    const none = computeContractFingerprint({ ...base(), attachments: [] });
    const empty = computeContractFingerprint({
      ...base(),
      attachments: [{ type: 'rules', title: '공동생활 이용수칙', content: null }],
    });
    expect(none).not.toBe(empty);
  });

  /**
   * 값을 그냥 이어 붙이면 필드 경계가 사라져, 서로 다른 조합이 같은 문자열이 될 수 있다.
   * 그런 충돌이 있으면 본문을 고치고도 지문을 그대로 맞출 수 있다.
   */
  it('본문 끝과 첨부 시작을 옮겨도 같은 지문이 나오지 않는다', () => {
    const a = computeContractFingerprint({
      ...base(),
      content: 'AB',
      attachments: [{ type: 'rules', title: 'T', content: 'CD' }],
    });
    const b = computeContractFingerprint({
      ...base(),
      content: 'ABC',
      attachments: [{ type: 'rules', title: 'T', content: 'D' }],
    });
    expect(a).not.toBe(b);
  });

  describe('대조', () => {
    it('보관된 지문과 맞으면 match', () => {
      const stored = computeContractFingerprint(base());
      const verdict = verifyContractFingerprint(stored, base());
      expect(verdict.status).toBe('match');
      if (verdict.status === 'match') expect(verdict.version).toBe('v4');
    });

    it('본문이 바뀌었으면 mismatch — 변조 의심', () => {
      const stored = computeContractFingerprint(base());
      const verdict = verifyContractFingerprint(stored, { ...base(), content: '변조된 본문' });

      expect(verdict.status).toBe('mismatch');
      if (verdict.status === 'mismatch') {
        expect(verdict.expected).toBe(stored);
        expect(verdict.actual).not.toBe(stored);
        expect(verdict.actual).toMatch(/^v4:[0-9a-f]{64}$/);
      }
    });

    /**
     * 불일치와 "검증 불가"는 다르다. 지문이 없거나 형식을 모르는 계약은 변조 의심으로
     * 올리면 안 된다 — 사유를 붙여 따로 답한다.
     */
    it('지문이 없으면 unverifiable/none', () => {
      const verdict = verifyContractFingerprint(null, base());
      expect(verdict).toEqual({ status: 'unverifiable', reason: 'none', stored: null });
    });

    /**
     * 접두사 없는 옛 지문은 v3로 가정해 재계산한다 — 실 DB에 그 형식의 서명 계약이 있다.
     * 맞으면 확실히 그 문서다. 안 맞으면 v2일 수도 있어 변조로 단정하지 않는다.
     */
    it('접두사 없는 v3 지문이 v3 재계산과 맞으면 match(legacy)', () => {
      const bareV3 = computeFingerprintHexForVersion('v3', base());
      const verdict = verifyContractFingerprint(bareV3, base());
      expect(verdict).toEqual({ status: 'match', version: 'v3', fingerprint: bareV3, legacy: true });
    });

    it('접두사 없는 지문이 v3 재계산과도 안 맞으면 unverifiable/unversioned — 변조로 단정하지 않는다', () => {
      const bare = 'a'.repeat(64);
      const verdict = verifyContractFingerprint(bare, base());
      expect(verdict).toEqual({ status: 'unverifiable', reason: 'unversioned', stored: bare });
    });

    it('v3 형식은 v4에서 추가된 두 필드를 덮지 않는다 (git 24d50cf49d^ 재현)', () => {
      const a = computeFingerprintHexForVersion('v3', base());
      const b = computeFingerprintHexForVersion('v3', { ...base(), customerBirthdate: '2000-12-31', roomArea: '9m × 9m' });
      expect(a).toBe(b);
      // 반면 v4는 그 둘을 덮는다
      expect(computeFingerprintHexForVersion('v4', base())).not.toBe(
        computeFingerprintHexForVersion('v4', { ...base(), customerBirthdate: '2000-12-31' }),
      );
    });

    it('모르는 버전은 unverifiable/unknown-version — 변조로 오판하지 않는다', () => {
      const future = `v99:${'b'.repeat(64)}`;
      const verdict = verifyContractFingerprint(future, base());
      expect(verdict).toEqual({ status: 'unverifiable', reason: 'unknown-version', stored: future });
    });

    it('지문 형식이 아니면 unverifiable/malformed', () => {
      const verdict = verifyContractFingerprint('not-a-hash', base());
      expect(verdict).toEqual({ status: 'unverifiable', reason: 'malformed', stored: 'not-a-hash' });
    });
  });

  it('눈으로 대조할 짧은 표기는 버전을 떼고 hex 앞 8자다', () => {
    const hex = 'abcdef1234567890'.repeat(4);
    expect(formatFingerprintForDisplay(`v4:${hex}`)).toBe('ABCD-EF12');
    // 접두사 없는 값도 같은 표기
    expect(formatFingerprintForDisplay(hex)).toBe('ABCD-EF12');
  });
});
