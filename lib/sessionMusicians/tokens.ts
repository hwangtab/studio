import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * 세션 연주자 등록의 비밀값 두 가지 — 관리 링크 토큰과 중복 판정용 이메일 해시.
 *
 * - **관리 토큰**: 무작위 32바이트(base64url 43자). DB에는 sha256만 둔다. 원문은 접수 메일에만 있다 —
 *   `orders.manage_token`은 원문을 저장하지만 따라 하지 않는다(DB·백업에서 새면 곧 그 사람의 수정·삭제 권한이다).
 *   토큰이 256비트라 해시에 솔트·느린 해시가 필요 없다.
 * - **이메일 해시**: 소문자·공백 정규화한 주소의 HMAC-SHA256. 평문 이메일을 검색 키로 두지 않으려는 것이고
 *   (평문은 `private_enc` 안에만 있다), 같은 주소의 중복 등록을 가린다. 키는 `ADMIN_SESSION_SECRET`에서 용도 문자열로
 *   갈라 쓴다(같은 값을 다른 용도에 그대로 쓰지 않게). **이 비밀이 바뀌면 옛 해시와 새 해시가 달라져** 이미 등록한 사람의
 *   중복이 한동안 가려지지 않는다(행이 둘 생길 뿐 데이터는 안 잃는다). `FUNDING_FIELD_KEY`를 쓰지 않은 이유: 그 키는 회전 대상이라
 *   회전 때마다 해시가 전부 달라진다.
 */

const EMAIL_HASH_PURPOSE = 'session-musician-email:v1';

export class SessionMusicianConfigError extends Error {
  constructor() {
    super('ADMIN_SESSION_SECRET이 없거나 32자 미만이라 세션 연주자 등록의 이메일 해시를 만들 수 없습니다.');
    this.name = 'SessionMusicianConfigError';
  }
}

const emailHashKey = (): Buffer => {
  const base = process.env.ADMIN_SESSION_SECRET;
  if (!base || base.length < 32) throw new SessionMusicianConfigError();
  return createHmac('sha256', base).update(EMAIL_HASH_PURPOSE).digest();
};

/** `email`은 `normalizeSessionEmail`을 거친 값이어야 한다. */
export const hashSessionEmail = (email: string): string =>
  createHmac('sha256', emailHashKey()).update(email).digest('hex');

export const generateManageToken = (): string => randomBytes(32).toString('base64url');

export const hashManageToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

/** 형식만 본다 — DB를 두드리기 전에 쓰레기 값을 거른다. */
export const isWellFormedManageToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
