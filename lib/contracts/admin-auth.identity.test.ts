/** @jest-environment node */

/**
 * 로그인한 비밀번호가 **누구인지**를 세션과 가드가 끝까지 나르는가.
 *
 * 이 파일이 지키는 것은 접속기록의 전제다 — `privacy_access_logs.actor`가 사람을
 * 가리키려면, 맞은 비밀번호에서 시작한 식별자가 세션을 거쳐 가드의 반환까지 한 번도
 * 끊기지 않아야 한다. 중간 어디서 끊기면 조용히 `admin`으로 되돌아가고, 화면은 멀쩡하다.
 */

import type { IronSession } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('./admin-session', () => {
  const actual = jest.requireActual('./admin-session');
  return { ...actual, getAdminSession: jest.fn(), getAdminSessionFromContext: jest.fn() };
});

const PW_KYUNGHA = 'kyungha-password-1';
const PW_JINA = 'jina-password-22';

process.env.ADMIN_ACCOUNTS = JSON.stringify([
  { id: 'kyungha', name: '황경하', password: PW_KYUNGHA },
  { id: 'jina', name: '지나', password: PW_JINA },
]);

import {
  adminSessionIdentity,
  getAdminSession,
  getAdminSessionFromContext,
  type AdminSessionData,
} from './admin-session';

/**
 * `admin-auth`는 기동 시점에 `ADMIN_ACCOUNTS`를 읽으므로 **env를 세운 뒤에 불러와야 한다.**
 * import 선언은 위로 끌어올려지니 여기서만 require를 쓴다.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const adminAuth = require('./admin-auth') as typeof import('./admin-auth');
/* eslint-enable @typescript-eslint/no-require-imports */
const { authenticateAdminApi, authenticateAdminRequest, loginAdminSession, matchAdminAccount } =
  adminAuth;

afterAll(() => {
  delete process.env.ADMIN_ACCOUNTS;
});

type FakeSession = AdminSessionData & { save: jest.Mock; destroy: jest.Mock };

const makeSession = (data: AdminSessionData = {}): FakeSession => ({
  ...data,
  save: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn(),
});

const asIron = (session: FakeSession) => session as unknown as IronSession<AdminSessionData>;

const login = async (password: string) => {
  const session = makeSession();
  (getAdminSession as jest.Mock).mockResolvedValue(session);
  const result = await loginAdminSession(
    { headers: { 'x-admin-password': password } } as unknown as NextApiRequest,
    {} as NextApiResponse,
  );
  return { result, session };
};

beforeEach(() => jest.clearAllMocks());

describe('비밀번호가 곧 신원이다', () => {
  it('계정마다 다른 비밀번호가 각자를 식별한다', async () => {
    const a = await login(PW_KYUNGHA);
    expect(a.result).toEqual({ ok: true, actor: 'kyungha', name: '황경하' });
    expect(a.session.adminId).toBe('kyungha');
    expect(a.session.adminName).toBe('황경하');

    const b = await login(PW_JINA);
    expect(b.result).toEqual({ ok: true, actor: 'jina', name: '지나' });
    expect(b.session.adminId).toBe('jina');
  });

  it('틀린 비밀번호는 세션을 만들지 않고 실패만 돌려준다 — 어느 계정이 있는지 새지 않는다', async () => {
    const { result, session } = await login('완전히-틀린-비밀번호');
    expect(result).toEqual({ ok: false });
    expect(session.save).not.toHaveBeenCalled();
    expect(session.isLoggedIn).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/kyungha|jina/);
  });

  it('빈 비밀번호도 실패다', () => {
    expect(matchAdminAccount('')).toBeNull();
    expect(matchAdminAccount(undefined)).toBeNull();
  });
});

describe('세션이 신원을 나른다', () => {
  it('API 가드가 세션의 사람을 그대로 돌려준다', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue(
      asIron(makeSession({ isLoggedIn: true, adminId: 'jina', adminName: '지나' })),
    );
    await expect(authenticateAdminApi({} as NextApiRequest, {} as NextApiResponse)).resolves.toEqual({
      ok: true,
      actor: 'jina',
      name: '지나',
    });
  });

  it('GSSP 가드도 같은 값을 돌려준다', async () => {
    (getAdminSessionFromContext as jest.Mock).mockResolvedValue(
      asIron(makeSession({ isLoggedIn: true, adminId: 'kyungha', adminName: '황경하' })),
    );
    await expect(
      authenticateAdminRequest({} as Parameters<typeof authenticateAdminRequest>[0]),
    ).resolves.toEqual({ ok: true, actor: 'kyungha', name: '황경하' });
  });

  it('로그인하지 않은 세션은 실패다', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue(asIron(makeSession()));
    await expect(authenticateAdminApi({} as NextApiRequest, {} as NextApiResponse)).resolves.toEqual({
      ok: false,
    });
  });
});

describe('옛 세션 호환', () => {
  /**
   * 계정을 나누기 전에 발급된 쿠키는 `adminId`가 없다. 배포 직후 하루 동안 살아 있으므로
   * 유효로 보되, 누구인지 모르는 것이 사실이라 actor는 `admin`이다.
   */
  it('adminId 없는 세션은 유효하고 actor는 admin이다', async () => {
    (getAdminSession as jest.Mock).mockResolvedValue(asIron(makeSession({ isLoggedIn: true })));
    await expect(authenticateAdminApi({} as NextApiRequest, {} as NextApiResponse)).resolves.toEqual({
      ok: true,
      actor: 'admin',
      name: '관리자',
    });
  });

  it('판정은 adminSessionIdentity 한 곳에 있다', () => {
    expect(adminSessionIdentity(asIron(makeSession({ isLoggedIn: true })))).toEqual({
      actor: 'admin',
      name: '관리자',
    });
    expect(adminSessionIdentity(asIron(makeSession()))).toBeNull();
  });
});
