/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../lib/funding/cancel', () => ({ cancelFundingPledge: jest.fn() }));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from './cancel';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { cancelFundingPledge } from '../../../lib/funding/cancel';

const call = async (body: unknown) => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method: 'POST', body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

beforeEach(() => jest.clearAllMocks());

it('body 형식 오류 → 400', async () => {
  const r = await call({ orderNo: '', token: '' });
  expect(r.status).toBe(400);
});

it('주문 없음 → 404', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
  const r = await call({ orderNo: 'FND-1', token: 't' });
  expect(r.status).toBe(404);
});

it('토큰 불일치 → 주문 없음과 같은 404 상태·메시지(존재 여부를 흘리지 않음)', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
  const notFound = await call({ orderNo: 'FND-1', token: 't' });

  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ manageToken: 'correct-token' });
  const mismatch = await call({ orderNo: 'FND-1', token: 'wrong-token' });

  expect(mismatch.status).toBe(notFound.status);
  expect(mismatch.body).toEqual(notFound.body);
  expect(mismatch.status).toBe(404);
});

it('정상 → cancelFundingPledge 호출 인자·200 응답', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ manageToken: 'correct-token' });
  (cancelFundingPledge as jest.Mock).mockResolvedValue({ ok: true, mode: 'refunded', refundAmount: 5000 });
  const r = await call({ orderNo: 'FND-1', token: 'correct-token' });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, mode: 'refunded', refundAmount: 5000 });
  expect(cancelFundingPledge).toHaveBeenCalledWith(
    expect.objectContaining({ orderNo: 'FND-1', requestedBy: 'customer', reason: '고객 셀프 취소', now: expect.any(Date) }),
  );
});

it('cancelFundingPledge 실패 → 409 code·message', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue({ manageToken: 'correct-token' });
  (cancelFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'invalid_state', message: '이미 취소됐습니다.' });
  const r = await call({ orderNo: 'FND-1', token: 'correct-token' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({ ok: false, code: 'invalid_state', message: '이미 취소됐습니다.' });
});
