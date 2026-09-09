/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/billing/service', () => ({
  findSubscriptionForManage: jest.fn(),
  issueCardChangeToken: jest.fn(),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/subscriptions/card-change';
import { findSubscriptionForManage, issueCardChangeToken } from '../../../lib/billing/service';

const call = async (body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

beforeEach(() => jest.clearAllMocks());

it('body 형식 오류 → 400', async () => {
  const r = await call({ id: '', token: '' });
  expect(r.status).toBe(400);
});

it('토큰 불일치 → 404', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: false, code: 'not_found' });
  const r = await call({ id: 'sub-1', token: 'wrong' });
  expect(r.status).toBe(404);
});

it('정상 → 새 setupToken 반환', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
  (issueCardChangeToken as jest.Mock).mockResolvedValue({ ok: true, setupToken: 'new-token' });
  const r = await call({ id: 'sub-1', token: 'correct' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, setupToken: 'new-token' });
});

it('허용되지 않는 상태 → 409', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
  (issueCardChangeToken as jest.Mock).mockResolvedValue({ ok: false, code: 'invalid_state' });
  const r = await call({ id: 'sub-1', token: 'correct' });
  expect(r.status).toBe(409);
});
