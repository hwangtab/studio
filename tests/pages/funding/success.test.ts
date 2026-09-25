/** @jest-environment node */
jest.mock('../../../lib/funding/confirm', () => ({ confirmFundingPledge: jest.fn() }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));
jest.mock('../../../lib/booking/rate-limit', () => ({ consumeRateLimit: jest.fn().mockResolvedValue(true) }));

import { getServerSideProps } from '../../../pages/[locale]/funding/success';
import { consumeRateLimit } from '../../../lib/booking/rate-limit';
import { confirmFundingPledge } from '../../../lib/funding/confirm';
import { findFundingOrderByOrderNo } from '../../../lib/funding/service';

/**
 * 펀딩 전환이 GA4·Vercel에 닿지 않던 문제(항목 6).
 *
 * success는 토스 승인 URL(paymentKey·orderId·amount)을 그대로 렌더해 측정 제외 경로였고,
 * `funding_pledge_paid`는 큐에만 쌓이다 탭을 닫으면 사라졌다 — 퍼널이 진입 100%·결제 0%.
 * 이제 확정을 끝낸 뒤 **비밀값 없는 `?o=<주문번호>`로 리다이렉트**하고 거기서 측정한다.
 * 관리 토큰은 URL이 아니라 httpOnly 쿠키로 넘어간다.
 */
const ORDER_NO = 'FND-20261015-ABCD1234';
const TOKEN = 'manage-token-abc';

const ctx = (query: Record<string, string>, cookies: Record<string, string> = {}) => {
  const res = { setHeader: jest.fn() };
  return {
    res,
    run: () => getServerSideProps({
      params: { locale: 'ko' }, query, res,
      req: { cookies, headers: { 'x-vercel-forwarded-for': '203.0.113.9' }, socket: {} },
    } as never),
  };
};
const cookieHeader = (res: { setHeader: jest.Mock }): string | undefined =>
  res.setHeader.mock.calls.find(([k]: [string]) => k === 'Set-Cookie')?.[1];

const order = (over: Record<string, unknown> = {}) => ({
  orderNo: ORDER_NO, manageToken: TOKEN, status: 'paid', notificationError: null,
  fundingPledge: { projectSlug: 'demo' }, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (consumeRateLimit as jest.Mock).mockResolvedValue(true);
});

describe('토스 승인 URL', () => {
  it('확정되면 비밀값 없는 ?o= 로 리다이렉트하고 토큰은 httpOnly 쿠키로 넘긴다', async () => {
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: ORDER_NO, manageToken: TOKEN, projectSlug: 'demo' });
    const c = ctx({ paymentKey: 'pk_live_abc', orderId: ORDER_NO, amount: '30000' });
    const result = (await c.run()) as { redirect: { destination: string } };
    expect(result.redirect.destination).toBe(`/ko/funding/success?o=${ORDER_NO}`);
    expect(result.redirect.destination).not.toContain(TOKEN);
    expect(result.redirect.destination).not.toContain('pk_live_abc');
    const cookie = cookieHeader(c.res)!;
    expect(cookie).toContain('fnd_confirm=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(`Path=/ko/funding/success`);
    expect(cookie).toContain('Max-Age=1800');
    // 로컬(http)에서는 Secure를 붙이면 브라우저가 쿠키를 아예 저장하지 않는다.
    expect(cookie).not.toContain('Secure');
  });

  it('프로덕션에서는 Secure를 붙인다', async () => {
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: ORDER_NO, manageToken: TOKEN, projectSlug: 'demo' });
    const original = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
    try {
      const c = ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '30000' });
      await c.run();
      expect(cookieHeader(c.res)).toContain('Secure');
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
    }
  });

  /**
   * 실패도 그 자리에서 렌더하면 안 된다 — 이 경로는 측정 대상이라
   * `?paymentKey=…&orderId=…`가 GA4의 page_location에 그대로 적재된다. 결제창을 오래 열어
   * 뒀다 승인하거나(hold_expired) 카드사가 거절하면(toss_rejected) 실제 paymentKey가 남는다.
   */
  it('확정 실패도 비밀값 없는 ?e= 로 리다이렉트하고 쿠키를 세우지 않는다', async () => {
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'hold_expired', message: '결제 대기 시간이 만료된 펀딩입니다.' });
    const c = ctx({ paymentKey: 'pk_live_abc', orderId: ORDER_NO, amount: '1' });
    const result = (await c.run()) as { redirect: { destination: string } };
    expect(result.redirect.destination).toBe('/ko/funding/success?e=hold_expired');
    expect(result.redirect.destination).not.toContain('pk_live_abc');
    expect(result.redirect.destination).not.toContain(ORDER_NO);
    expect(cookieHeader(c.res)).toBeUndefined();
  });
});

