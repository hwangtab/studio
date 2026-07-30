/** @jest-environment node */

import {
  computeContractFingerprint,
  formatFingerprintForDisplay,
  verifyContractFingerprint,
  type ContractFingerprintInput,
} from './integrity';

const base = (): ContractFingerprintInput => ({
  contractId: 'contract-1',
  content: '# 음악연습실 이용계약서\n\n월 이용료 300,000원',
  attachmentContents: ['# 공동생활 이용수칙\n\n금연'],
  signatureData: 'data:image/png;base64,AAAA',
  signedAt: new Date('2026-07-30T05:00:00.000Z'),
});

describe('문서 무결성 지문', () => {
  it('같은 입력에 항상 같은 지문을 낸다', () => {
    expect(computeContractFingerprint(base())).toBe(computeContractFingerprint(base()));
  });

  it('SHA-256 형태(64자 16진수)를 낸다', () => {
    expect(computeContractFingerprint(base())).toMatch(/^[0-9a-f]{64}$/);
  });

  // 아래 항목이 하나라도 바뀌면 "그때 서명한 그 문서"가 아니다.
  it.each([
    ['계약 본문', { content: '# 음악연습실 이용계약서\n\n월 이용료 900,000원' }],
    ['첨부 내용', { attachmentContents: ['# 공동생활 이용수칙\n\n흡연 허용'] }],
    ['서명 이미지', { signatureData: 'data:image/png;base64,BBBB' }],
    ['서명 시각', { signedAt: new Date('2026-07-30T05:00:01.000Z') }],
    ['계약 식별자', { contractId: 'contract-2' }],
  ])('%s가 바뀌면 지문이 달라진다', (_label, patch) => {
    const original = computeContractFingerprint(base());
    const changed = computeContractFingerprint({ ...base(), ...patch });
    expect(changed).not.toBe(original);
  });

  it('첨부가 없는 계약과 빈 첨부가 있는 계약을 구분한다', () => {
    const none = computeContractFingerprint({ ...base(), attachmentContents: [] });
    const empty = computeContractFingerprint({ ...base(), attachmentContents: [null] });
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
      attachmentContents: ['CD'],
    });
    const b = computeContractFingerprint({
      ...base(),
      content: 'ABC',
      attachmentContents: ['D'],
    });
    expect(a).not.toBe(b);
  });

  describe('대조', () => {
    it('보관된 지문과 맞으면 통과한다', () => {
      const stored = computeContractFingerprint(base());
      expect(verifyContractFingerprint(stored, base()).ok).toBe(true);
    });

    it('본문이 바뀌었으면 불일치를 알린다', () => {
      const stored = computeContractFingerprint(base());
      const result = verifyContractFingerprint(stored, { ...base(), content: '변조된 본문' });

      expect(result.ok).toBe(false);
      expect(result.expected).toBe(stored);
      expect(result.actual).not.toBe(stored);
    });

    it('지문이 없는 과거 계약은 불일치로 본다', () => {
      expect(verifyContractFingerprint(null, base()).ok).toBe(false);
    });
  });

  it('눈으로 대조할 짧은 표기를 만든다', () => {
    const display = formatFingerprintForDisplay('abcdef1234567890'.repeat(4));
    expect(display).toBe('ABCD-EF12');
  });
});
