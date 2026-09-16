/** @jest-environment node */
/**
 * 아티스트 구독 신청 API — 게이트·검증·서비스 매핑. 돈이 움직이는 규칙은 lib 쪽 테스트가 지킨다.
 */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/billing/service', () => ({ createSubscription: jest.fn() }));
jest.mock('../../../lib/billing/email', () => ({
  sendSubscriptionSetupEmail: jest.fn().mockResolvedValue(null),
  subscriptionSetupUrl: (sub: { id: string }, token: string) => `https://studionol.co.kr/ko/subscribe/${sub.id}?token=${token}`,
}));
jest.mock('../../../db/client', () => ({
  getDb: () => ({
    query: { subscriptions: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', kind: 'artist-support' }) } },
    update: () => ({ set: () => ({ where: jest.fn().mockResolvedValue(undefined) }) }),
  }),
}));
jest.mock('../../../data/artists', () => ({
  getSupportedArtist: (slug: string) => (slug === 'jai' ? { slug: 'jai', name: '자이', supportActive: true, taxType: 'withholding' } : null),
  SUPPORTED_ARTISTS: [],
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/artists/support';
import { createSubscription } from '../../../lib/billing/service';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';

const GOOD = { artistSlug: 'jai', tierId: 'standard', customerName: '김후원', customerEmail: 'fan@example.com', displayConsent: true };

const call = async (body: unknown, method = 'POST') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_ARTIST_SUPPORT_OPEN;
beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  process.env.NEXT_PUBLIC_ARTIST_SUPPORT_OPEN = '1';
});
afterAll(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_ARTIST_SUPPORT_OPEN;
  else process.env.NEXT_PUBLIC_ARTIST_SUPPORT_OPEN = ORIGINAL_FLAG;
});

it('심사 전(플래그 없음)에는 503으로 닫혀 있고 구독을 만들지 않는다', async () => {
  delete process.env.NEXT_PUBLIC_ARTIST_SUPPORT_OPEN;
  const r = await call(GOOD);
  expect(r.status).toBe(503);
  expect(r.body.code).toBe('closed');
  expect(createSubscription).not.toHaveBeenCalled();
});

it('레이트리밋에 걸리면 429', async () => {
  (consumeRateLimit as jest.Mock).mockResolvedValue(false);
  const r = await call(GOOD);
  expect(r.status).toBe(429);
});

it('검증 실패는 400이고 서비스를 부르지 않는다', async () => {
  const r = await call({ ...GOOD, tierId: 'gold' });
  expect(r.status).toBe(400);
  expect(createSubscription).not.toHaveBeenCalled();
});

it('정상 신청은 artist-support 종류로 구독을 만들고 카드 등록 URL을 돌려준다 — 금액은 보내지 않는다', async () => {
  (createSubscription as jest.Mock).mockResolvedValue({ ok: true, id: 'sub-1', setupToken: 'tok', manageToken: 'mt' });
  const r = await call({ ...GOOD, totalAmount: 1 });
  expect(r.status).toBe(201);
  expect(r.body.setupUrl).toBe('https://studionol.co.kr/ko/subscribe/sub-1?token=tok');
  const input = (createSubscription as jest.Mock).mock.calls[0][0];
  expect(input).toMatchObject({ kind: 'artist-support', artistSlug: 'jai', tierId: 'standard', displayConsent: true, displayName: '김후원' });
  expect(input).not.toHaveProperty('totalAmount');
  expect(input.billingDay).toBeGreaterThanOrEqual(1);
  expect(input.billingDay).toBeLessThanOrEqual(28);
});

it('아티스트가 후원을 닫아 둔 경우 서비스 거절을 409로 넘긴다', async () => {
  (createSubscription as jest.Mock).mockResolvedValue({ ok: false, code: 'artist_not_open' });
  const r = await call(GOOD);
  expect(r.status).toBe(409);
});

it('POST가 아니면 405', async () => {
  const r = await call(GOOD, 'GET');
  expect(r.status).toBe(405);
});
