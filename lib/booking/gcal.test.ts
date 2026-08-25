import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildServiceAccountJwt } from './gcal';

describe('buildServiceAccountJwt', () => {
  it('RS256 서명이 검증되고 클레임이 올바르다', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GOOGLE_SA_EMAIL = 'bot@project.iam.gserviceaccount.com';
    process.env.GOOGLE_SA_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const jwt = buildServiceAccountJwt(new Date('2026-09-01T00:00:00Z'));
    const [h, p, s] = jwt.split('.');
    const verify = createVerify('RSA-SHA256').update(`${h}.${p}`);
    expect(verify.verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true);

    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(claims.iss).toBe('bot@project.iam.gserviceaccount.com');
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.exp - claims.iat).toBe(3600);
  });
});
