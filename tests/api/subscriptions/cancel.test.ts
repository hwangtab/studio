/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/billing/service', () => ({
  findSubscriptionForManage: jest.fn(),
  cancelSubscription: jest.fn(),
  firstPaidAtOf: jest.fn().mockResolvedValue(null),
  paidCycleCountOf: jest.fn().mockResolvedValue(1),
}));
jest.mock('../../../lib/billing/email', () => ({
  sendSubscriptionCancelledEmail: jest.fn().mockResolvedValue(null),
  sendSubscriptionOperatorAlert: jest.fn().mockResolvedValue(null),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/subscriptions/cancel';
import { cancelSubscription, findSubscriptionForManage, firstPaidAtOf } from '../../../lib/billing/service';
import { sendSubscriptionCancelledEmail, sendSubscriptionOperatorAlert } from '../../../lib/billing/email';

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

describe('셀프 해지 운영자 알림 — 환불 약속을 이행할 트리거', () => {
  const cancelled = (kind: string) => {
    (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
    (cancelSubscription as jest.Mock).mockResolvedValue({
      ok: true,
      subscription: { id: 'sub-1', kind, endsAt: new Date('2026-10-05T00:00:00.000Z'), customerEmail: 'a@b.c', customerName: '김해지' },
    });
  };

  it('레슨 셀프 해지는 운영자에게 cancelled 알림이 간다(첫 수업 전 전액 환불 힌트)', async () => {
    cancelled('lesson');
    await call({ id: 'sub-1', token: 'correct' });
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }), 'cancelled', expect.stringContaining('첫 수업 전'));
    expect(sendSubscriptionCancelledEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ refundNote: undefined }));
  });

  it('아티스트 후원이 첫 결제 후 7일 안에 해지되면 전액 환불 대상으로 알리고 고객 메일에도 적는다', async () => {
    cancelled('artist-support');
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T00:00:00Z'));
    (firstPaidAtOf as jest.Mock).mockResolvedValue(new Date('2026-09-30T00:00:00Z'));
    await call({ id: 'sub-1', token: 'correct' });
    jest.useRealTimers();
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.anything(), 'cancelled', expect.stringContaining('7일 이내 해지 — 전액 환불 대상'));
    expect(sendSubscriptionCancelledEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ refundNote: expect.stringContaining('전액 환불') }));
    expect((sendSubscriptionCancelledEmail as jest.Mock).mock.calls.at(-1)![1].refundNote).not.toContain('영업일');
  });

  it('아티스트 후원이 7일을 지나 해지되면 일할 환급 안내만 운영자에게 간다', async () => {
    cancelled('artist-support');
    jest.useFakeTimers().setSystemTime(new Date('2026-10-10T00:00:00Z'));
    (firstPaidAtOf as jest.Mock).mockResolvedValue(new Date('2026-09-30T00:00:00Z'));
    await call({ id: 'sub-1', token: 'correct' });
    jest.useRealTimers();
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.anything(), 'cancelled', expect.stringContaining('7일이 지난 해지'));
    expect(sendSubscriptionCancelledEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ refundNote: undefined }));
  });

  it('운영자 알림이 실패해도 해지는 200이다', async () => {
    cancelled('lesson');
    (sendSubscriptionOperatorAlert as jest.Mock).mockResolvedValueOnce('operator:fail');
    const r = await call({ id: 'sub-1', token: 'correct' });
    expect(r.status).toBe(200);
  });
});

describe('7일 판정은 KST 달력 날짜다 — 결제일 + 7일의 24:00까지', () => {
  const cancelled = () => {
    (findSubscriptionForManage as jest.Mock).mockResolvedValue({ ok: true, subscription: {} });
    (cancelSubscription as jest.Mock).mockResolvedValue({ ok: true, subscription: { id: 'sub-1', kind: 'artist-support', endsAt: new Date('2026-10-20T00:00:00.000Z'), customerEmail: 'a@b.c', customerName: '김해지' } });
  };
  it('10/1 23:00 KST 결제 → 10/8 23:30 KST 해지는 7일 이내(168시간을 넘어도)', async () => {
    cancelled();
    (firstPaidAtOf as jest.Mock).mockResolvedValue(new Date('2026-10-01T14:00:00Z')); // 10/1 23:00 KST
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T14:30:00Z')); // 10/8 23:30 KST
    await call({ id: 'sub-1', token: 'correct' });
    jest.useRealTimers();
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.anything(), 'cancelled', expect.stringContaining('7일 이내 해지'));
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.anything(), 'cancelled', expect.stringContaining('2026-10-01')); // KST 날짜
  });
  it('10/9 00:30 KST 해지는 7일 밖', async () => {
    cancelled();
    (firstPaidAtOf as jest.Mock).mockResolvedValue(new Date('2026-10-01T14:00:00Z'));
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T15:30:00Z')); // 10/9 00:30 KST
    await call({ id: 'sub-1', token: 'correct' });
    jest.useRealTimers();
    expect(sendSubscriptionOperatorAlert).toHaveBeenCalledWith(expect.anything(), 'cancelled', expect.stringContaining('7일이 지난 해지'));
  });
});
