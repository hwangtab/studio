import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'http';

/**
 * 의뢰인 진행 페이지의 접근 쿠키.
 *
 * 진행 페이지에는 발매 전 음원 링크와 승인·수정 요청 버튼이 있다. 링크(토큰)만으로 열면 메일을 전달받은 사람도
 * 승인을 누를 수 있다 — 승인은 잔금 기한을 여는 행위다. 그래서 서명·계약서 받기와 같이 연락처 뒷자리를 한 번
 * 확인하고, 확인했다는 사실을 30일짜리 httpOnly 쿠키로 들고 다닌다.
 *
 * 쿠키 값은 HMAC(계약 id + 의뢰인 토큰)이라 저장할 것이 없다. 재발송으로 토큰이 바뀌면 옛 쿠키는 저절로 무효다.
 * 키는 ADMIN_SESSION_SECRET에서 용도 문자열로 갈라 쓴다(같은 값을 다른 용도에 그대로 쓰지 않게) — 키가 없으면
 * 진행 페이지를 열지 않는다(조용히 약한 쿠키로 떨어지지 않게).
 */
const COOKIE_PREFIX = 'nol_pc_';
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const PURPOSE = 'production-progress-portal:v1';

const secret = (): string | null => {
  const base = process.env.ADMIN_SESSION_SECRET;
  return base && base.length >= 32 ? base : null;
};

const cookieName = (contractId: string) => `${COOKIE_PREFIX}${contractId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

const sign = (contractId: string, token: string): string | null => {
  const key = secret();
  if (!key) return null;
  return createHmac('sha256', key).update(`${PURPOSE}:${contractId}:${token}`).digest('hex');
};

export const isPortalConfigured = (): boolean => secret() !== null;

const readCookie = (req: IncomingMessage, name: string): string | null => {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
};

export const hasPortalAccess = (req: IncomingMessage, contractId: string, token: string): boolean => {
  const expected = sign(contractId, token);
  const given = readCookie(req, cookieName(contractId));
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

export const grantPortalAccess = (res: ServerResponse, contractId: string, token: string): boolean => {
  const value = sign(contractId, token);
  if (!value) return false;
  res.setHeader(
    'Set-Cookie',
    `${cookieName(contractId)}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );
  return true;
};
