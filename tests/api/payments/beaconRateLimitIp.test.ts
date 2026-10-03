/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/contact/origin', () => ({ isAllowedContactRequestOrigin: () => true }));
jest.mock('../../../lib/payments/recordFailure', () => ({ recordPaymentFailure: jest.fn() }));
jest.mock('../../../lib/payments/windowOpen', () => ({ recordPaymentWindowOpen: jest.fn() }));

// eslint-disable-next-line import/first
import failedHandler from '../../../pages/api/payments/failed';
// eslint-disable-next-line import/first
import openedHandler from '../../../pages/api/payments/opened';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../lib/booking/rate-limit';

const res = () => {
  const r: Partial<NextApiResponse> = {};
  r.setHeader = (() => r) as unknown as NextApiResponse['setHeader'];
  r.status = (() => r) as unknown as NextApiResponse['status'];
  r.end = (() => r) as unknown as NextApiResponse['end'];
  return r as NextApiResponse;
};

/**
 * 비콘 레이트리밋 키는 클라이언트가 직접 넣을 수 있는 x-forwarded-for가 아니라
 * Vercel이 덮어쓰는 x-vercel-forwarded-for(getClientIp)에서 온다 — 헤더를 바꿔 가며
 * 제한을 피할 수 없어야 한다.
 */
describe.each([
  ['failed', failedHandler, 'payfail'],
  ['opened', openedHandler, 'payopen'],
] as const)('POST /api/payments/%s 레이트리밋 키', (_name, handler, prefix) => {
  beforeEach(() => jest.clearAllMocks());

  it('x-forwarded-for가 아니라 x-vercel-forwarded-for를 쓴다', async () => {
    await handler({
      method: 'POST', body: { orderNo: 'FND-1' },
      headers: { 'x-forwarded-for': '6.6.6.6', 'x-vercel-forwarded-for': '1.2.3.4' },
      socket: { remoteAddress: '9.9.9.9' },
    } as unknown as NextApiRequest, res());
    expect(consumeRateLimit).toHaveBeenCalledWith(`${prefix}:1.2.3.4`, 20, 60);
  });

  it('Vercel 헤더가 없으면 위조 가능한 헤더 대신 소켓 주소를 쓴다', async () => {
    await handler({
      method: 'POST', body: { orderNo: 'FND-1' },
      headers: { 'x-forwarded-for': '6.6.6.6' },
      socket: { remoteAddress: '9.9.9.9' },
    } as unknown as NextApiRequest, res());
    expect(consumeRateLimit).toHaveBeenCalledWith(`${prefix}:9.9.9.9`, 20, 60);
  });
});
