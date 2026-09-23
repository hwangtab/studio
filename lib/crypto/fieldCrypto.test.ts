import { createCipheriv, createHash, randomBytes } from 'node:crypto';

import {
  FIELD_CRYPTO_KEY_ENV,
  FIELD_CRYPTO_VERSION,
  FieldCryptoError,
  decryptField,
  decryptFieldWithKey,
  deriveKeyId,
  encryptField,
  encryptFieldWithKey,
  isEncryptedField,
  parseFieldKey,
  readFieldKeyId,
} from './fieldCrypto';

// 테스트 값은 전부 임의 문자열이다 — 주민등록번호 형태의 값을 쓰지 않는다.
const SAMPLE = 'alpha-bravo-charlie-42';

const makeKey = (): string => randomBytes(32).toString('base64');

const original = process.env[FIELD_CRYPTO_KEY_ENV];

const setKey = (value: string | undefined) => {
  if (value === undefined) delete process.env[FIELD_CRYPTO_KEY_ENV];
  else process.env[FIELD_CRYPTO_KEY_ENV] = value;
};

const currentKey = (): Buffer => parseFieldKey(process.env[FIELD_CRYPTO_KEY_ENV]);

/**
 * 판본 v1 값을 만든다 — **운영 DB에 이미 들어 있는 형식**이다. 모듈은 더 이상 v1을 쓰지
 * 않으므로 여기서 직접 만든다. 이 함수가 만드는 것과 같은 모양의 값이 실제로 저장돼 있다.
 */
const makeV1 = (plaintext: string, key: Buffer): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
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

  it('새로 쓰는 값은 v2 — 판본·keyId·IV·태그·암호문 다섯 조각이다', () => {
    const stored = encryptField(SAMPLE);
    const parts = stored.split(':');
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(FIELD_CRYPTO_VERSION);
    expect(FIELD_CRYPTO_VERSION).toBe('v2');
    expect(parts[1]).toBe(deriveKeyId(currentKey()));
    expect(Buffer.from(parts[2], 'base64')).toHaveLength(12); // IV
    expect(Buffer.from(parts[3], 'base64')).toHaveLength(16); // 인증 태그
    expect(stored).not.toContain(SAMPLE);
    expect(isEncryptedField(stored)).toBe(true);
  });

  it('같은 평문을 두 번 암호화하면 keyId는 같고 IV·암호문은 다르다', () => {
    const a = encryptField(SAMPLE).split(':');
    const b = encryptField(SAMPLE).split(':');
    expect(a[1]).toBe(b[1]); // keyId — 같은 키니까 같다
    expect(a[2]).not.toBe(b[2]); // IV 재사용 금지
    expect(a[4]).not.toBe(b[4]);
    expect(decryptField(a.join(':'))).toBe(SAMPLE);
    expect(decryptField(b.join(':'))).toBe(SAMPLE);
  });
});

describe('판본 v1 — 이미 저장된 값', () => {
  it('v1 값을 그대로 읽는다', () => {
    const stored = makeV1(SAMPLE, currentKey());
    expect(decryptField(stored)).toBe(SAMPLE);
    expect(isEncryptedField(stored)).toBe(true);
    expect(readFieldKeyId(stored)).toBeNull();
  });

  it('v1은 키가 달라도 key_mismatch가 아니라 auth_failed다 — keyId가 없어 구분할 수 없다', () => {
    const stored = makeV1(SAMPLE, currentKey());
    setKey(makeKey());
    expect(codeOf(() => decryptField(stored))).toBe('auth_failed');
  });
});

describe('keyId', () => {
  it('키에서 결정적으로 나온다 — 같은 키는 같은 값, 다른 키는 다른 값', () => {
    const key = randomBytes(32);
    expect(deriveKeyId(key)).toBe(deriveKeyId(Buffer.from(key)));
    expect(deriveKeyId(key)).not.toBe(deriveKeyId(randomBytes(32)));
  });

  it('길이와 표기가 의도대로다 — sha256 앞 4바이트를 hex 8자로', () => {
    const id = deriveKeyId(randomBytes(32));
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    // 32바이트 다이제스트 중 4바이트만 남는다 = 키를 지목할 수 없다(나머지 28바이트를 버렸다).
    expect(id).toHaveLength(8);
  });

  it('키 바이트가 keyId에 그대로 드러나지 않는다', () => {
    const key = randomBytes(32);
    const id = deriveKeyId(key);
    expect(id).not.toContain(key.toString('hex').slice(0, 8));
    expect(key.toString('base64')).not.toContain(id);
    // 도메인 문자열을 섞으므로 민짜 sha256(key)와도 다르다.
    const plain = createHash('sha256').update(key).digest('hex').slice(0, 8);
    expect(id).not.toBe(plain);
  });

  it('keyId가 다르면 auth_failed가 아니라 key_mismatch다', () => {
    const stored = encryptField(SAMPLE);
    setKey(makeKey());
    expect(codeOf(() => decryptField(stored))).toBe('key_mismatch');
  });

  it('변조된 v2는 여전히 auth_failed다 — 키가 맞는데 안 열린 것이다', () => {
    const parts = encryptField(SAMPLE).split(':');
    const bytes = Buffer.from(parts[4], 'base64');
    bytes[0] ^= 0xff;
    parts[4] = bytes.toString('base64');
    expect(codeOf(() => decryptField(parts.join(':')))).toBe('auth_failed');
  });

  it('keyId 자리가 hex 8자가 아니면 형식 위반이다', () => {
    const parts = encryptField(SAMPLE).split(':');
    parts[1] = 'zzzzzzzz';
    expect(codeOf(() => decryptField(parts.join(':')))).toBe('malformed');
  });
});

