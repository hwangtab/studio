import {
  LISTENING_ROOMS,
  buildRoomCookie,
  hashRoomPassword,
  isRoomPasswordMatch,
  isRoomTokenValid,
  issueRoomToken,
  roomCookieName,
} from './listeningRoom';

const room = LISTENING_ROOMS['sabbaha-slung'];

describe('감상실 비밀번호', () => {
  it('저장소에는 원문이 아니라 해시만 있다', () => {
    expect(JSON.stringify(LISTENING_ROOMS)).not.toMatch(/tkqk/);
  });

  it('맞는 비밀번호는 통과하고, 붙여 넣다 딸려 온 앞뒤 공백은 무시한다', () => {
    expect(isRoomPasswordMatch(room, 'tkqkgkajtwu666')).toBe(true);
    expect(isRoomPasswordMatch(room, '  tkqkgkajtwu666\n')).toBe(true);
  });

  it('틀린 값·빈 값·지나치게 긴 값은 거절한다', () => {
    expect(isRoomPasswordMatch(room, 'tkqkgkajtwu665')).toBe(false);
    expect(isRoomPasswordMatch(room, '')).toBe(false);
    expect(isRoomPasswordMatch(room, 'x'.repeat(500))).toBe(false);
  });

  it('해시 함수가 저장된 해시를 재현한다(파라미터가 스크립트와 같아야 한다)', () => {
    expect(hashRoomPassword('tkqkgkajtwu666', room.passwordSalt)).toBe(room.passwordHash);
  });
});

describe('감상실 입장 쿠키', () => {
  const now = Date.UTC(2026, 9, 6);

  it('발급한 토큰은 30일 동안 유효하다', () => {
    const token = issueRoomToken(room, now);
    expect(isRoomTokenValid(room, token, now)).toBe(true);
    expect(isRoomTokenValid(room, token, now + 29 * 86400_000)).toBe(true);
    expect(isRoomTokenValid(room, token, now + 31 * 86400_000)).toBe(false);
  });

  it('만료 시각을 늘려 고친 토큰은 서명이 맞지 않는다', () => {
    const [exp, sig] = issueRoomToken(room, now).split('.');
    expect(isRoomTokenValid(room, `${Number(exp) + 86400 * 365}.${sig}`, now)).toBe(false);
  });

  it('비밀번호(해시)를 바꾸면 이미 받은 쿠키도 풀린다', () => {
    const token = issueRoomToken(room, now);
    const rotated = { ...room, passwordHash: hashRoomPassword('new-password', room.passwordSalt) };
    expect(isRoomTokenValid(rotated, token, now)).toBe(false);
  });

  it('형식이 어긋난 값은 거절한다', () => {
    expect(isRoomTokenValid(room, undefined, now)).toBe(false);
    expect(isRoomTokenValid(room, 'garbage', now)).toBe(false);
    expect(isRoomTokenValid(room, '1.2.3', now)).toBe(false);
  });

  it('쿠키는 HttpOnly·SameSite=Lax로 나간다', () => {
    const cookie = buildRoomCookie(room, issueRoomToken(room, now));
    expect(cookie.startsWith(`${roomCookieName(room)}=`)).toBe(true);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});