describe('리다이렉트된 실패 화면(?e=)', () => {
  it('코드를 우리 문구로 옮긴다', async () => {
    const result = (await ctx({ e: 'hold_expired' }).run()) as { props: { outcome: string; message: string } };
    expect(result.props.outcome).toBe('error');
    expect(result.props.message).toBe('결제 대기 시간이 만료된 펀딩입니다. 다시 펀딩해 주세요.');
  });

  it('모르는 코드·형식 밖 코드는 일반 문구 — 쿼리 문자열을 그대로 뿌리지 않는다', async () => {
    const injected = (await ctx({ e: '환불 문의: 010-0000-0000' }).run()) as { props: { message: string } };
    expect(injected.props.message).toBe('결제를 확정하지 못했습니다.');
    expect((await ctx({ e: 'made_up' }).run()) as { props: { message: string } }).toMatchObject({ props: { message: '결제를 확정하지 못했습니다.' } });
  });
});

describe('리다이렉트된 화면(?o=)', () => {
  it('쿠키의 토큰이 맞으면 확정 화면과 관리 링크를 준다 — confirm은 다시 부르지 않는다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as {
      props: { outcome: string; manageUrl: string; projectSlug: string; emailSent: boolean };
    };
    expect(result.props.outcome).toBe('confirmed');
    expect(result.props.manageUrl).toBe(`/ko/funding/manage/${ORDER_NO}?token=${TOKEN}`);
    expect(result.props.projectSlug).toBe('demo');
    expect(result.props.emailSent).toBe(true);
    // 멱등성 — 승인 URL이 아니므로 새로고침해도 결제 승인을 다시 시도하지 않는다.
    expect(confirmFundingPledge).not.toHaveBeenCalled();
  });

  it('확정 메일이 아직 안 나갔으면(센티널·오류) 링크를 저장하라고 알린다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ notificationError: 'send_pending' }));
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as { props: { emailSent: boolean } };
    expect(result.props.emailSent).toBe(false);
  });

  it('쿠키가 없으면 DB를 조회하지 않되, 주문번호는 화면에 되돌려준다', async () => {
    const result = (await ctx({ o: ORDER_NO }).run()) as { props: { outcome: string; orderNo: string } };
    expect(result.props.outcome).toBe('unknown');
    // 쿠키가 막힌 브라우저에서도 결제한 사람이 문의할 근거는 남아야 한다.
    expect(result.props.orderNo).toBe(ORDER_NO);
    expect(findFundingOrderByOrderNo).not.toHaveBeenCalled();
  });

  // Next가 이미 디코드해 준 값을 다시 디코드하면 손상된 쿠키 하나로 500이 난다.
  it('쿠키 값이 깨져 있어도 500이 아니라 unknown으로 떨어진다', async () => {
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: '%E0%A4%A' }).run()) as { props: { outcome: string } };
    expect(result.props.outcome).toBe('unknown');
  });

  it('다른 주문의 쿠키로는 열 수 없다', async () => {
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: `FND-20261015-OTHER123.${TOKEN}` }).run()) as { props: { outcome: string } };
    expect(result.props.outcome).toBe('unknown');
    expect(findFundingOrderByOrderNo).not.toHaveBeenCalled();
  });

  it('쿠키의 토큰이 주문과 다르면 unknown', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order());
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.wrong-token` }).run()) as { props: { outcome: string } };
    expect(result.props.outcome).toBe('unknown');
  });

  it('주문번호 형식이 아니면 error', async () => {
    const result = (await ctx({ o: '<script>' }).run()) as { props: { outcome: string } };
    expect(result.props.outcome).toBe('error');
  });

  /**
   * 확정 직후 30분 창 안에 운영자가 명단에서 내리는 일은 드물지만 있다. 값을 안 넘기면 이
   * 화면은 무조건 "명단에 올라갑니다"로 단정한다.
   */
  it.each([
    ['운영자가 내렸으면 true', new Date('2026-09-20T00:00:00Z'), true],
    ['내리지 않았으면 false', null, false],
  ])('명단 숨김 상태를 그대로 넘긴다 — %s', async (_label, listingHiddenAt, expected) => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(
      order({ fundingPledge: { projectSlug: 'demo', displayNamePublic: true, publicName: null, supporterMessage: null, listingHiddenAt } }),
    );
    const result = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as {
      props: { listing: { hiddenByOperator: boolean } };
    };
    expect(result.props.listing.hiddenByOperator).toBe(expected);
  });
});

it('쿼리가 없으면 잘못된 접근', async () => {
  const result = (await ctx({}).run()) as { props: { outcome: string; message: string } };
  expect(result.props).toMatchObject({ outcome: 'error', message: '잘못된 접근입니다.' });
});

it('비-ko locale은 펀딩 목록으로 보낸다', async () => {
  const res = { setHeader: jest.fn() };
  const result = await getServerSideProps({ params: { locale: 'en' }, query: {}, req: { cookies: {} }, res } as never);
  expect(result).toEqual({ redirect: { destination: '/ko/funding', permanent: false } });
});

it('언제나 no-store로 내린다 — HTML에 관리 토큰이 들어간다', async () => {
  const c = ctx({});
  await c.run();
  expect(c.res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
});

/**
 * 승인 URL은 인증이 없다. `?paymentKey=아무거나&orderId=<주문번호>&amount=N`을 열면 응답이
 * 오류 코드별로 갈려, amount를 이분 탐색하면 남의 결제 금액(=고른 리워드 티어)을 알아낼 수
 * 있었다. 다른 후원자 API 셋에는 전부 IP 레이트리밋이 있는데 이 경로에만 없었다.
 */
describe('실패 응답 레이트리밋', () => {
  it('훑기로 나오는 실패에만 카운터를 소비한다', async () => {
    for (const code of ['not_found', 'invalid_state', 'amount_mismatch']) {
      (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code, message: 'm' });
      await ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '1' }).run();
    }
    expect((consumeRateLimit as jest.Mock).mock.calls).toHaveLength(3);
    expect((consumeRateLimit as jest.Mock).mock.calls[0][0]).toBe('funding_confirm_fail:203.0.113.9');
  });

  it('toss_rejected는 세지 않는다 — 실제 결제 실패이고 재시도가 정상 행동이다', async () => {
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'toss_rejected', message: 'm' });
    const r = (await ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '1' }).run()) as { redirect: { destination: string } };
    expect(r.redirect.destination).toBe('/ko/funding/success?e=toss_rejected');
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it('한도를 넘으면 코드를 구분하지 않는 일반 오류로 떨어뜨린다', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'amount_mismatch', message: 'm' });
    const r = (await ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '1' }).run()) as { redirect: { destination: string } };
    expect(r.redirect.destination).toBe('/ko/funding/success?e=too_many');
    const shown = (await ctx({ e: 'too_many' }).run()) as { props: { message: string } };
    expect(shown.props.message).toContain('요청이 너무 잦습니다');
  });

  it('성공 경로는 한도와 무관하다 — 결제 승인이 429로 막히면 안 된다', async () => {
    (consumeRateLimit as jest.Mock).mockResolvedValue(false);
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: true, orderNo: ORDER_NO, manageToken: TOKEN, projectSlug: 'demo' });
    const r = (await ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '30000' }).run()) as { redirect: { destination: string } };
    expect(r.redirect.destination).toBe(`/ko/funding/success?o=${ORDER_NO}`);
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });
});

/**
 * 확정 쿠키는 30분 살아 있다. 그 사이 취소하고 새로고침하면 예전에는 "펀딩이
 * 확정되었습니다"와 내려받기 폼이 그대로 다시 떴다. 판정은 manage 화면과 같은
 * isLiveFundingOrderStatus를 쓴다.
 */
describe('살아 있지 않은 후원(?o=)', () => {
  it('환불된 건에는 확정 문구도 내려받기 폼도 없다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'refunded' }));
    const r = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as {
      props: { outcome: string; statusLabel: string; downloads?: unknown; manageUrl: string };
    };
    expect(r.props.outcome).toBe('not_live');
    expect(r.props.statusLabel).toBe('환불 완료');
    expect(r.props.downloads).toBeUndefined();
    expect(r.props.manageUrl).toBe(`/ko/funding/manage/${ORDER_NO}?token=${TOKEN}`);
  });

  it('만료·실패도 같다', async () => {
    for (const [status, label] of [['expired', '만료'], ['failed', '결제 실패']]) {
      (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status }));
      const r = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as { props: { outcome: string; statusLabel: string } };
      expect(r.props).toMatchObject({ outcome: 'not_live', statusLabel: label });
    }
  });

  it('부분 환불은 아직 살아 있는 후원이라 확정 화면 그대로다', async () => {
    (findFundingOrderByOrderNo as jest.Mock).mockResolvedValue(order({ status: 'partially_refunded' }));
    const r = (await ctx({ o: ORDER_NO }, { fnd_confirm: `${ORDER_NO}.${TOKEN}` }).run()) as { props: { outcome: string } };
    expect(r.props.outcome).toBe('confirmed');
  });
});
