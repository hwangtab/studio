/** @jest-environment node */
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorToken', () => ({ consumeCreatorLoginToken: jest.fn() }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ loginCreatorSession: jest.fn().mockResolvedValue(undefined) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/funding/creator/session';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';
import { loginCreatorSession } from '../../../../lib/funding/creatorAuth';

const call = async (body: unknown, method = 'POST') => {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader, status } as unknown as NextApiResponse;
  await handler({ method, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0], setHeader };
};

beforeEach(() => {
  jest.clearAllMocks();
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(true);
  (consumeCreatorLoginToken as jest.Mock).mockResolvedValue({ creatorId: 'c1' });
});

it('POST가 아니면 405', async () => {
  const r = await call(undefined, 'GET');
  expect(r.status).toBe(405);
  expect(consumeCreatorLoginToken).not.toHaveBeenCalled();
});

it('허용되지 않은 Origin이면 403', async () => {
  (isAllowedContactRequestOrigin as jest.Mock).mockReturnValue(false);
  const r = await call({ token: 'raw-token' });
  expect(r.status).toBe(403);
  expect(consumeCreatorLoginToken).not.toHaveBeenCalled();
});

it('토큰이 없으면 400', async () => {
  const r = await call({});
  expect(r.status).toBe(400);
  expect(consumeCreatorLoginToken).not.toHaveBeenCalled();
});

it('잘못되었거나 만료된 토큰이면 401이고 세션이 심기지 않는다', async () => {
  (consumeCreatorLoginToken as jest.Mock).mockResolvedValue(null);
  const r = await call({ token: 'bad-token' });
  expect(r.status).toBe(401);
  expect(loginCreatorSession).not.toHaveBeenCalled();
});

it('정상 토큰이면 200이고 세션이 심긴다', async () => {
  const r = await call({ token: 'raw-token' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
  expect(consumeCreatorLoginToken).toHaveBeenCalledWith('raw-token');
  expect(loginCreatorSession).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'c1');
});

it('Cache-Control: no-store가 실린다', async () => {
  const r = await call({ token: 'raw-token' });
  expect(r.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});
