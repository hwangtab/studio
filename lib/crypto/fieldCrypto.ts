import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 필드 단위 암호화 — AES-256-GCM.
 *
 * 주민등록번호처럼 **저장 시 암호화가 법적 의무인 값**(개인정보 보호법이 주민등록번호를
 * 암호화해 보관하도록 정하고 있다)을 DB에
 * 넣기 전에 여기를 지난다. 이 모듈이 조용히 실패해 평문이 저장되는 것이 최악의 결함이라,
 * 키가 없거나 형식이 틀리면 **반드시 던진다.** 빈 문자열이나 평문을 돌려주는 경로는 없다.
 *
 * 저장 형식은 두 판본이 공존한다:
 * - `v1:<iv_b64>:<tag_b64>:<ct_b64>` — **읽기만** 한다. 운영 DB에 이미 들어 있는 값이다.
 * - `v2:<keyId>:<iv_b64>:<tag_b64>:<ct_b64>` — **새로 쓰는 것은 전부 이 판본이다.**
 *
 * v2가 늘린 것은 `keyId` 하나다. v1에서는 `auth_failed`가 "키가 바뀌었다"와 "값이
 * 손상됐다"를 구분하지 못했다 — GCM은 둘 다 같은 방식으로 실패한다. 키를 회전하는
 * 동안에는 그 구분이 반드시 필요하다: 어느 행이 아직 옛 키인지 알아야 중단된 회전을
 * 이어서 돌릴 수 있고, 다시 돌릴 때 이미 바뀐 행을 건너뛸 수 있다
 * (`scripts/rotate-field-key.mjs`, `lib/crypto/fieldKeyRotation.ts`).
 *
 * IV는 레코드마다 새로 뽑는다 — GCM에서 같은 키로 IV를 재사용하면 기밀성과 인증이
 * 함께 무너진다. `keyId`는 키에서 결정적으로 나오므로 같은 키로 두 번 암호화하면
 * keyId만 같고 IV·암호문은 매번 다르다.
 *
 * 키는 env `FUNDING_FIELD_KEY`(base64 32바이트)이고 **호출 시점에** 읽는다. 모듈 최상위에서
 * 읽으면 키 없는 환경에서 import만으로 빌드가 깨진다(이 저장소는 `TURSO_*` 없이 빌드가
 * 되어야 한다는 규칙이 있고 같은 이유가 적용된다 — CLAUDE.md).
 *
 * 에러 메시지에는 평문·키·암호문을 넣지 않는다. 코드(`FieldCryptoError.code`)만으로
 * 호출부가 분기할 수 있게 한다.
 */

/** 새로 쓸 때 붙이는 판본. 읽기는 `FIELD_CRYPTO_READABLE_VERSIONS` 전부를 받는다. */
export const FIELD_CRYPTO_VERSION = 'v2';

/** 복호화가 받아 주는 판본 전부. v1은 이미 저장된 값이라 영구히 읽을 수 있어야 한다. */
export const FIELD_CRYPTO_READABLE_VERSIONS = ['v1', 'v2'] as const;

/** 키를 담는 환경 변수 이름. */
export const FIELD_CRYPTO_KEY_ENV = 'FUNDING_FIELD_KEY';

const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM 표준 nonce 길이
const TAG_BYTES = 16;

/**
 * keyId 길이(바이트). hex로 적으므로 문자열은 이 두 배다.
 *
 * 4바이트(hex 8자)로 둔 근거:
 * - **키를 역산할 수 없어야 한다.** sha256은 역상 저항이 있고, 여기서는 그 다이제스트를
 *   32바이트 중 4바이트만 남긴다. 잘라 버린 28바이트 때문에 같은 keyId를 내는 키가
 *   2^224가량 존재한다 — keyId는 키를 **지목하지 못한다**(그래서 키 검증 수단으로 써서도
 *   안 된다. 실제 판정은 언제나 GCM 인증 태그가 한다).
 * - **서로 다른 우리 키를 가릴 수 있어야 한다.** 이 값이 구분해야 하는 대상은 회전 전후의
 *   키 두세 개뿐이라 32비트면 충돌이 사실상 나지 않는다. 그래도 충돌하면 태그 검증이
 *   `auth_failed`로 잡으므로 잘못된 평문이 나오는 경로는 없다.
 * - 저장 문자열이 행마다 9바이트만 길어진다.
 */
