/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

jest.mock('../../../lib/booking/webhook', () => ({ processTossWebhook: jest.fn() }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

// eslint-disable-next-line import/first
import handler, { config } from '../../../pages/api/payments/webhook';
// eslint-disable-next-line import/first
import { processTossWebhook } from '../../../lib/booking/webhook';

const res = () => {
  const r: Partial<NextApiResponse> & { statusCode?: number; body?: unknown } = {};
  r.status = ((code: number) => {
    r.statusCode = code;
    return r as NextApiResponse;
  }) as NextApiResponse['status'];
  r.json = ((body: unknown) => {
    r.body = body;
    return r as NextApiResponse;
  }) as NextApiResponse['json'];
  return r;
};

describe('POST /api/payments/webhook', () => {
  it('실행 한도를 60초로 올려 둔다 — 재조회·승인·기록·메일이 한 요청에 직렬로 붙어 있다', () => {
    // 기본 10초에서 잘리면 승인된 결제가 미기록으로 남고, 복구 경로가 이 웹훅뿐이라
    // 재시도마다 같은 지점에서 다시 잘린다. contracts·cron 라우트와 같은 60초를 쓴다.
    expect(config).toEqual({ maxDuration: 60 });
  });

  it('processTossWebhook의 상태 코드를 그대로 돌려준다', async () => {
    (processTossWebhook as jest.Mock).mockResolvedValue({ status: 500 });
    const r = res();
    await handler(
      { method: 'POST', body: {}, headers: {}, socket: { remoteAddress: '1.2.3.4' } } as unknown as NextApiRequest,
      r as NextApiResponse,
    );
    expect(r.statusCode).toBe(500);
    expect(r.body).toEqual({ ok: false });
  });
});
