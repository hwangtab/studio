/** @jest-environment node */
jest.mock('../../../../../lib/contracts/admin-auth', () => ({ authenticateAdminApi: jest.fn() }));
jest.mock('../../../../../lib/funding/service', () => ({ findFundingOrderById: jest.fn() }));
jest.mock('../../../../../lib/funding/bank-transfer', () => ({ confirmBankDeposit: jest.fn() }));
jest.mock('../../../../../lib/funding/cancel', () => ({ cancelFundingPledge: jest.fn() }));
jest.mock('../../../../../lib/funding/email', () => ({ sendFundingConfirmedEmails: jest.fn(), sendFundingBankDepositEmails: jest.fn(), sendFundingRefundRequestClearedEmails: jest.fn() }));
jest.mock('../../../../../lib/funding/projects', () => ({ getFundingProject: jest.fn() }));
const mockUpdate = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })) }));
// set_fulfillment은 가드를 WHERE에 실은 단일 UPDATE(db.run)다 — 선점에 성공한 경로가 기본값.
const mockRun = jest.fn().mockResolvedValue({ rowsAffected: 1 });
jest.mock('../../../../../db/client', () => ({
  getDb: jest.fn(() => ({ update: mockUpdate, run: mockRun })),
}));

import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../../pages/api/admin/funding/pledges/[id]';
import { authenticateAdminApi } from '../../../../../lib/contracts/admin-auth';
import { findFundingOrderById } from '../../../../../lib/funding/service';
import { confirmBankDeposit } from '../../../../../lib/funding/bank-transfer';
import { cancelFundingPledge } from '../../../../../lib/funding/cancel';
import { sendFundingConfirmedEmails, sendFundingBankDepositEmails, sendFundingRefundRequestClearedEmails } from '../../../../../lib/funding/email';

const call = async (method: string, query: unknown, body: unknown) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method, query, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const BASE_ORDER = {
  id: 'order-1',
  orderNo: 'FND-1',
  status: 'paid',
  fundingPledge: {
    id: 'pledge-1',
    projectSlug: 'demo',
    paymentMethod: 'bank_transfer',
    trackingCompany: null,
    trackingNumber: null,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockResolvedValue({ rowsAffected: 1 });
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: true });
  (findFundingOrderById as jest.Mock).mockResolvedValue(BASE_ORDER);
});

it('인증 실패 → 401', async () => {
  (authenticateAdminApi as jest.Mock).mockResolvedValue({ ok: false });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'confirm_deposit' });
  expect(r.status).toBe(401);
});

it('confirm_deposit → confirmBankDeposit 호출', async () => {
  (confirmBankDeposit as jest.Mock).mockResolvedValue({ ok: true });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'confirm_deposit' });
  expect(confirmBankDeposit).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1', now: expect.any(Date) }));
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true });
});

it('refund → cancelFundingPledge를 requestedBy admin으로 호출', async () => {
  (cancelFundingPledge as jest.Mock).mockResolvedValue({ ok: true, mode: 'refunded' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'refund', reason: '고객 요청' });
  expect(cancelFundingPledge).toHaveBeenCalledWith(
    expect.objectContaining({ orderNo: 'FND-1', requestedBy: 'admin', reason: '고객 요청', now: expect.any(Date) }),
  );
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, mode: 'refunded' });
});

it('set_fulfillment 잘못된 값 → 400', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'bogus' });
  expect(r.status).toBe(400);
});

it('set_fulfillment은 paid가 아닌 주문에서 409', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'preparing' });
  expect(r.status).toBe(409);
});

it('알 수 없는 action → 400', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'nope' });
  expect(r.status).toBe(400);
});

it('resend_email: refunded 주문은 재발송할 메일이 없어 409, DB 기록도 안 한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'refunded' });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({ ok: false, message: '재발송할 메일이 없는 상태입니다.' });
  expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();
  expect(sendFundingBankDepositEmails).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('resend_email: paid면 확정 메일을 재발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'paid' });
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(sendFundingConfirmedEmails).toHaveBeenCalled();
  expect(r.status).toBe(200);
});

