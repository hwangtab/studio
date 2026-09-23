import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * 필드 단위 암호화 — AES-256-GCM.
 *
 * 주민등록번호처럼 **저장 시 암호화가 법적 의무인 값**(개인정보보호법 §24의3)을 DB에
 * 넣기 전에 여기를 지난다. 이 모듈이 조용히 실패해 평문이 저장되는 것이 최악의 결함이라,
 * 키가 없거나 형식이 틀리면 **반드시 던진다.** 빈 문자열이나 평문을 돌려주는 경로는 없다.
 *
 * 저장 형식: `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 * 판본 접두사는 나중에 알고리즘·키를 바꿀 때 **옛 값을 구분할 유일한 수단**이다.
 * IV는 레코드마다 새로 뽑는다 — GCM에서 같은 키로 IV를 재사용하면 기밀성과 인증이
 * 함께 무너진다.
 *
 * 키는 env `FUNDING_FIELD_KEY`(base64 32바이트)이고 **호출 시점에** 읽는다. 모듈 최상위에서
 * 읽으면 키 없는 환경에서 import만으로 빌드가 깨진다(이 저장소는 `TURSO_*` 없이 빌드가
 * 되어야 한다는 규칙이 있고 같은 이유가 적용된다 — CLAUDE.md).
 *
 * 에러 메시지에는 평문·키·암호문을 넣지 않는다. 코드(`FieldCryptoError.code`)만으로
 * 호출부가 분기할 수 있게 한다.
 */

/** 현재 쓰는 저장 판본. 새 판본을 만들면 옛 값을 읽는 경로를 함께 남겨야 한다. */
export const FIELD_CRYPTO_VERSION = 'v1';

/** 키를 담는 환경 변수 이름. */
export const FIELD_CRYPTO_KEY_ENV = 'FUNDING_FIELD_KEY';

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM 표준 nonce 길이
const TAG_BYTES = 16;

export type FieldCryptoErrorCode =
  /** env에 키가 없거나 비어 있다. */
  | 'missing_key'
  /** 키가 base64가 아니거나 32바이트가 아니다. */
  | 'invalid_key'
  /** 저장 형식 자체가 아니다 — 조각 수·base64·길이가 어긋난다. */
  | 'malformed'
  /** 판본 접두사가 이 모듈이 모르는 값이다. */
  | 'unsupported_version'
  /**
   * 인증 태그 검증 실패. **키가 바뀐 것과 값이 깨진 것을 여기서 더 나눌 수는 없다** —
   * GCM은 둘 다 같은 방식으로 실패하고, 구분하려면 암호문에 키 식별자를 함께 적어야 한다
   * (지금 형식에는 없다). 운영 중 이 코드가 뜨면 같은 키로 다른 행이 풀리는지를 보고
   * 키 문제인지 값 문제인지 판단한다.
   */
  | 'auth_failed';

export class FieldCryptoError extends Error {
  readonly code: FieldCryptoErrorCode;

  constructor(code: FieldCryptoErrorCode, message: string) {
    super(message);
    this.name = 'FieldCryptoError';
    this.code = code;
  }
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * 키를 **호출 시점에** 읽는다. 캐시하지 않는다 — 키를 교체한 뒤 프로세스를 살려 두는
 * 경우와 테스트가 env를 바꿔 끼우는 경우가 같은 모양이다.
 */
const loadKey = (): Buffer => {
  const raw = process.env[FIELD_CRYPTO_KEY_ENV]?.trim();
  if (!raw) {
    throw new FieldCryptoError(
      'missing_key',
      `${FIELD_CRYPTO_KEY_ENV}가 설정되지 않았다. 암호화 없이 저장할 수 없다.`,
    );
  }
  if (!BASE64_PATTERN.test(raw)) {
    throw new FieldCryptoError('invalid_key', `${FIELD_CRYPTO_KEY_ENV}가 base64 형식이 아니다.`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new FieldCryptoError(
      'invalid_key',
      `${FIELD_CRYPTO_KEY_ENV}는 base64로 ${KEY_BYTES}바이트여야 한다(현재 ${key.length}바이트).`,
    );
  }
  return key;
};

const decodeBase64 = (part: string, expectedBytes?: number): Buffer => {
  // 빈 조각은 길이 검사로 갈린다 — 평문이 빈 문자열이면 암호문 조각이 정당하게 비어 있다.
  if (part.length > 0 && !BASE64_PATTERN.test(part)) {
    throw new FieldCryptoError('malformed', '암호화 필드의 조각이 base64가 아니다.');
  }
  const buffer = Buffer.from(part, 'base64');
  if (expectedBytes !== undefined && buffer.length !== expectedBytes) {
    throw new FieldCryptoError('malformed', '암호화 필드의 조각 길이가 형식과 다르다.');
  }
  return buffer;
};

/**
 * 평문을 `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` 한 문자열로 만든다.
 * 키가 없거나 형식이 틀리면 던진다 — 호출부가 평문을 그대로 저장하는 경로는 없어야 한다.
 */
export const encryptField = (plaintext: string): string => {
  if (typeof plaintext !== 'string') {
    throw new FieldCryptoError('malformed', '암호화 입력은 문자열이어야 한다.');
  }
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FIELD_CRYPTO_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
};

/**
 * 저장 문자열을 평문으로 되돌린다. 실패는 전부 `FieldCryptoError`이고 `code`로 갈린다
 * (`malformed` / `unsupported_version` / `auth_failed` / 키 쪽 `missing_key`·`invalid_key`).
 */
export const decryptField = (stored: string): string => {
  if (typeof stored !== 'string' || stored.length === 0) {
    throw new FieldCryptoError('malformed', '암호화 필드가 비어 있다.');
  }
  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new FieldCryptoError('malformed', '암호화 필드의 조각 수가 형식과 다르다.');
  }
  const [version, ivPart, tagPart, ciphertextPart] = parts;
  if (version !== FIELD_CRYPTO_VERSION) {
    throw new FieldCryptoError(
      'unsupported_version',
      `알 수 없는 암호화 판본이다(지원: ${FIELD_CRYPTO_VERSION}).`,
    );
  }

  const key = loadKey();
  const iv = decodeBase64(ivPart, IV_BYTES);
  const tag = decodeBase64(tagPart, TAG_BYTES);
  const ciphertext = decodeBase64(ciphertextPart);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // 원본 예외는 삼킨다 — 메시지에 암호문 조각이 섞여 나갈 여지를 없앤다.
    throw new FieldCryptoError(
      'auth_failed',
      '복호화에 실패했다. 키가 다르거나 값이 손상됐다.',
    );
  }
};

/**
 * 이 모듈이 만든 형식으로 **보이는지**만 본다(키를 쓰지 않으므로 진짜 풀리는지는 모른다).
 * 마이그레이션·점검에서 평문이 섞여 들어왔는지 훑을 때 쓴다.
 */
export const isEncryptedField = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.split(':').length === 4 && value.startsWith(`${FIELD_CRYPTO_VERSION}:`);
