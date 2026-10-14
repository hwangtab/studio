import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'crypto';

/**
 * 서명 라이선스 파일(Ed25519). 형식의 정본은 `docs/software/license-integration.md` — 플러그인·앱이 이 형식을
 * 오프라인으로 검증하므로, **한 번 배포한 뒤에는 바꾸지 않는다**(바꾸려면 `v`를 올리고 옛 형식도 계속 받는다).
 *
 * 서명 대상은 payload의 **원래 바이트**다. JSON을 다시 직렬화해 검증하면 공백·순서 차이로 깨지므로, 파일에는
 * payload를 base64url 그대로 싣는다.
 */

export const LICENSE_FILE_VERSION = 1;

export interface LicensePayload {
  lic: string;
  product: string;
  machine: string;
  edition: 'full';
  issuedAt: string;
  keyHint: string;
}

export interface LicenseFile {
  v: typeof LICENSE_FILE_VERSION;
  kid: string;
  payload: string;
  sig: string;
}

export interface LicenseSigner {
  kid: string;
  key: KeyObject;
}

/** Ed25519 공개키 raw 32바이트 → SPKI DER 머리. */
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * env에서 서명키를 읽는다. `SOFTWARE_LICENSE_SIGNING_KEY`는 PKCS8 PEM 또는 그 DER의 base64,
 * `SOFTWARE_LICENSE_KEY_ID`는 `data/software/publicKeys.ts`의 kid. 둘 중 하나라도 없거나 Ed25519가 아니면 null —
 * 호출부(활성화 API)는 503으로 닫는다. 다른 키로 조용히 대신하지 않는다.
 */
export const loadLicenseSigner = (env: Readonly<Record<string, string | undefined>> = process.env): LicenseSigner | null => {
  const raw = env.SOFTWARE_LICENSE_SIGNING_KEY?.trim();
  const kid = env.SOFTWARE_LICENSE_KEY_ID?.trim();
  if (!raw || !kid) return null;
  try {
    const key = raw.includes('BEGIN')
      ? createPrivateKey(raw.replace(/\\n/g, '\n'))
      : createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' });
    if (key.asymmetricKeyType !== 'ed25519') return null;
    return { kid, key };
  } catch {
    return null;
  }
};

export const signLicense = (payload: LicensePayload, signer: LicenseSigner): LicenseFile => {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  return {
    v: LICENSE_FILE_VERSION,
    kid: signer.kid,
    payload: bytes.toString('base64url'),
    sig: sign(null, bytes, signer.key).toString('base64url'),
  };
};

const publicKeyFromRaw = (base64Raw: string): KeyObject =>
  createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(base64Raw, 'base64')]), format: 'der', type: 'spki' });

/**
 * 플러그인이 하는 검증과 같은 일을 서버에서 — 테스트와 운영자 점검용. 서명이 맞으면 payload, 아니면 null.
 * 기기·상품 대조는 호출부가 한다.
 */
export const verifyLicenseFile = (file: unknown, publicKeys: Readonly<Record<string, string>>): LicensePayload | null => {
  try {
    const f = (typeof file === 'string' ? JSON.parse(file) : file) as Partial<LicenseFile> | null;
    if (!f || f.v !== LICENSE_FILE_VERSION || typeof f.kid !== 'string' || typeof f.payload !== 'string' || typeof f.sig !== 'string') return null;
    const pub = publicKeys[f.kid];
    if (!pub) return null;
    const bytes = Buffer.from(f.payload, 'base64url');
    if (!verify(null, bytes, publicKeyFromRaw(pub), Buffer.from(f.sig, 'base64url'))) return null;
    const p = JSON.parse(bytes.toString('utf8')) as LicensePayload;
    return p.edition === 'full' ? p : null;
  } catch {
    return null;
  }
};

/** 서명키에서 공개키 raw 32바이트(base64) — 키 생성 스크립트·테스트가 쓴다. */
export const rawPublicKeyOf = (key: KeyObject): string => {
  const der = createPublicKey(key).export({ format: 'der', type: 'spki' });
  return der.subarray(SPKI_PREFIX.length).toString('base64');
};
