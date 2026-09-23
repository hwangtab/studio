/** @jest-environment node */
jest.mock('../../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: jest.fn().mockReturnValue(true) }));
jest.mock('../../../../lib/funding/creatorToken', () => ({ consumeCreatorLoginToken: jest.fn() }));
jest.mock('../../../../lib/funding/creatorAuth', () => ({ loginCreatorSession: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../../../lib/funding/email', () => ({ sendCreatorSessionFailureAlert: jest.fn().mockResolvedValue(null) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/funding/creator/session';
import { consumeRateLimit } from '../../../../lib/booking/rate-limit';
import { isAllowedContactRequestOrigin } from '../../../../lib/contact/origin';
import { consumeCreatorLoginToken } from '../../../../lib/funding/creatorToken';
import { loginCreatorSession } from '../../../../lib/funding/creatorAuth';
import { sendCreatorSessionFailureAlert } from '../../../../lib/funding/email';

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
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (sendCreatorSessionFailureAlert as jest.Mock).mockResolvedValue(null);
  (loginCreatorSession as jest.Mock).mockResolvedValue(undefined);
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

describe('토큰은 소진됐는데 세션 생성이 던질 때', () => {
  it('401이 아니라 500을 주고 다른 문구를 담는다', async () => {
    (loginCreatorSession as jest.Mock).mockRejectedValue(new Error('boom'));
    const r = await call({ token: 'raw-token' });
    expect(r.status).toBe(500);
    expect(r.body.ok).toBe(false);
    // 만료·이미 사용됨은 여기서는 사실이 아니다 — 그 문구를 반복하지 않는다.
    expect(r.body.message).not.toMatch(/만료됐거나 이미 사용되었습니다/);
  });

  it('운영자에게 알림이 한 번 간다', async () => {
    (loginCreatorSession as jest.Mock).mockRejectedValue(new Error('boom'));
    await call({ token: 'raw-token' });
    expect(sendCreatorSessionFailureAlert).toHaveBeenCalledTimes(1);
  });

  it('알림도 창당 한 번만 나간다(레이트리밋에 걸리면 보내지 않는다)', async () => {
    (loginCreatorSession as jest.Mock).mockRejectedValue(new Error('boom'));
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    await call({ token: 'raw-token' });
    expect(sendCreatorSessionFailureAlert).not.toHaveBeenCalled();
  });
});
