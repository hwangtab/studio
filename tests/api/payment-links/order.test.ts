/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';

const returning = jest.fn().mockResolvedValue([{ createdAt: new Date('2026-10-10T00:00:00Z') }]);
const insertValues = jest.fn().mockReturnValue({ returning });
jest.mock('../../../db/client', () => ({ getDb: () => ({ insert: () => ({ values: insertValues }) }) }));
jest.mock('../../../lib/booking/bankDeposit', () => ({ deliverBookingDepositGuide: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

// eslint-disable-next-line import/first
import handler from '../../../pages/api/payment-links/order';
// eslint-disable-next-line import/first
import { PAYMENT_LINKS } from '../../../data/paymentLinks';
// eslint-disable-next-line import/first
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
// eslint-disable-next-line import/first
import { deliverBookingDepositGuide } from '../../../lib/booking/bankDeposit';

const [slug] = Object.keys(PAYMENT_LINKS);

const call = async (body: unknown, method = 'POST') => {
  const result: { status?: number; json?: Record<string, unknown>; headers: Record<string, string> } = { headers: {} };
  const res = {
    setHeader: (k: string, v: string) => { result.headers[k] = v; return res; },
    status: (code: number) => { result.status = code; return res; },
    json: (j: Record<string, unknown>) => { result.json = j; return res; },
  } as unknown as NextApiResponse;
  await handler({ method, body, headers: {}, socket: { remoteAddress: '1.2.3.4' } } as unknown as NextApiRequest, res);
  return result;
};

const valid = { slug, customerName: '김보컬', customerPhone: '010-1234-5678', customerEmail: 'a@b.com' };

beforeEach(() => {
  jest.clearAllMocks();
  insertValues.mockReturnValue({ returning });
});

describe('POST /api/payment-links/order', () => {
  it('금액·품목명은 서버 정의에서 읽는다 — 클라이언트가 보낸 금액은 무시한다', async () => {
    const r = await call({ ...valid, totalAmount: 1000, amount: 1000, orderName: '해킹' });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ ok: true, totalAmount: 400000, orderName: '싱글 음원 제작 예약금' });
    expect(r.headers['Cache-Control']).toBe('no-store');
    const row = insertValues.mock.calls[0][0];
    expect(row).toMatchObject({ type: 'deposit', status: 'pending', totalAmount: 400000, customerPhone: '010-1234-5678' });
    expect(row.itemAmount + row.vatAmount).toBe(400000);
    expect(row.orderNo).toMatch(/^SNB-\d{8}-[0-9A-F]{8}$/);
    expect(r.json?.orderNo).toBe(row.orderNo);
  });

  it('없는 slug는 404이고 주문을 만들지 않는다', async () => {
    const r = await call({ ...valid, slug: '0'.repeat(24) });
    expect(r.status).toBe(404);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it.each([
    ['이름', { customerName: 'A' }],
    ['휴대폰', { customerPhone: '123' }],
    ['이메일', { customerEmail: 'nope' }],
  ])('%s 검증에 실패하면 400이다', async (_label, patch) => {
    const r = await call({ ...valid, ...patch });
    expect(r.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('레이트리밋 키는 payment_link:ip 접두사를 쓰고, 한도 초과면 429다', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValueOnce(false);
    const r = await call(valid);
    expect(r.status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledWith('payment_link:ip:1.2.3.4', 10, 3600);
    expect(insertValues).not.toHaveBeenCalled();
  });

  describe('계좌 입금(bank_transfer)', () => {
    it('awaiting_deposit으로 만들고 입금 안내를 보내며, 금액은 여전히 서버 값이다', async () => {
      const r = await call({ ...valid, totalAmount: 1, paymentMethod: 'bank_transfer' });
      expect(r.status).toBe(201);
      expect(insertValues.mock.calls[0][0]).toMatchObject({ type: 'deposit', status: 'awaiting_deposit', totalAmount: 400000 });
      expect(deliverBookingDepositGuide).toHaveBeenCalledWith(r.json?.orderNo, { throttleCustomer: true });
      // 신청 + 3일(BANK_DEPOSIT_GUIDE_DAYS)
      expect(r.json).toMatchObject({ ok: true, paymentMethod: 'bank_transfer', totalAmount: 400000, deposit: { deadline: '2026-10-13T00:00:00.000Z' } });
    });

    it('알 수 없는 결제 방법은 400이고 주문을 만들지 않는다', async () => {
      const r = await call({ ...valid, paymentMethod: 'cash' });
      expect(r.status).toBe(400);
      expect(insertValues).not.toHaveBeenCalled();
    });

    it('toss를 명시하면 토스 흐름(pending)이고 안내 메일은 없다', async () => {
      await call({ ...valid, paymentMethod: 'toss' });
      expect(insertValues.mock.calls[0][0]).toMatchObject({ status: 'pending' });
      expect(deliverBookingDepositGuide).not.toHaveBeenCalled();
    });
  });

  it('POST가 아니면 405다', async () => {
    expect((await call(valid, 'GET')).status).toBe(405);
  });
});
