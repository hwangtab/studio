import { createHash, timingSafeEqual } from 'crypto';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

import {
  resolveAdminAccounts,
  type AdminAccount,
} from './admin-accounts';
import {
  adminSessionIdentity,
  getAdminSession,
  getAdminSessionFromContext,
  type AdminIdentity,
} from './admin-session';

/**
 * 기동 시점에 한 번 읽는다 — 설정이 잘못됐으면 여기서 던진다.
 *
 * 로그인이 조용히 실패하게 두면 운영자는 자기 비밀번호를 의심하고, 두 사람이 같은
 * 비밀번호를 쓰는 상태로 계속 돌면 접속기록이 엉뚱한 사람을 가리킨다. 자세한 규칙은
 * `admin-accounts.ts`에 있다.
 */
const ADMIN_ACCOUNTS: readonly AdminAccount[] = resolveAdminAccounts();

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/**
 * 맞은 비밀번호의 주인을 찾는다. 없으면 null.
 *
 * **일찍 빠져나가지 않는다.** 첫 일치에서 멈추면 목록 앞쪽 계정과 뒤쪽 계정의 응답 시간이
 * 갈려, 어느 계정이 존재하는지가 시간으로 샌다. 길이가 달라도 상수 시간에 비교하기 위해
 * 양쪽을 SHA-256으로 고정 길이화한 뒤 timingSafeEqual로 맞춘다(문자 단위 루프는 길이
 * 차이가 실행 시간에 드러난다).
 */
export const matchAdminAccount = (password: string | string[] | undefined): AdminAccount | null => {
  if (ADMIN_ACCOUNTS.length === 0) return null;
  if (typeof password !== 'string' || password === '') return null;

  const given = digest(password);
  let matched: AdminAccount | null = null;
  for (const account of ADMIN_ACCOUNTS) {
    if (timingSafeEqual(digest(account.password), given)) matched = account;
  }
  return matched;
};

/** 비밀번호가 등록된 계정 중 하나와 맞는가. 누구인지까지 필요하면 matchAdminAccount를 쓴다. */
export const isAdminPasswordValid = (password: string | string[] | undefined): boolean =>
  matchAdminAccount(password) !== null;

/**
 * 인증 결과.
 *
 * 성공에 **누구인지**가 실린다 — 접속기록(`privacy_access_logs.actor`)이 이 값을 받는다.
 * 실패는 예전 그대로다(이유를 돌려주지 않는다).
 */
export type AdminAuthResult = ({ ok: true } & AdminIdentity) | { ok: false };

export const authenticateAdminRequest = async (
  context: GetServerSidePropsContext,
): Promise<AdminAuthResult> => {
  const identity = adminSessionIdentity(await getAdminSessionFromContext(context));
  return identity ? { ok: true, ...identity } : { ok: false };
};

export const authenticateAdminApi = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AdminAuthResult> => {
  const identity = adminSessionIdentity(await getAdminSession(req, res));
  return identity ? { ok: true, ...identity } : { ok: false };
};

export const loginAdminSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<AdminAuthResult> => {
  const account = matchAdminAccount(req.headers['x-admin-password']);
  if (!account) {
    return { ok: false };
  }

  const session = await getAdminSession(req, res);
  session.isLoggedIn = true;
  session.adminId = account.id;
  session.adminName = account.name;
  await session.save();
  return { ok: true, actor: account.id, name: account.name };
};

export const logoutAdminSession = async (
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> => {
  const session = await getAdminSession(req, res);
  session.destroy();
};
