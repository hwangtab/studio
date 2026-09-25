/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/display-name';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getDb } from '../../../db/client';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';

/**
 * 약관 제13조 2항이 약속한 "후원 확인 페이지에서 이름 공개 동의 철회"의 서버 쪽.
 * 인증·응답 규칙은 /api/funding/cancel과 같다 — 관리 토큰 + 속도 제한, 그리고 주문 부재와
 * 토큰 불일치를 같은 404로 돌려준다(주문번호는 비밀이 아니다).
 */
const where = jest.fn();
const set = jest.fn().mockReturnValue({ where });
const update = jest.fn().mockReturnValue({ set });

const call = async (body: unknown, method = 'PATCH') => {
  const json = jest.fn(); const status = jest.fn().mockReturnValue({ json });
  const res = { setHeader: jest.fn(), status } as unknown as NextApiResponse;
  await handler({ method, body, headers: {}, socket: {} } as unknown as NextApiRequest, res);
  return { status: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
};

const order = (over: Record<string, unknown> = {}) => ({
  id: 'order-1', manageToken: 'correct-token', status: 'paid', customerName: '홍길동',
  fundingPledge: { paymentMethod: 'toss', publicName: null }, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
  (getDb as jest.Mock).mockReturnValue({ update });
});

it('PATCH가 아니면 405', async () => {
  expect((await call({}, 'POST')).status).toBe(405);
});

it('body 형식 오류 → 400 (displayNamePublic은 boolean이어야 한다)', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
  expect((await call({ orderNo: 'FND-1', token: 't', displayNamePublic: 'yes' })).status).toBe(400);
  expect((await call({ orderNo: 'FND-1', token: '', displayNamePublic: true })).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it('주문 없음과 토큰 불일치는 같은 404', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(undefined);
  const notFound = await call({ orderNo: 'FND-1', token: 't', displayNamePublic: false });
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
  const mismatch = await call({ orderNo: 'FND-1', token: 'wrong-token', displayNamePublic: false });
  expect(mismatch.status).toBe(notFound.status);
  expect(mismatch.body).toEqual(notFound.body);
  expect(mismatch.status).toBe(404);
  expect(update).not.toHaveBeenCalled();
});

it('속도 제한에 걸리면 429 — 토큰 대입을 무제한으로 시도하지 못한다', async () => {
  (consumeRateLimit as jest.Mock).mockResolvedValue(false);
  expect((await call({ orderNo: 'FND-1', token: 't', displayNamePublic: false })).status).toBe(429);
  expect(findFundingOrderByOrderNo).not.toHaveBeenCalled();
});

it.each(['paid', 'pending', 'partially_refunded'])('%s 상태에서는 철회할 수 있다', async (status) => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status }));
  const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false });
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ ok: true, displayNamePublic: false, publicName: null });
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ displayNamePublic: false }));
});

it.each(['refunded', 'expired', 'failed'])('%s 상태는 409 — 끝난 펀딩의 기록은 바꾸지 않는다', async (status) => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status }));
  const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false });
  expect(r.status).toBe(409);
  expect(update).not.toHaveBeenCalled();
});

it('다시 공개로 되돌릴 수도 있다', async () => {
  (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
  const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true });
  expect(r.body).toEqual({ ok: true, displayNamePublic: true, publicName: null });
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ displayNamePublic: true }));
});

/**
 * 명단 표시 이름(실명·가린 이름·닉네임). 결제 완료 화면의 "명단에 올리기"와 펀딩 확인 화면이
 * 같은 경로로 보낸다.
 */
describe('명단 표시 이름', () => {
  beforeEach(() => (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order()));

  it('가린 이름은 서버가 결제자 이름에서 만든다 — 클라이언트가 보낸 문자열을 믿지 않는다', async () => {
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'masked', publicNickname: '아무거나' });
    expect(r.status).toBe(200);
    expect(r.body.publicName).toBe('홍*동');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ displayNamePublic: true, publicName: '홍*동' }));
  });

  it('닉네임은 앞뒤 공백을 걷어 저장한다', async () => {
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '  연대하는 청취자 ' });
    expect(r.body.publicName).toBe('연대하는 청취자');
  });

  it('실명을 고르면 표시 이름을 비운다(NULL = 결제자 이름)', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ fundingPledge: { paymentMethod: 'toss', publicName: '옛닉' } }));
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'real' });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ publicName: null }));
  });

  it('빈 닉네임·모르는 방식은 400이고 아무것도 쓰지 않는다', async () => {
    expect((await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '  ' })).status).toBe(400);
    expect((await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'anon' })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // 이 기능 전에 열어 둔 화면은 방식 없이 공개만 켠다. 그때 표시 이름을 실명으로 되돌리면
  // 닉네임을 골라 둔 사람이 토글 한 번에 실명으로 공개된다.
  it('방식 없이 공개만 켜면 저장된 표시 이름을 건드리지 않는다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ fundingPledge: { paymentMethod: 'toss', publicName: '옛닉' } }));
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true });
    expect(set.mock.calls[0][0]).not.toHaveProperty('publicName');
    expect(r.body.publicName).toBe('옛닉');
  });

  it('공개를 끌 때는 방식이 와도 표시 이름을 건드리지 않는다', async () => {
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false, publicNameStyle: 'nickname', publicNickname: '새닉' });
    expect(set.mock.calls[0][0]).not.toHaveProperty('publicName');
  });
});