it('resend_email: pending + 무통장이면 안내 메일을 재발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending' });
  (sendFundingBankDepositEmails as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(sendFundingBankDepositEmails).toHaveBeenCalled();
  expect(r.status).toBe(200);
});

it('resend_email: pending이어도 토스면 재발송할 메일이 없어 409', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({ ...BASE_ORDER, status: 'pending', fundingPledge: { ...BASE_ORDER.fundingPledge, paymentMethod: 'toss' } });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it('resend_email: 수기 등록 + 플레이스홀더 이메일이면 409 — 발송하지 않는다', async () => {
  // 수기 등록 건에는 실제 고객 주소가 없다(manual@studionol.co.kr) — 재발송해 봐야
  // 우리 도메인으로 되돌아온다.
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid', customerEmail: 'manual@studionol.co.kr',
    fundingPledge: { ...BASE_ORDER.fundingPledge, entrySource: 'manual' },
  });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'resend_email' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({ ok: false, message: '수기 등록 건은 메일을 보내지 않습니다.' });
  expect(sendFundingConfirmedEmails).not.toHaveBeenCalled();
});

it('resend_email: 수기 등록이어도 실제 고객 이메일이면 발송한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid', customerEmail: 'real@example.com',
    fundingPledge: { ...BASE_ORDER.fundingPledge, entrySource: 'manual' },
  });
  (sendFundingConfirmedEmails as jest.Mock).mockResolvedValue(null);
  expect((await call('PATCH', { id: 'order-1' }, { action: 'resend_email' })).status).toBe(200);
});

// 빈 문자열 운송장이 null로 저장되는지, delivered_at이 실제로 채워지는지처럼 SQL이 쓴
// 값을 확인하는 것은 setFulfillment.integration.test.ts가 실 DB로 본다.

/**
 * 무통장 청약철회는 refundRequestedAt만 찍고 주문은 paid로 남긴다. 예전엔 그 건도
 * '발송 완료'로 바꿀 수 있어서, 취소를 요청한 사람에게 실물이 나간 뒤 시스템 안에서는
 * 정상 발송으로 굳었다.
 */
it('set_fulfillment: 환불 요청된 후원은 409이고 DB를 건드리지 않는다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue({
    ...BASE_ORDER, status: 'paid',
    fundingPledge: { ...BASE_ORDER.fundingPledge, refundRequestedAt: new Date('2026-10-16T02:00:00Z') },
  });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(409);
  expect(r.body).toEqual({
    ok: false,
    message: '환불 요청된 후원입니다. 환불을 처리하거나 요청을 취소한 뒤에 발송 상태를 바꿔 주세요.',
  });
  expect(mockRun).not.toHaveBeenCalled();
});

/**
 * 위 두 검사는 사람에게 이유를 알려 주는 것이고, 경합을 막는 것은 UPDATE의 WHERE다.
 * 읽고-검사-쓰기 사이에 환불이 들어오면 두 요청이 모두 검사를 통과해 청약철회한 건이
 * '발송완료'로 굳는다. 진 쪽은 rowsAffected 0을 받아 409여야 한다.
 */
it('set_fulfillment: 경합으로 선점에 실패(rowsAffected 0)하면 409', async () => {
  mockRun.mockResolvedValueOnce({ rowsAffected: 0 });
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(409);
  expect(r.body.message).toContain('새로고침');
});



it('set_fulfillment: 환불 요청이 없으면 그대로 저장된다', async () => {
  const r = await call('PATCH', { id: 'order-1' }, { action: 'set_fulfillment', fulfillmentStatus: 'shipped' });
  expect(r.status).toBe(200);
  expect(mockRun).toHaveBeenCalled();
});

/**
 * 이게 없으면 발송 차단이 영구 잠금이 되고 헬스체크가 매일 영구히 울린다. 다만 이 액션은
 * 고객이 남긴 청약철회 의사를 지우므로, 흔적(사유 + 메모 append)과 통지(확인 메일)를
 * 강제한다. 셋 중 하나라도 빠지면 조용히 지워진다.
 */
