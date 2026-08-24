/** @jest-environment node */

/**
 * 관리자 인증 라우트.
 *
 * 이 관문 하나가 전 계약의 이름·생년월일·연락처·주소·서명 이미지를 지킨다 —
 * 통과하면 /api/contracts GET 한 번으로 전부 읽힌다. 그런데 이 경로에는 테스트가
 * 하나도 없었다. 순수 함수(isAdminPasswordValid)는 검증돼 있어도, 라우트가
 * 시도 제한을 비밀번호 검사보다 먼저 부르는지, 성공 시 누적을 지우는지,
 * 로그아웃이 배선돼 있는지는 아무도 확인하지 않았다.
 */

jest.mock('../../../lib/contracts/admin-rate-limit', () => ({
  checkAdminLoginRateLimit: jest.fn(),
  resetAdminLoginRateLimit: jest.fn(),
}));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  loginAdminSession: jest.fn(),
  logoutAdminSession: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { loginAdminSession, logoutAdminSession } from '../../../lib/contracts/admin-auth';
import {
  checkAdminLoginRateLimit,
  resetAdminLoginRateLimit,
} from '../../../lib/contracts/admin-rate-limit';
import handler from '../../../pages/api/admin/auth';

const makeRes = () => {
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as NextApiResponse & Record<string, jest.Mock>;
};

const run = async (method: string) => {
  const res = makeRes();
  await handler({ method, headers: {}, query: {} } as unknown as NextApiRequest, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  (checkAdminLoginRateLimit as jest.Mock).mockResolvedValue(true);
  (loginAdminSession as jest.Mock).mockResolvedValue({ ok: true });
  (logoutAdminSession as jest.Mock).mockResolvedValue(undefined);
});

describe('POST — 로그인', () => {
  it('비밀번호가 맞으면 200', async () => {
    const res = await run('POST');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('비밀번호가 틀리면 401', async () => {
    (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
    const res = await run('POST');
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('실패 응답이 왜 틀렸는지 알려 주지 않는다', async () => {
    (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
    const res = await run('POST');

    const body = JSON.stringify((res.json as jest.Mock).mock.calls[0][0]);
    expect(body).not.toContain('ADMIN_PASSWORD');
    expect(body).not.toMatch(/length|길이|자리/);
  });

  /**
   * 순서가 핵심이다. 비밀번호 검사를 먼저 하면 실패한 시도가 계수되지 않아
   * 무차별 대입을 못 막는다.
   */
  it('비밀번호를 대조하기 전에 시도 제한을 먼저 본다', async () => {
    (checkAdminLoginRateLimit as jest.Mock).mockResolvedValue(false);
    const res = await run('POST');

    expect(res.status).toHaveBeenCalledWith(429);
    expect(loginAdminSession).not.toHaveBeenCalled();
  });

  /**
   * 성공 시 누적을 지우지 않으면, 정상 로그인만으로 한도가 차서
   * 비밀번호를 아는 관리자가 자기 시스템에서 잠긴다.
   */
  it('성공하면 누적을 지운다', async () => {
    await run('POST');
    expect(resetAdminLoginRateLimit).toHaveBeenCalled();
  });

  it('실패했을 때는 누적을 지우지 않는다', async () => {
    (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
    await run('POST');
    expect(resetAdminLoginRateLimit).not.toHaveBeenCalled();
  });
});

describe('DELETE — 로그아웃', () => {
  it('세션 파기를 호출하고 200', async () => {
    const res = await run('DELETE');
    expect(logoutAdminSession).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('로그아웃에는 시도 제한을 걸지 않는다', async () => {
    await run('DELETE');
    expect(checkAdminLoginRateLimit).not.toHaveBeenCalled();
  });
});

describe('그 외 메서드', () => {
  it.each(['GET', 'PUT', 'PATCH'])('%s는 405이고 로그인을 시도하지 않는다', async (method) => {
    const res = await run(method);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST, DELETE');
    expect(loginAdminSession).not.toHaveBeenCalled();
  });
});

describe('응답 위생', () => {
  it('어떤 메서드든 캐시를 금지한다', async () => {
    for (const method of ['POST', 'DELETE', 'GET']) {
      const res = await run(method);
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    }
  });
});
