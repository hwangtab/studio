import type { IronSession } from 'iron-session';
import { eq } from 'drizzle-orm';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../db/client';
import { fundingCreators } from '../../db/schema';
import {
  getCreatorSession, getCreatorSessionFromContext, type CreatorSessionData,
} from './creatorSession';

export const readCreatorId = (session: IronSession<CreatorSessionData>): string | null =>
  typeof session.creatorId === 'string' && session.creatorId !== '' ? session.creatorId : null;

/**
 * 쿠키 안의 판본. 순수 함수라 DB를 보지 않는다 — 대조는 `verifyCreatorSessionVersion`이 한다.
 * 정수가 아니면 null이고, null은 무효다(위 `CreatorSessionData.sessionVersion` 주석).
 */
export const readCreatorSessionVersion = (session: IronSession<CreatorSessionData>): number | null =>
  typeof session.sessionVersion === 'number' && Number.isInteger(session.sessionVersion)
    ? session.sessionVersion
    : null;

/**
 * 쿠키 판본과 DB 판본을 대조한다. 행이 없으면(삭제된 개설자) 실패.
 *
 * DB를 읽지 못하면 실패로 본다 — 세션 검사가 조회 실패에 열리면 검사를 안 하는 것과 같다.
 */
export const verifyCreatorSessionVersion = async (
  creatorId: string,
  cookieVersion: number,
): Promise<boolean> => {
  try {
    const db = getDb();
    const [row] = await db.select({ sessionVersion: fundingCreators.sessionVersion })
      .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
    return !!row && row.sessionVersion === cookieVersion;
  } catch (error) {
    console.error('[funding] 개설자 세션 판본 대조 실패', error);
    return false;
  }
};

export type CreatorAuth = { ok: true; creatorId: string } | { ok: false };

const authenticate = async (session: IronSession<CreatorSessionData>): Promise<CreatorAuth> => {
  const creatorId = readCreatorId(session);
  const cookieVersion = readCreatorSessionVersion(session);
  if (!creatorId || cookieVersion === null) return { ok: false };
  if (!await verifyCreatorSessionVersion(creatorId, cookieVersion)) return { ok: false };
  return { ok: true, creatorId };
};

export const authenticateCreatorApi = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<CreatorAuth> => authenticate(await getCreatorSession(req, res));

export const authenticateCreatorRequest = async (
  context: GetServerSidePropsContext,
): Promise<CreatorAuth> => authenticate(await getCreatorSessionFromContext(context));

/**
 * 발급 시점의 DB 판본을 쿠키에 싣는다. 읽지 못하면 로그인시키지 않는다 — 판본 없는 쿠키는
 * 어차피 무효이므로, 조용히 발급하면 "로그인은 됐는데 모든 요청이 401"인 상태가 된다.
 */
const readSessionVersion = async (creatorId: string): Promise<number | null> => {
  const db = getDb();
  const [row] = await db.select({ sessionVersion: fundingCreators.sessionVersion })
    .from(fundingCreators).where(eq(fundingCreators.id, creatorId)).limit(1);
  return row ? row.sessionVersion : null;
};

export const loginCreatorSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
  creatorId: string,
): Promise<void> => {
  const sessionVersion = await readSessionVersion(creatorId);
  if (sessionVersion === null) throw new Error(`개설자 행을 찾지 못해 세션을 발급할 수 없다: ${creatorId}`);
  const session = await getCreatorSession(req, res);
  session.creatorId = creatorId;
  session.sessionVersion = sessionVersion;
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
  const sessionVersion = await readSessionVersion(creatorId);
  if (sessionVersion === null) throw new Error(`개설자 행을 찾지 못해 세션을 발급할 수 없다: ${creatorId}`);
  const session = await getCreatorSessionFromContext(context);
  session.creatorId = creatorId;
  session.sessionVersion = sessionVersion;
  await session.save();
};

export const logoutCreatorSession = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  const session = await getCreatorSession(req, res);
  session.destroy();
};
