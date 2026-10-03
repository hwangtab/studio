jest.mock('../../db/client', () => ({ getDb: jest.fn() }));

import { evaluateScanLink, hashScanToken } from './scanLink';

describe('scanLink 판정', () => {
  it('해시는 결정적이고 원문과 다르다', () => {
    expect(hashScanToken('abc')).toBe(hashScanToken('abc'));
    expect(hashScanToken('abc')).not.toBe(hashScanToken('abd'));
    expect(hashScanToken('abc')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('없는 행·폐기·만료를 가른다', () => {
    expect(evaluateScanLink(null, 100)).toBe('invalid');
    expect(evaluateScanLink({ expiresAt: 200, revokedAt: 50 }, 100)).toBe('revoked');
    expect(evaluateScanLink({ expiresAt: 100, revokedAt: null }, 100)).toBe('expired');
    expect(evaluateScanLink({ expiresAt: 101, revokedAt: null }, 100)).toBeNull();
  });
});
