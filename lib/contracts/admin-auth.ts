import { createHash, timingSafeEqual } from 'crypto';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { getAdminSession, getAdminSessionFromContext, isAdminSessionValid } from './admin-session';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * 관리자 비밀번호의 최소 길이.
 *
 * 이 값 하나가 모든 계약의 개인정보를 지키는 유일한 자물쇠이므로 짧은 값을 허용하지 않는다.
 * 대소문자·숫자·기호를 섞은 13자는 조합이 10^23을 넘고, 로그인은 10분에 10회로 제한되므로
 * 무작위 대입으로는 사실상 뚫리지 않는다. 실제 위험은 길이가 아니라 짐작 가능한 값
 * (사이트명, 연도, 흔한 단어)이며 그것은 길이로 막을 수 없다.
 */
const MIN_PASSWORD_LENGTH = 13;

/**
 * 길이가 달라도 상수 시간에 비교하기 위해 양쪽을 SHA-256으로 고정 길이화한 뒤
 * timingSafeEqual로 맞춘다(문자 단위 루프는 길이 차이가 실행 시간에 드러난다).
 */
export const isAdminPasswordValid = (password: string | string[] | undefined): boolean => {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[admin-auth] ADMIN_PASSWORD가 설정되지 않았거나 ${MIN_PASSWORD_LENGTH}자 미만입니다.`,
    );
    return false;
  }
  if (typeof password !== 'string' || password === '') {
    return false;
  }

  const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(ADMIN_PASSWORD), digest(password));
};

export const authenticateAdminRequest = async (
  context: GetServerSidePropsContext,
): Promise<{ ok: true } | { ok: false }> => {
  const session = await getAdminSessionFromContext(context);
  if (isAdminSessionValid(session)) {
    return { ok: true };
  }
  return { ok: false };
};

export const authenticateAdminApi = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ ok: true } | { ok: false }> => {
  const session = await getAdminSession(req, res);
  if (isAdminSessionValid(session)) {
    return { ok: true };
  }
  return { ok: false };
};

export const loginAdminSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ ok: true } | { ok: false }> => {
  const password = req.headers['x-admin-password'];
  if (!isAdminPasswordValid(password)) {
    return { ok: false };
  }

  const session = await getAdminSession(req, res);
  session.isLoggedIn = true;
  await session.save();
  return { ok: true };
};

export const logoutAdminSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> => {
  const session = await getAdminSession(req, res);
  session.destroy();
};
