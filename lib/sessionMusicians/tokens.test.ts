/** @jest-environment node */
import { generateManageToken, hashManageToken, hashSessionEmail, isWellFormedManageToken, SessionMusicianConfigError } from './tokens';

describe('관리 토큰', () => {
  it('소문자 hex 64자(256비트)이고 매번 다르다 — 경로에 실려도 미들웨어의 소문자 308에 바뀌지 않는다', () => {
    const a = generateManageToken();
    const b = generateManageToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(a).toBe(a.toLowerCase());
    expect(isWellFormedManageToken(a)).toBe(true);
  });

  it('형식이 아닌 값은 DB에 가기 전에 거른다', () => {
    for (const bad of [undefined, null, '', 'abc', 'A'.repeat(64), 'g'.repeat(64), `${'a'.repeat(63)}`, 12345]) {
      expect(isWellFormedManageToken(bad)).toBe(false);
    }
  });

  it('해시는 결정적이고 원문과 다르다', () => {
    const token = generateManageToken();
    expect(hashManageToken(token)).toBe(hashManageToken(token));
    expect(hashManageToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashManageToken(token)).not.toBe(token);
  });
});

describe('이메일 해시', () => {
  const original = process.env.ADMIN_SESSION_SECRET;
  afterEach(() => {
    process.env.ADMIN_SESSION_SECRET = original;
  });

  it('같은 비밀·같은 이메일이면 같고, 비밀이 다르면 다르며, 원문 이메일을 담지 않는다', () => {
    process.env.ADMIN_SESSION_SECRET = 'x'.repeat(40);
    const a = hashSessionEmail('a@example.com');
    expect(a).toBe(hashSessionEmail('a@example.com'));
    expect(a).not.toBe(hashSessionEmail('b@example.com'));
    expect(a).not.toContain('example');
    process.env.ADMIN_SESSION_SECRET = 'y'.repeat(40);
    expect(hashSessionEmail('a@example.com')).not.toBe(a);
  });

  it('비밀이 없거나 짧으면 던진다 — 약한 해시로 조용히 떨어지지 않는다', () => {
    process.env.ADMIN_SESSION_SECRET = 'short';
    expect(() => hashSessionEmail('a@example.com')).toThrow(SessionMusicianConfigError);
    delete process.env.ADMIN_SESSION_SECRET;
    expect(() => hashSessionEmail('a@example.com')).toThrow(SessionMusicianConfigError);
  });
});
