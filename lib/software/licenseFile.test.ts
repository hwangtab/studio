import { generateKeyPairSync } from 'crypto';

import { loadLicenseSigner, rawPublicKeyOf, signLicense, verifyLicenseFile, type LicensePayload } from './licenseFile';

const { privateKey } = generateKeyPairSync('ed25519');
const signer = { kid: 'k-test', key: privateKey };
const publicKeys = { 'k-test': rawPublicKeyOf(privateKey) };
const payload: LicensePayload = {
  lic: '00000000-0000-0000-0000-000000000001',
  product: 'test-plugin',
  machine: 'a'.repeat(64),
  edition: 'full',
  issuedAt: '2026-10-14T00:00:00.000Z',
  keyHint: 'HC3WN',
};

describe('라이선스 파일 서명', () => {
  it('서명 → 검증 왕복', () => {
    const file = signLicense(payload, signer);
    expect(file).toMatchObject({ v: 1, kid: 'k-test' });
    expect(verifyLicenseFile(file, publicKeys)).toEqual(payload);
    expect(verifyLicenseFile(JSON.stringify(file), publicKeys)).toEqual(payload);
  });

  it('공개키는 raw 32바이트(base64 44자)', () => {
    expect(Buffer.from(publicKeys['k-test'], 'base64')).toHaveLength(32);
  });

  it('payload를 한 글자만 바꿔도 거부한다', () => {
    const file = signLicense(payload, signer);
    const tampered = Buffer.from(JSON.stringify({ ...payload, machine: 'b'.repeat(64) }), 'utf8').toString('base64url');
    expect(verifyLicenseFile({ ...file, payload: tampered }, publicKeys)).toBeNull();
  });

  it('모르는 kid·다른 키·형식 오류는 거부', () => {
    const file = signLicense(payload, signer);
    expect(verifyLicenseFile({ ...file, kid: 'k-other' }, publicKeys)).toBeNull();
    const other = generateKeyPairSync('ed25519').privateKey;
    expect(verifyLicenseFile(file, { 'k-test': rawPublicKeyOf(other) })).toBeNull();
    expect(verifyLicenseFile({ ...file, v: 2 }, publicKeys)).toBeNull();
    expect(verifyLicenseFile('not json', publicKeys)).toBeNull();
    expect(verifyLicenseFile(null, publicKeys)).toBeNull();
  });
});

describe('loadLicenseSigner', () => {
  const der = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

  it('base64 DER와 PEM(줄바꿈이 \\n 글자로 들어온 env 포함)을 읽는다', () => {
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: der, SOFTWARE_LICENSE_KEY_ID: 'k1' })?.kid).toBe('k1');
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: pem, SOFTWARE_LICENSE_KEY_ID: 'k1' })).not.toBeNull();
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: pem.replace(/\n/g, '\\n'), SOFTWARE_LICENSE_KEY_ID: 'k1' })).not.toBeNull();
  });

  it('값이 없거나 Ed25519가 아니면 null — 다른 키로 대신하지 않는다', () => {
    expect(loadLicenseSigner({})).toBeNull();
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: der })).toBeNull();
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: 'garbage', SOFTWARE_LICENSE_KEY_ID: 'k1' })).toBeNull();
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(loadLicenseSigner({ SOFTWARE_LICENSE_SIGNING_KEY: rsa, SOFTWARE_LICENSE_KEY_ID: 'k1' })).toBeNull();
  });
});
