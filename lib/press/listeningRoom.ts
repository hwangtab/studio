/**
 * 비공개 감상실(평론가·매체용 발매 전 음원 페이지)의 입장 판정.
 *
 * 비밀번호 하나로 들어오는 방이다 — 계정이 없다. 통과하면 HttpOnly 쿠키를 세우고, 페이지
 * (getServerSideProps)와 음원 주소 API가 그 쿠키만 본다. 쿠키가 없으면 **본문도 음원 주소도
 * HTML에 싣지 않는다** — 비밀번호 화면은 클라이언트에서 가리는 것이 아니라 서버가 고른다.
 *
 * 저장소가 공개라 비밀번호 원문은 두지 않고 scrypt 해시만 둔다. 비밀번호를 바꾸려면
 * `node scripts/press/hash-password.mjs '<새 비밀번호>'`의 출력으로 아래 값을 갈아 끼운다.
 * 해시가 바뀌면 쿠키 서명에 들어간 값도 바뀌어 **이미 들어와 있던 사람도 다시 입력해야 한다**
 * (비밀번호가 샌 것 같을 때 바꾸는 이유가 그것이다).
 *
 * 쿠키 서명 키는 ADMIN_SESSION_SECRET에서 용도 문자열로 갈라 낸다(HMAC 도메인 분리) —
 * 같은 키를 그대로 쓰면 관리자 세션과 서명이 섞일 수 있다. 운영에서 그 값이 없으면 문을 닫는다.
 */
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export interface ListeningRoom {
  /** 쿠키 이름·서명 도메인에 들어간다. 바꾸면 기존 입장이 모두 풀린다. */
  id: string;
  passwordSalt: string;
  passwordHash: string;
}

export const LISTENING_ROOMS = {
  'sabbaha-slung': {
    id: 'sabbaha-slung',
    passwordSalt: 'JiaGL6y9GXmDt5eGvi2NlQ',
    passwordHash: 'zyOlm-D6sJhN72QE6gUeDuf6KG88IMDf4O0gGNmxHvU',
  },
} as const satisfies Record<string, ListeningRoom>;

export type ListeningRoomId = keyof typeof LISTENING_ROOMS;

/** 한 번 들어오면 30일. 매체에 링크를 보낸 뒤 기사를 쓰기까지 몇 주가 걸린다. */
export const ROOM_SESSION_SECONDS = 30 * 24 * 60 * 60;

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export const hashRoomPassword = (password: string, salt: string): string =>
  scryptSync(password.normalize('NFC'), salt, 32, SCRYPT_PARAMS).toString('base64url');

/** 길이 차이가 시간에 드러나지 않게 양쪽을 고정 길이로 만든 뒤 비교한다(lib/booking/token.ts와 같다). */
const safeEqual = (a: string, b: string): boolean =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export const isRoomPasswordMatch = (room: ListeningRoom, password: string): boolean => {
  // 붙여 넣다 딸려 온 앞뒤 공백은 지운다. 가운데 공백은 비밀번호의 일부로 본다.
  const given = password.trim();
  if (!given || given.length > 200) return false;
  return safeEqual(hashRoomPassword(given, room.passwordSalt), room.passwordHash);
};

export const roomCookieName = (room: ListeningRoom): string => `press_room_${room.id.replace(/[^a-z0-9]/g, '_')}`;

const signingKey = (): Buffer => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return createHmac('sha256', secret).update('press-listening-room:v1').digest();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET이 없어 감상실 입장 쿠키를 서명할 수 없습니다.');
  }
  // 로컬 개발 전용. 운영에서는 위에서 던진다.
  return createHash('sha256').update('press-listening-room:dev').digest();
};

const signature = (room: ListeningRoom, expiresAt: number): string =>
  createHmac('sha256', signingKey()).update(`${room.id}|${expiresAt}|${room.passwordHash}`).digest('base64url');

/** `<만료 unix초>.<서명>` */
export const issueRoomToken = (room: ListeningRoom, now = Date.now()): string => {
  const expiresAt = Math.floor(now / 1000) + ROOM_SESSION_SECONDS;
  return `${expiresAt}.${signature(room, expiresAt)}`;
};

export const isRoomTokenValid = (room: ListeningRoom, token: string | undefined, now = Date.now()): boolean => {
  if (!token) return false;
  const match = /^(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt * 1000 <= now) return false;
  try {
    return safeEqual(match[2], signature(room, expiresAt));
  } catch {
    return false;
  }
};

export const buildRoomCookie = (room: ListeningRoom, token: string): string =>
  [
    `${roomCookieName(room)}=${token}`,
    'Path=/',
    `Max-Age=${ROOM_SESSION_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join('; ');