const KEY_ID_BYTES = 4;

/**
 * keyId 유도에 섞는 도메인 문자열. 이걸 넣지 않으면 keyId가 곧 `sha256(key)`의 앞부분이
 * 되어, 다른 곳에서 같은 키의 sha256을 쓰는 순간 두 값이 서로를 검증해 준다.
 * 용도가 다르면 다이제스트도 갈라 둔다.
 */
const KEY_ID_DOMAIN = 'studionol:field-key-id:v2';

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
   * v2 값에 적힌 `keyId`가 지금 쓰는 키의 것과 다르다 — **값은 멀쩡하고 키가 다른 것이다.**
   * 옛 키가 남아 있으면 그대로 복구되고, 회전 스크립트가 이어서 돌리면 된다.
   * v1 값에는 keyId가 없으므로 이 코드가 나올 수 없다(그때는 예전처럼 `auth_failed`다).
   */
  | 'key_mismatch'
  /**
   * 인증 태그 검증 실패. v2에서는 keyId가 맞는데도 안 열린 것이므로 **값이 손상됐다는
   * 뜻에 가깝다.** v1 값에서는 여전히 키가 다른 것과 값이 깨진 것이 섞여 있다 —
   * 그 구분이 필요해서 v2에 keyId를 넣었다.
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
const VERSION_PATTERN = /^v\d+$/;
const KEY_ID_PATTERN = new RegExp(`^[0-9a-f]{${KEY_ID_BYTES * 2}}$`);

/**
 * 키에서 식별자를 결정적으로 뽑는다. 같은 키는 언제나 같은 값을, 다른 키는 (사실상)
 * 다른 값을 낸다. 키를 역산하는 단서가 되지 않는 이유는 `KEY_ID_BYTES` 주석 참고.
 */
export const deriveKeyId = (key: Buffer): string =>
  createHash('sha256').update(KEY_ID_DOMAIN).update(key).digest().subarray(0, KEY_ID_BYTES).toString('hex');

/**
 * base64 문자열을 키 버퍼로. 회전 스크립트가 **옛 키·새 키를 같은 규칙으로** 검사해야 해서
 * env 이름을 인자로 받는다(메시지에 어느 변수가 문제인지 적기 위한 것일 뿐, 값은 안 적는다).
 */
export const parseFieldKey = (raw: string | undefined | null, envName: string = FIELD_CRYPTO_KEY_ENV): Buffer => {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new FieldCryptoError('missing_key', `${envName}가 설정되지 않았다. 암호화 없이 저장할 수 없다.`);
  }
  if (!BASE64_PATTERN.test(trimmed)) {
    throw new FieldCryptoError('invalid_key', `${envName}가 base64 형식이 아니다.`);
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new FieldCryptoError(
      'invalid_key',
      `${envName}는 base64로 ${KEY_BYTES}바이트여야 한다(현재 ${key.length}바이트).`,
    );
  }
  return key;
};

/**
 * 키를 **호출 시점에** 읽는다. 캐시하지 않는다 — 키를 교체한 뒤 프로세스를 살려 두는
 * 경우와 테스트가 env를 바꿔 끼우는 경우가 같은 모양이다.
 */
const loadKey = (): Buffer => parseFieldKey(process.env[FIELD_CRYPTO_KEY_ENV], FIELD_CRYPTO_KEY_ENV);

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

/** 저장 문자열을 판본별 조각으로 가른다. 키를 쓰지 않는다. */
interface ParsedField {
  version: 'v1' | 'v2';
  /** v1에는 없다. */
  keyId: string | null;
  iv: string;
  tag: string;
  ciphertext: string;
}

