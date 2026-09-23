import { randomBytes } from 'node:crypto';

import {
  FIELD_CRYPTO_KEY_ENV,
  FIELD_CRYPTO_VERSION,
  FieldCryptoError,
  decryptField,
  encryptField,
  isEncryptedField,
} from './fieldCrypto';

// 테스트 값은 전부 임의 문자열이다 — 주민등록번호 형태의 값을 쓰지 않는다.
const SAMPLE = 'alpha-bravo-charlie-42';

const makeKey = (): string => randomBytes(32).toString('base64');

const original = process.env[FIELD_CRYPTO_KEY_ENV];

const setKey = (value: string | undefined) => {
  if (value === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = value;
};

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(FieldCryptoError);
    return (error as FieldCryptoError).code;
  }
  throw new Error('던지지 않았다.');
};

beforeEach(() => {
  setKey(makeKey());
});

afterAll(() => {
  setKey(original);
});

describe('encryptField / decryptField', () => {
  it('왕복하면 원문과 같다', () => {
    expect(decryptField(encryptField(SAMPLE))).toBe(SAMPLE);
  });

  it('빈 문자열과 유니코드도 왕복한다', () => {
    expect(decryptField(encryptField(''))).toBe('');
    const unicode = '한글 · 絵文字 🎛 · ÅÉÎ';
    expect(decryptField(encryptField(unicode))).toBe(unicode);
  });

  it('저장 형식은 v1 판본 접두사 + 네 조각이다', () => {
    const stored = encryptField(SAMPLE);
    const parts = stored.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe(FIELD_CRYPTO_VERSION);
    expect(Buffer.from(parts[1], 'base64')).toHaveLength(12); // IV
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(16); // 인증 태그
    expect(stored).not.toContain(SAMPLE);
    expect(isEncryptedField(stored)).toBe(true);
  });

  it('같은 평문을 두 번 암호화하면 암호문이 다르다 (IV 재사용 금지)', () => {
    const a = encryptField(SAMPLE);
    const b = encryptField(SAMPLE);
    expect(a).not.toBe(b);
    expect(a.split(':')[1]).not.toBe(b.split(':')[1]);
    expect(a.split(':')[3]).not.toBe(b.split(':')[3]);
    expect(decryptField(a)).toBe(SAMPLE);
    expect(decryptField(b)).toBe(SAMPLE);
  });
});

describe('키 검사', () => {
  it('키가 없으면 암호화가 던진다', () => {
    setKey(undefined);
    expect(codeOf(() => encryptField(SAMPLE))).toBe('missing_key');
  });

  it('키가 빈 문자열이어도 던진다', () => {
    setKey('   ');
    expect(codeOf(() => encryptField(SAMPLE))).toBe('missing_key');
  });

  it('키 길이가 32바이트가 아니면 던진다', () => {
    setKey(randomBytes(16).toString('base64'));
    expect(codeOf(() => encryptField(SAMPLE))).toBe('invalid_key');
  });

  it('키가 base64가 아니면 던진다', () => {
    setKey('not base64!!');
    expect(codeOf(() => encryptField(SAMPLE))).toBe('invalid_key');
  });

  it('키가 없으면 복호화도 던진다', () => {
    const stored = encryptField(SAMPLE);
    setKey(undefined);
    expect(codeOf(() => decryptField(stored))).toBe('missing_key');
  });

  it('틀린 키로는 복호화가 실패한다', () => {
    const stored = encryptField(SAMPLE);
    setKey(makeKey());
    expect(codeOf(() => decryptField(stored))).toBe('auth_failed');
  });
});

describe('변조·형식 위반', () => {
  it('암호문을 변조하면 복호화가 실패한다', () => {
    const [version, iv, tag, ciphertext] = encryptField(SAMPLE).split(':');
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [version, iv, tag, bytes.toString('base64')].join(':');
    expect(codeOf(() => decryptField(tampered))).toBe('auth_failed');
  });

  it('인증 태그를 변조하면 복호화가 실패한다', () => {
    const [version, iv, tag, ciphertext] = encryptField(SAMPLE).split(':');
    const bytes = Buffer.from(tag, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [version, iv, bytes.toString('base64'), ciphertext].join(':');
    expect(codeOf(() => decryptField(tampered))).toBe('auth_failed');
  });

  it('IV를 바꾸면 복호화가 실패한다', () => {
    const [version, , tag, ciphertext] = encryptField(SAMPLE).split(':');
    const tampered = [version, randomBytes(12).toString('base64'), tag, ciphertext].join(':');
    expect(codeOf(() => decryptField(tampered))).toBe('auth_failed');
  });

  it('판본 접두사가 없으면 거부한다', () => {
    const stored = encryptField(SAMPLE);
    const withoutVersion = stored.split(':').slice(1).join(':');
    expect(codeOf(() => decryptField(withoutVersion))).toBe('malformed');
  });

  it('모르는 판본은 거부한다', () => {
    const [, iv, tag, ciphertext] = encryptField(SAMPLE).split(':');
    expect(codeOf(() => decryptField(['v2', iv, tag, ciphertext].join(':')))).toBe(
      'unsupported_version',
    );
  });

  it('평문·빈 값은 형식 위반이다', () => {
    expect(codeOf(() => decryptField(SAMPLE))).toBe('malformed');
    expect(codeOf(() => decryptField(''))).toBe('malformed');
    expect(isEncryptedField(SAMPLE)).toBe(false);
    expect(isEncryptedField(null)).toBe(false);
  });

  it('IV·태그 길이가 형식과 다르면 거부한다', () => {
    const [version, , tag, ciphertext] = encryptField(SAMPLE).split(':');
    expect(
      codeOf(() => decryptField([version, randomBytes(8).toString('base64'), tag, ciphertext].join(':'))),
    ).toBe('malformed');
    expect(
      codeOf(() =>
        decryptField([version, randomBytes(12).toString('base64'), randomBytes(8).toString('base64'), ciphertext].join(':')),
      ),
    ).toBe('malformed');
  });

  it('오류 메시지에 평문·키·암호문이 섞이지 않는다', () => {
    const key = process.env[FIELD_CRYPTO_KEY_ENV] as string;
    const stored = encryptField(SAMPLE);
    setKey(makeKey());
    try {
      decryptField(stored);
      throw new Error('던지지 않았다.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toContain(SAMPLE);
      expect(message).not.toContain(key);
      expect(message).not.toContain(stored.split(':')[3]);
    }
  });
});
