/** @jest-environment node */
/**
 * 정산 계좌 봉투 — 세 값이 한 암호문에 들어가고 그대로 돌아오는가, 그리고 **실패가 전부
 * `FieldCryptoError`인가.** 뒤엣것이 중요한 이유: 관리자 조회 라우트와 정산 게이트가 이미
 * 그 코드 집합으로 분기하고 있어서, 여기서 다른 예외가 새면 그 분기가 통째로 빠진다.
 */
import { FieldCryptoError, FIELD_CRYPTO_KEY_ENV, encryptField } from '../crypto/fieldCrypto';
import { decryptPayoutAccount, encryptPayoutAccount, payoutAccountLast4 } from './payoutAccountCrypto';

const FIELDS = { bankName: '국민은행', account: '123-456-789012', holder: '황경하' };

const original = process.env[FIELD_CRYPTO_KEY_ENV];
beforeEach(() => {
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 7).toString('base64');
});
afterEach(() => {
  if (original === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = original;
});

it('암호문 어디에도 평문 세 값이 없다', () => {
  const stored = encryptPayoutAccount(FIELDS);
  expect(stored).not.toContain('123-456-789012');
  expect(stored).not.toContain('123456789012');
  expect(stored).not.toContain('국민은행');
  expect(stored).not.toContain('황경하');
  expect(stored.startsWith('v2:')).toBe(true);
});

it('복호화하면 세 값이 그대로 돌아온다', () => {
  expect(decryptPayoutAccount(encryptPayoutAccount(FIELDS))).toEqual(FIELDS);
});

it('키가 없으면 던진다 — 평문을 돌려주는 경로는 없다', () => {
  delete process.env[FIELD_CRYPTO_KEY_ENV];
  expect(() => encryptPayoutAccount(FIELDS)).toThrow(FieldCryptoError);
  try {
    encryptPayoutAccount(FIELDS);
  } catch (error) {
    expect((error as FieldCryptoError).code).toBe('missing_key');
  }
});

it('다른 키로 만든 값은 key_mismatch다 — 값이 손상된 것과 가른다', () => {
  const stored = encryptPayoutAccount(FIELDS);
  process.env[FIELD_CRYPTO_KEY_ENV] = Buffer.alloc(32, 9).toString('base64');
  try {
    decryptPayoutAccount(stored);
    throw new Error('던졌어야 한다');
  } catch (error) {
    expect((error as FieldCryptoError).code).toBe('key_mismatch');
  }
});

describe('봉투가 깨진 값도 FieldCryptoError다 — 라우트의 분기가 그 코드만 안다', () => {
  it('JSON이 아니면 malformed', () => {
    const stored = encryptField('국민은행 123-456-789012 황경하');
    try {
      decryptPayoutAccount(stored);
      throw new Error('던졌어야 한다');
    } catch (error) {
      expect(error).toBeInstanceOf(FieldCryptoError);
      expect((error as FieldCryptoError).code).toBe('malformed');
    }
  });

  it('칸이 빠져 있으면 malformed', () => {
    const stored = encryptField(JSON.stringify({ bankName: '국민은행', account: '123' }));
    try {
      decryptPayoutAccount(stored);
      throw new Error('던졌어야 한다');
    } catch (error) {
      expect((error as FieldCryptoError).code).toBe('malformed');
    }
  });

  it('오류 메시지에 평문이 실리지 않는다', () => {
    const stored = encryptField(JSON.stringify({ bankName: '국민은행', account: '123-456-789012' }));
    try {
      decryptPayoutAccount(stored);
      throw new Error('던졌어야 한다');
    } catch (error) {
      expect((error as Error).message).not.toContain('123-456-789012');
      expect((error as Error).message).not.toContain('국민은행');
    }
  });
});

describe('뒤 4자리', () => {
  it('하이픈을 무시하고 숫자 뒤 4자리를 낸다', () => {
    expect(payoutAccountLast4('123-456-789012')).toBe('9012');
    expect(payoutAccountLast4('1000 0000 0000')).toBe('0000');
  });

  it('숫자가 4자리에 못 미치면 null이다', () => {
    expect(payoutAccountLast4('12-3')).toBeNull();
  });
});
