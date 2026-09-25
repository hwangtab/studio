/** @jest-environment node */
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../db/client', () => ({ getDb: jest.fn() }));
jest.mock('../../../lib/funding/email', () => ({ sendFundingListingNicknameAlert: jest.fn().mockResolvedValue(null) }));
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/funding/display-name';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';
import { getDb } from '../../../db/client';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { sendFundingListingNicknameAlert } from '../../../lib/funding/email';

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

/**
 * 결제 뒤에 바꾼 닉네임은 확정 메일에 없어서, 운영자가 알 길이 없었다. 닉네임으로 새로 명단에
 * 오르면(공개를 켰거나 닉네임이 바뀌면) 운영자에게 알린다.
 */
describe('운영자 닉네임 알림', () => {
  const pledge = (over: Record<string, unknown>) => order({ fundingPledge: { paymentMethod: 'toss', publicName: null, displayNamePublic: false, supporterMessage: '응원', ...over } });

  it('닉네임으로 새로 공개하면 알린다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(pledge({}));
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '청취자' });
    expect(sendFundingListingNicknameAlert).toHaveBeenCalledWith(expect.anything(), '청취자', '응원');
  });

  it('공개 중에 닉네임을 바꾸면 알린다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(pledge({ displayNamePublic: true, publicName: '옛닉' }));
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '새닉' });
    expect(sendFundingListingNicknameAlert).toHaveBeenCalledTimes(1);
  });

  it('같은 닉네임 재저장·가린 이름·실명·내리기는 알리지 않는다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(pledge({ displayNamePublic: true, publicName: '같은닉' }));
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '같은닉' });
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'masked' });
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'real' });
    await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false });
    expect(sendFundingListingNicknameAlert).not.toHaveBeenCalled();
  });

  // 설정은 이미 저장됐다 — 메일 실패로 에러를 주면 후원자는 저장이 안 된 줄 안다.
  it('알림이 실패해도 200', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(pledge({}));
    (sendFundingListingNicknameAlert as jest.Mock).mockRejectedValueOnce(new Error('resend down'));
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '청취자' });
    expect(r.status).toBe(200);
  });
});

/**
 * `listing_hidden_at`은 공개 동의와 별개의 축이고 운영자만 되돌린다. 이 경로가 그 값을 보지
 * 않던 동안 **켜는** 저장이 200으로 성공해 화면이 "명단에 올렸습니다"라고 답했는데, 명단 조회는
 * `listing_hidden_at IS NULL`을 요구하므로 실제로는 영영 뜨지 않았다.
 */
describe('운영자가 명단에서 내린 펀딩', () => {
  const hidden = (over: Record<string, unknown> = {}) =>
    order({ fundingPledge: { paymentMethod: 'toss', publicName: null, displayNamePublic: true, listingHiddenAt: new Date('2026-09-20T00:00:00Z'), ...over } });

  it.each([
    ['올리기', { displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '청취자' }],
    ['표시 이름 저장', { displayNamePublic: true, publicNameStyle: 'masked' }],
  ])('%s처럼 켜는 요청은 409로 거부하고 아무것도 저장하지 않는다', async (_label, body) => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(hidden());
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', ...body });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ ok: false, code: 'listing_hidden' });
    expect(update).not.toHaveBeenCalled();
    expect(sendFundingListingNicknameAlert).not.toHaveBeenCalled();
  });

  /**
   * 약관 제13조 2항이 이 화면에서 약속한 철회다 — 운영자가 내려 뒀다는 사정이 후원자의
   * 철회권을 없앨 이유는 없고, 끄는 것은 공개를 늘리지 않으므로 새는 정보도 없다.
   */
  it('끄는 요청은 통과해 저장한다 — 철회권을 막지 않는다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(hidden());
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, displayNamePublic: false });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ displayNamePublic: false }));
  });
});

/**
 * 위 검사를 통과한 뒤 UPDATE 전까지의 밀리초 창 — 그 사이 운영자가 내리면 조건 없는 UPDATE가
 * 성공해 다시 거짓 성공을 준다. 켜는 요청의 WHERE에 `listing_hidden_at IS NULL`을 싣는다.
 */
describe('조회와 UPDATE 사이에 운영자가 내린 경우', () => {
  it('켜는 요청이 0행이면 409', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    where.mockResolvedValueOnce({ rowsAffected: 0 });
    const r = await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'nickname', publicNickname: '청취자' });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ ok: false, code: 'listing_hidden' });
    expect(sendFundingListingNicknameAlert).not.toHaveBeenCalled();
  });

  // 끄는 요청에는 그 조건을 걸지 않으므로 0행 판정도 하지 않는다.
  it('끄는 요청은 0행이어도 200', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    where.mockResolvedValueOnce({ rowsAffected: 0 });
    expect((await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: false })).status).toBe(200);
  });

  // 판정 불가(rowsAffected를 못 읽는 드라이버·목)는 성공으로 흘린다 — rowsAffectedOf의 규약.
  it('rowsAffected를 읽을 수 없으면 성공으로 본다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    where.mockResolvedValueOnce(undefined);
    expect((await call({ orderNo: 'FND-1', token: 'correct-token', displayNamePublic: true, publicNameStyle: 'masked' })).status).toBe(200);
  });
});
