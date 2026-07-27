import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

export interface AdminSessionData {
  isLoggedIn?: boolean;
}

const sessionOptions: SessionOptions = {
  cookieName: 'admin_session',
  // ADMIN_PASSWORD로 폴백하지 않는다 — 로그인 비밀번호를 쿠키 서명 키로 재사용하면
  // 쿠키 해석이 가능한 쪽에 비밀번호 자체가 노출될 위험이 생긴다.
  password: process.env.ADMIN_SESSION_SECRET || '',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

const validatePassword = (): void => {
  const password = sessionOptions.password;
  if (!password || typeof password !== 'string' || password.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be set to a random string of at least 32 characters.',
    );
  }
};

export const getAdminSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<IronSession<AdminSessionData>> => {
  validatePassword();
  return getIronSession<AdminSessionData>(req, res, sessionOptions);
};

export const getAdminSessionFromContext = async (
  context: GetServerSidePropsContext,
): Promise<IronSession<AdminSessionData>> => {
  validatePassword();
  return getIronSession<AdminSessionData>(
    context.req,
    context.res,
    sessionOptions,
  );
};

export const isAdminSessionValid = (session: IronSession<AdminSessionData>): boolean => {
  return Boolean(session.isLoggedIn);
};
