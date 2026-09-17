import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

export interface CreatorSessionData {
  creatorId?: string;
}

const SESSION_DAYS = 7;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

const sessionOptions: SessionOptions = {
  // 관리자와 다른 쿠키·다른 비밀을 쓴다. 하나가 새도 다른 하나가 열리지 않아야 한다.
  cookieName: 'creator_session',
  password: process.env.CREATOR_SESSION_SECRET || '',
  ttl: SESSION_SECONDS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    /**
     * 관리자는 strict인데 여기는 lax다. 로그인이 **메일의 링크를 눌러** 들어오는 경로라,
     * strict면 그 첫 이동에 쿠키가 실리지 않아 로그인 직후 다시 로그아웃 상태가 된다.
     * lax는 GET 이동에만 쿠키를 허용하므로 폼 제출(POST)을 노린 교차 사이트 요청은 여전히 막힌다.
     */
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  },
};

const validateSecret = (): void => {
  const password = sessionOptions.password;
  if (!password || typeof password !== 'string' || password.length < 32) {
    throw new Error('CREATOR_SESSION_SECRET must be set to a random string of at least 32 characters.');
  }
};

export const getCreatorSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<IronSession<CreatorSessionData>> => {
  validateSecret();
  return getIronSession<CreatorSessionData>(req, res, sessionOptions);
};

export const getCreatorSessionFromContext = async (
  context: GetServerSidePropsContext,
): Promise<IronSession<CreatorSessionData>> => {
  validateSecret();
  return getIronSession<CreatorSessionData>(
    context.req,
    context.res,
    sessionOptions,
  );
};