const parseStored = (stored: string): ParsedField => {
  if (typeof stored !== 'string' || stored.length === 0) {
    throw new FieldCryptoError('malformed', '암호화 필드가 비어 있다.');
  }
  const parts = stored.split(':');
  const version = parts[0];

  if (version === 'v1') {
    if (parts.length !== 4) {
      throw new FieldCryptoError('malformed', '암호화 필드의 조각 수가 형식과 다르다.');
    }
    return { version: 'v1', keyId: null, iv: parts[1], tag: parts[2], ciphertext: parts[3] };
  }

  if (version === 'v2') {
    if (parts.length !== 5) {
      throw new FieldCryptoError('malformed', '암호화 필드의 조각 수가 형식과 다르다.');
    }
    if (!KEY_ID_PATTERN.test(parts[1])) {
      throw new FieldCryptoError('malformed', '암호화 필드의 키 식별자가 형식과 다르다.');
    }
    return { version: 'v2', keyId: parts[1], iv: parts[2], tag: parts[3], ciphertext: parts[4] };
  }

  // `v3`처럼 **판본으로 보이는** 값만 unsupported_version이다. 그래야 "이 배포가 모르는
  // 새 판본이니 값을 지우지 마라"는 안내가 정확해진다. 그 밖은 형식 위반(평문 등)이다.
  if (typeof version === 'string' && VERSION_PATTERN.test(version)) {
    throw new FieldCryptoError(
      'unsupported_version',
      `알 수 없는 암호화 판본이다(지원: ${FIELD_CRYPTO_READABLE_VERSIONS.join(', ')}).`,
    );
  }
  throw new FieldCryptoError('malformed', '암호화 필드의 판본 접두사가 없다.');
};

/**
 * 저장된 값이 **어느 키로 잠겼는지**만 본다(복호화하지 않는다). v1은 keyId가 없으므로 null.
 * 회전 스크립트가 "이미 새 키인가"를 여기서 가린다 — 그게 v2를 만든 이유다.
 * 형식이 아니면 던진다.
 */
export const readFieldKeyId = (stored: string): string | null => parseStored(stored).keyId;

/** 평문을 `v2:<keyId>:<iv_b64>:<tag_b64>:<ct_b64>` 한 문자열로 만든다. 키를 직접 받는 판. */
export const encryptFieldWithKey = (plaintext: string, key: Buffer): string => {
  if (typeof plaintext !== 'string') {
    throw new FieldCryptoError('malformed', '암호화 입력은 문자열이어야 한다.');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    FIELD_CRYPTO_VERSION,
    deriveKeyId(key),
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
};

/**
 * 저장 문자열을 평문으로 되돌린다. 키를 직접 받는 판 — 회전 스크립트가 옛 키와 새 키를
 * 한 프로세스에서 함께 다뤄야 해서 env 판과 나눠 둔다.
 */
export const decryptFieldWithKey = (stored: string, key: Buffer): string => {
  const parsed = parseStored(stored);

  if (parsed.keyId !== null) {
    const expected = Buffer.from(deriveKeyId(key), 'hex');
    const actual = Buffer.from(parsed.keyId, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new FieldCryptoError(
        'key_mismatch',
        '이 값은 다른 키로 암호화됐다. 값은 손상되지 않았다 — 그 키가 있어야 열린다.',
      );
    }
  }

  const iv = decodeBase64(parsed.iv, IV_BYTES);
  const tag = decodeBase64(parsed.tag, TAG_BYTES);
  const ciphertext = decodeBase64(parsed.ciphertext);

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
 * 평문을 저장 문자열로. 키는 env에서 읽는다.
 * 키가 없거나 형식이 틀리면 던진다 — 호출부가 평문을 그대로 저장하는 경로는 없어야 한다.
 */
export const encryptField = (plaintext: string): string => {
  if (typeof plaintext !== 'string') {
    throw new FieldCryptoError('malformed', '암호화 입력은 문자열이어야 한다.');
  }
  return encryptFieldWithKey(plaintext, loadKey());
};

/**
 * 저장 문자열을 평문으로. 키는 env에서 읽는다. 실패는 전부 `FieldCryptoError`이고 `code`로
 * 갈린다(`malformed` / `unsupported_version` / `key_mismatch` / `auth_failed` /
 * 키 쪽 `missing_key`·`invalid_key`).
 */
export const decryptField = (stored: string): string => {
  // 형식부터 본다 — 키가 없는 환경에서도 "형식이 아니다"는 판정이 달라지지 않아야 한다.
  parseStored(stored);
  return decryptFieldWithKey(stored, loadKey());
};

/**
 * 이 모듈이 만든 형식으로 **보이는지**만 본다(키를 쓰지 않으므로 진짜 풀리는지는 모른다).
 * 마이그레이션·점검에서 평문이 섞여 들어왔는지 훑을 때 쓴다. v1·v2 둘 다 참이다.
 */
export const isEncryptedField = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') return false;
  try {
    parseStored(value);
    return true;
  } catch {
    return false;
  }
};