describe('키를 직접 받는 판 (회전용)', () => {
  it('env와 무관하게 주어진 키로 왕복한다', () => {
    const key = randomBytes(32);
    setKey(undefined);
    const stored = encryptFieldWithKey(SAMPLE, key);
    expect(decryptFieldWithKey(stored, key)).toBe(SAMPLE);
    expect(readFieldKeyId(stored)).toBe(deriveKeyId(key));
  });

  it('다른 키로 열면 key_mismatch', () => {
    const stored = encryptFieldWithKey(SAMPLE, randomBytes(32));
    expect(codeOf(() => decryptFieldWithKey(stored, randomBytes(32)))).toBe('key_mismatch');
  });

  it('parseFieldKey는 env 이름을 메시지에 적되 값은 적지 않는다', () => {
    const raw = makeKey();
    expect(parseFieldKey(raw)).toHaveLength(32);
    try {
      parseFieldKey(randomBytes(16).toString('base64'), 'FUNDING_FIELD_KEY_OLD');
      throw new Error('던지지 않았다.');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('FUNDING_FIELD_KEY_OLD');
      expect(message).not.toContain(raw);
    }
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
});

describe('변조·형식 위반', () => {
  it('인증 태그를 변조하면 복호화가 실패한다', () => {
    const parts = encryptField(SAMPLE).split(':');
    const bytes = Buffer.from(parts[3], 'base64');
    bytes[0] ^= 0xff;
    parts[3] = bytes.toString('base64');
    expect(codeOf(() => decryptField(parts.join(':')))).toBe('auth_failed');
  });

  it('IV를 바꾸면 복호화가 실패한다', () => {
    const parts = encryptField(SAMPLE).split(':');
    parts[2] = randomBytes(12).toString('base64');
    expect(codeOf(() => decryptField(parts.join(':')))).toBe('auth_failed');
  });

  it('판본 접두사가 없으면 거부한다', () => {
    const stored = encryptField(SAMPLE);
    const withoutVersion = stored.split(':').slice(1).join(':');
    expect(codeOf(() => decryptField(withoutVersion))).toBe('malformed');
  });

  it('모르는 판본은 거부한다 — 형식 위반과 갈라야 "값을 지우지 마라"가 정확해진다', () => {
    const [, keyId, iv, tag, ciphertext] = encryptField(SAMPLE).split(':');
    expect(codeOf(() => decryptField(['v3', keyId, iv, tag, ciphertext].join(':')))).toBe(
      'unsupported_version',
    );
    expect(isEncryptedField(['v3', keyId, iv, tag, ciphertext].join(':'))).toBe(false);
  });

  it('조각 수가 판본과 안 맞으면 거부한다', () => {
    const parts = encryptField(SAMPLE).split(':');
    expect(codeOf(() => decryptField(parts.slice(0, 4).join(':')))).toBe('malformed');
    expect(codeOf(() => decryptField(['v1', ...parts.slice(1)].join(':')))).toBe('malformed');
  });

  it('평문·빈 값은 형식 위반이다', () => {
    expect(codeOf(() => decryptField(SAMPLE))).toBe('malformed');
    expect(codeOf(() => decryptField(''))).toBe('malformed');
    expect(isEncryptedField(SAMPLE)).toBe(false);
    expect(isEncryptedField(null)).toBe(false);
  });

  it('IV·태그 길이가 형식과 다르면 거부한다', () => {
    const parts = encryptField(SAMPLE).split(':');
    expect(codeOf(() => decryptField([...parts.slice(0, 2), randomBytes(8).toString('base64'), parts[3], parts[4]].join(':')))).toBe('malformed');
    expect(codeOf(() => decryptField([...parts.slice(0, 3), randomBytes(8).toString('base64'), parts[4]].join(':')))).toBe('malformed');
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
      expect(message).not.toContain(stored.split(':')[4]);
    }
  });
});
