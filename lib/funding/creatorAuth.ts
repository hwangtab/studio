import type { IronSession } from 'iron-session';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import {
  getCreatorSession, getCreatorSessionFromContext, type CreatorSessionData,
} from './creatorSession';

export const readCreatorId = (session: IronSession<CreatorSessionData>): string | null =>
  typeof session.creatorId === 'string' && session.creatorId !== '' ? session.creatorId : null;

export type CreatorAuth = { ok: true; creatorId: string } | { ok: false };

export const authenticateCreatorApi = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<CreatorAuth> => {
  const creatorId = readCreatorId(await getCreatorSession(req, res));
  return creatorId ? { ok: true, creatorId } : { ok: false };
};

export const authenticateCreatorRequest = async (
  context: GetServerSidePropsContext,
): Promise<CreatorAuth> => {
  const creatorId = readCreatorId(await getCreatorSessionFromContext(context));
  return creatorId ? { ok: true, creatorId } : { ok: false };
};

export const loginCreatorSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
  creatorId: string,
): Promise<void> => {
  const session = await getCreatorSession(req, res);
  session.creatorId = creatorId;
  await session.save();
};

/**
 * 매직링크 착지(getServerSideProps)용 로그인.
 *
 * API용과 따로 두는 이유: GSSP의 req/res는 NextApiRequest/Response가 아니다. 타입 단언으로
 * 때우면 다음 사람이 같은 자리에서 또 고민한다.
 */
export const loginCreatorSessionFromContext = async (
  context: GetServerSidePropsContext,
  creatorId: string,
): Promise<void> => {
  const session = await getCreatorSessionFromContext(context);
  session.creatorId = creatorId;
  await session.save();
};

export const logoutCreatorSession = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  const session = await getCreatorSession(req, res);
  session.destroy();
};
