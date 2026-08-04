import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

export interface AdminSessionData {
  isLoggedIn?: boolean;
}

const SESSION_HOURS = 24;
const SESSION_SECONDS = 60 * 60 * SESSION_HOURS;

const sessionOptions: SessionOptions = {
  cookieName: 'admin_session',
  // ADMIN_PASSWORD로 폴백하지 않는다 — 로그인 비밀번호를 쿠키 서명 키로 재사용하면
  // 쿠키 해석이 가능한 쪽에 비밀번호 자체가 노출될 위험이 생긴다.
  password: process.env.ADMIN_SESSION_SECRET || '',
  /**
   * 봉인 자체의 유효기간.
   *
   * 쿠키의 maxAge는 브라우저에게 "언제 버려라"라고 말할 뿐이고, 서버는 봉인이 유효하면
   * 그대로 받아들인다. iron-session의 기본 ttl은 14일이라, maxAge만 24시간으로 줄여 두면
   * 쿠키 값을 어딘가에 복사해 둔 쪽은 13일을 더 쓸 수 있다. 이 계정은 모든 계약의
   * 개인정보에 접근하므로 서버가 인정하는 기간을 브라우저에 말한 기간과 맞춘다.
   */
  ttl: SESSION_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_SECONDS,
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
