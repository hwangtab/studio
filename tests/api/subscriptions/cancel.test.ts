/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/billing/service', () => ({
  findSubscriptionForManage: jest.fn(),
  cancelSubscription: jest.fn(),
}));
jest.mock('../../../lib/billing/email', () => ({ sendSubscriptionCancelledEmail: jest.fn().mockResolvedValue(null) }));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/subscriptions/cancel';
import { cancelSubscription, findSubscriptionForManage } from '../../../lib/billing/service';

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

it('토큰 불일치 → 구독 부재와 같은 404 (존재 여부를 흘리지 않음)', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: false, code: 'not_found' });
  const r = await call({ id: 'sub-1', token: 'wrong' });
  expect(r.status).toBe(404);
});

it('정상 해지 → cancelSubscription 호출·200·endsAt 포함, 해지 메일 발송', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
  const endsAt = new Date('2026-10-05T00:00:00.000Z');
  (cancelSubscription as jest.Mock).mockResolvedValue({ ok: true, subscription: { id: 'sub-1', endsAt } });
  const r = await call({ id: 'sub-1', token: 'correct' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, endsAt: endsAt.toISOString() });
  expect(cancelSubscription).toHaveBeenCalledWith(
    'sub-1',
    expect.objectContaining({ requestedBy: 'customer' }),
    expect.any(Date),
  );
});

it('이미 해지된 구독 → 409', async () => {
  (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
  (cancelSubscription as jest.Mock).mockResolvedValue({ ok: false, code: 'invalid_state' });
  const r = await call({ id: 'sub-1', token: 'correct' });
  expect(r.status).toBe(409);
});
