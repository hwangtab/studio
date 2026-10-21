/** @jest-environment node */

/**
 * 제작 계약 서명본 받기 — 의뢰인이 연락처 뒷자리를 맞히면 진행 페이지 접근 쿠키도 함께 받는다
 * (진행 페이지 unlock이 요구하는 것과 같은 확인이라 같은 번호를 두 번 묻지 않는다).
 * 법정대리인·틀린 뒷자리에는 쿠키를 주지 않는다.
 */

jest.mock('../../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../../lib/contracts/production/pdf-storage', () => ({
  loadOrRenderProductionPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));
jest.mock('../../../../lib/contracts/admin-rate-limit', () => ({
  getDownloadIdentityVerdict: jest.fn().mockResolvedValue('ok'),
  reserveDownloadIdentityAttempt: jest.fn().mockResolvedValue('ok'),
  resetDownloadIdentityAttempts: jest.fn().mockResolvedValue(undefined),
  checkDownloadRateLimit: jest.fn().mockResolvedValue(true),
}));

import type { NextApiRequest, NextApiResponse } from 'next';

import { getDb } from '../../../../db/client';
import { hasPortalAccess } from '../../../../lib/contracts/production/portal-session';
import handler from '../../../../pages/api/contracts/production/[id]/download';

const CLIENT_TOKEN = 'client_tok_qwertyuiopasdf';
const GUARDIAN_TOKEN = 'guardian_tok_qwertyuiopas';

const contract = {
  id: 'p1',
  clientName: '홍길동',
  clientPhone: '010-1234-5678',
  status: 'signed',
  purgedAt: null,
  signers: [
    { role: 'client', signToken: CLIENT_TOKEN, phone: null },
    { role: 'guardian', signToken: GUARDIAN_TOKEN, phone: '010-9999-0000' },
  ],
};

const run = async (token: string, identityDigits: string) => {
  (getDb as jest.Mock).mockReturnValue({ query: { productionContracts: { findFirst: jest.fn().mockResolvedValue(contract) } } });
  const headers: Record<string, string> = {};
  const res: Record<string, jest.Mock> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn((name: string, value: string) => {
    headers[name] = value;
    return res;
  });
  const req = { method: 'POST', query: { id: 'p1', token }, body: { identityDigits }, headers: {} } as unknown as NextApiRequest;
  await handler(req, res as unknown as NextApiResponse);
  return { res, headers };
};

describe('진행 페이지 접근 쿠키', () => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  beforeAll(() => {
    process.env.ADMIN_SESSION_SECRET = 'y'.repeat(40);
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  });

  it('의뢰인이 뒷자리를 맞히면 진행 페이지가 인정하는 쿠키를 함께 준다', async () => {
    const { res, headers } = await run(CLIENT_TOKEN, '5678');
    expect(res.status).toHaveBeenCalledWith(200);
    const cookie = headers['Set-Cookie'];
    expect(cookie).toContain('HttpOnly');
    const value = cookie.split(';')[0];
    expect(hasPortalAccess({ headers: { cookie: value } } as never, 'p1', CLIENT_TOKEN)).toBe(true);
    // 다른 토큰(재발송 전 링크 등)에는 통하지 않는다.
    expect(hasPortalAccess({ headers: { cookie: value } } as never, 'p1', 'other-token')).toBe(false);
  });

  it('틀린 뒷자리에는 쿠키를 주지 않는다', async () => {
    const { res, headers } = await run(CLIENT_TOKEN, '0000');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(headers['Set-Cookie']).toBeUndefined();
  });

  it('법정대리인에게는 쿠키를 주지 않는다 — 진행 페이지는 의뢰인 링크로만 연다', async () => {
    const { res, headers } = await run(GUARDIAN_TOKEN, '0000');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(headers['Set-Cookie']).toBeUndefined();
  });
});
