import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { ADMIN_FALLBACK_ID, ADMIN_FALLBACK_NAME } from './admin-accounts';

export interface AdminSessionData {
  isLoggedIn?: boolean;
  /** 로그인에 쓰인 계정의 id. 접속기록의 actor가 되는 값이다. */
  adminId?: string;
  /** 화면 상단에 띄우는 표시 이름. 기록에는 담지 않는다. */
  adminName?: string;
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

export interface AdminIdentity {
  /** 접속기록에 남길 값. */
  actor: string;
  /** 화면에 띄울 이름. */
  name: string;
}

/**
 * 이 세션이 가리키는 사람. 로그인하지 않았으면 null.
 *
 * **옛 세션 호환이 여기 한 곳에 있다.** 계정을 사람별로 나누기 전에 발급된 쿠키는
 * `isLoggedIn`만 있고 `adminId`가 없다. 봉인 유효기간이 24시간이라 배포 직후 하루 동안은
 * 그런 쿠키를 든 사람들이 돌아다니는데, 그들을 로그아웃시키면 배포가 곧 전원 재로그인이
 * 된다. 그래서 유효로 보되 **수행자는 `admin`으로 적는다** — 누구인지 모르는 것이 사실이고,
 * 모르는 것을 지어내지 않는다. 하루가 지나면 이 갈래로 오는 세션은 사라진다.
 *
 * `ADMIN_ACCOUNTS`를 설정하지 않은 배포의 세션도 같은 값으로 떨어진다(그쪽은 로그인
 * 시점에 id `admin`이 실제로 담긴다).
 */
export const adminSessionIdentity = (
  session: IronSession<AdminSessionData>,
): AdminIdentity | null => {
  if (!isAdminSessionValid(session)) return null;
  return {
    actor: session.adminId || ADMIN_FALLBACK_ID,
    name: session.adminName || ADMIN_FALLBACK_NAME,
  };
};
