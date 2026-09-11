/** @jest-environment node */
jest.mock('../../../lib/funding/confirm', () => ({ confirmFundingPledge: jest.fn() }));
jest.mock('../../../lib/funding/service', () => ({ findFundingOrderByOrderNo: jest.fn() }));

import { getServerSideProps } from '../../../pages/[locale]/funding/success';
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
    run: () => getServerSideProps({ params: { locale: 'ko' }, query, req: { cookies }, res } as never),
  };
};
const cookieHeader = (res: { setHeader: jest.Mock }): string | undefined =>
  res.setHeader.mock.calls.find(([k]: [string]) => k === 'Set-Cookie')?.[1];

const order = (over: Record<string, unknown> = {}) => ({
  orderNo: ORDER_NO, manageToken: TOKEN, status: 'paid', notificationError: null,
  fundingPledge: { projectSlug: 'demo' }, ...over,
});

beforeEach(() => jest.clearAllMocks());

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
  });

  it('확정 실패는 화면에 남고 쿠키를 세우지 않는다', async () => {
    (confirmFundingPledge as jest.Mock).mockResolvedValue({ ok: false, code: 'invalid_state', message: '이미 처리되었거나 만료된 후원입니다.' });
    const c = ctx({ paymentKey: 'pk', orderId: ORDER_NO, amount: '1' });
    const result = (await c.run()) as { props: { outcome: string; message: string } };
    expect(result.props.outcome).toBe('error');
    expect(result.props.message).toContain('이미 처리되었거나');
    expect(cookieHeader(c.res)).toBeUndefined();
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

  it('쿠키가 없으면 DB를 조회하지 않는다 — 주문번호만으로는 아무 것도 열리지 않는다', async () => {
    const result = (await ctx({ o: ORDER_NO }).run()) as { props: { outcome: string } };
    expect(result.props.outcome).toBe('unknown');
    expect(findFundingOrderByOrderNo).not.toHaveBeenCalled();
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
});

it('쿼리가 없으면 잘못된 접근', async () => {
  const result = (await ctx({}).run()) as { props: { outcome: string; message: string } };
  expect(result.props).toEqual({ outcome: 'error', message: '잘못된 접근입니다.' });
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
