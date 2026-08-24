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
  isAdminLoginThrottled: jest.fn(),
  recordAdminLoginFailure: jest.fn(),
  resetAdminLoginRateLimit: jest.fn(),
}));
jest.mock('../../../lib/contracts/admin-auth', () => ({
  loginAdminSession: jest.fn(),
  logoutAdminSession: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { loginAdminSession, logoutAdminSession } from '../../../lib/contracts/admin-auth';
import {
  isAdminLoginThrottled,
  recordAdminLoginFailure,
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
  (isAdminLoginThrottled as jest.Mock).mockResolvedValue(false);
  (recordAdminLoginFailure as jest.Mock).mockResolvedValue({ globalExceeded: false });
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
   * 이 IP가 이미 창 한도를 넘겼으면 비밀번호를 대조하기 전에 막는다 — 단일 IP 대입 차단.
   */
  it('이 IP가 스로틀되면 비밀번호를 대조하지 않고 429', async () => {
    (isAdminLoginThrottled as jest.Mock).mockResolvedValue(true);
    const res = await run('POST');

    expect(res.status).toHaveBeenCalledWith(429);
    expect(loginAdminSession).not.toHaveBeenCalled();
    expect(recordAdminLoginFailure).not.toHaveBeenCalled();
  });

  /**
   * H2 회귀: 전역 상한은 비밀번호 대조 뒤에만 본다. 올바른 비밀번호는 전역 상한과
   * 무관하게 통과해야 한다 — 공격자가 운영자를 봉쇄하지 못하게 하는 핵심 성질이다.
   */
  it('올바른 비밀번호는 실패로 계수하지 않고, 전역 상한과 무관하게 통과한다', async () => {
    const res = await run('POST');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(recordAdminLoginFailure).not.toHaveBeenCalled();
  });

  /**
   * 성공 시 subject·global을 모두 지운다. 안 지우면 전역 상한이 영구 봉쇄로 굳는다(H2).
   */
  it('성공하면 누적을 지운다', async () => {
    await run('POST');
    expect(resetAdminLoginRateLimit).toHaveBeenCalled();
  });

  it('틀렸을 때만 실패로 계수한다', async () => {
    (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
    await run('POST');
    expect(recordAdminLoginFailure).toHaveBeenCalled();
    expect(resetAdminLoginRateLimit).not.toHaveBeenCalled();
  });

  /** 오답이 전역 상한을 넘기면(IP 회전 신호) 401 대신 429. */
  it('오답이 전역 상한을 넘기면 429', async () => {
    (loginAdminSession as jest.Mock).mockResolvedValue({ ok: false });
    (recordAdminLoginFailure as jest.Mock).mockResolvedValue({ globalExceeded: true });
    const res = await run('POST');
    expect(res.status).toHaveBeenCalledWith(429);
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
    expect(isAdminLoginThrottled).not.toHaveBeenCalled();
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