const requested = (status = 'paid', adminMemo: string | null = null) => ({
  ...BASE_ORDER, status,
  fundingPledge: { ...BASE_ORDER.fundingPledge, adminMemo, refundRequestedAt: new Date('2026-10-16T02:00:00Z') },
});

it('clear_refund_request: 사유가 없으면 400이고 아무것도 안 바꾼다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested());
  for (const body of [{ action: 'clear_refund_request' }, { action: 'clear_refund_request', reason: '   ' }]) {
    const r = await call('PATCH', { id: 'order-1' }, body);
    expect(r.status).toBe(400);
  }
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(sendFundingRefundRequestClearedEmails).not.toHaveBeenCalled();
});

it('clear_refund_request: 사유를 날짜와 함께 메모에 덧붙이고 후원자에게 메일을 보낸다', async () => {
  const set = jest.fn((_values: Record<string, unknown>) => ({ where: jest.fn().mockResolvedValue(undefined) }));
  mockUpdate.mockReturnValueOnce({ set } as never);
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested('paid', '기존 메모'));
  (sendFundingRefundRequestClearedEmails as jest.Mock).mockResolvedValue(null);
  const r = await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: '후원자 전화 철회' });
  expect(r.status).toBe(200);
  const written = set.mock.calls[0][0];
  expect(written.refundRequestedAt).toBeNull();
  // 덮어쓰지 않는다 — 기존 메모가 사라지면 그것도 기록 손실이다.
  expect(written.adminMemo as string).toMatch(/^기존 메모\n\[\d{4}-\d{2}-\d{2}\] 환불 요청 취소 — 후원자 전화 철회$/);
  const mailArgs = (sendFundingRefundRequestClearedEmails as jest.Mock).mock.calls[0];
  expect(mailArgs[0]).toMatchObject({ orderNo: 'FND-1' });
  expect(mailArgs[2]).toBe('후원자 전화 철회');
});

it('clear_refund_request: 메모가 없던 건은 항목 하나로 시작한다', async () => {
  const set = jest.fn((_values: Record<string, unknown>) => ({ where: jest.fn().mockResolvedValue(undefined) }));
  mockUpdate.mockReturnValueOnce({ set } as never);
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested());
  (sendFundingRefundRequestClearedEmails as jest.Mock).mockResolvedValue(null);
  await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: '오접수' });
  expect(set.mock.calls[0][0].adminMemo as string).toMatch(/^\[\d{4}-\d{2}-\d{2}\] 환불 요청 취소 — 오접수$/);
});

// 메일 실패가 기록을 되돌리지는 않지만(상태 변경은 이미 끝났다) 운영자에게는 알려야 한다.
it('clear_refund_request: 메일이 실패하면 notificationError에 남기고 메시지로 알린다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested());
  (sendFundingRefundRequestClearedEmails as jest.Mock).mockResolvedValue('customer:TIMEOUT');
  const r = await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: '오접수' });
  expect(r.status).toBe(200);
  expect(r.body.message).toContain('customer:TIMEOUT');
});

it('clear_refund_request: 요청이 없으면 409, 이미 환불된 건도 409', async () => {
  expect((await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: 'x' })).status).toBe(409);
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested('refunded'));
  expect((await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: 'x' })).status).toBe(409);
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(sendFundingRefundRequestClearedEmails).not.toHaveBeenCalled();
});

// 잔액이 남은 부분환불 건도 정리할 수 있어야 한다 — 화면·헬스체크와 같은 상태 집합이다.
it('clear_refund_request: partially_refunded도 허용한다', async () => {
  (findFundingOrderById as jest.Mock).mockResolvedValue(requested('partially_refunded'));
  (sendFundingRefundRequestClearedEmails as jest.Mock).mockResolvedValue(null);
  expect((await call('PATCH', { id: 'order-1' }, { action: 'clear_refund_request', reason: '철회' })).status).toBe(200);
});
