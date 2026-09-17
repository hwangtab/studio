/**
 * @jest-environment node
 *
 * jsdom 환경은 iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator/auth';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

describe('funding creator 착지(auth) getServerSideProps', () => {
  // funding의 다른 SSR 형제 페이지와 같은 자리, 같은 방식(ko 전용 → 비-ko는 ko로 되돌림).
  // 다른 형제(manage/[orderNo])와 달리 여기서는 쿼리(토큰)를 반드시 그대로 들고 가야
  // 한다 — 잃으면 이 착지 자체가 "링크가 만료됐거나 이미 쓰였다"로 오판되어 로그인이
  // 깨진다(2026-09-17 리뷰 지적).
  it('비-ko locale → /ko/funding/creator/auth로 토큰 쿼리를 보존한 채 redirect', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en' },
      query: { token: 'raw-token-value' },
      resolvedUrl: '/en/funding/creator/auth?token=raw-token-value',
      req: { headers: {}, cookies: {} },
      res,
    } as never);
    expect(result).toEqual({
      redirect: { destination: '/ko/funding/creator/auth?token=raw-token-value', permanent: false },
    });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('쿼리가 없어도 안전하다(? 없이 redirect)', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en' },
      query: {},
      resolvedUrl: '/en/funding/creator/auth',
      req: { headers: {}, cookies: {} },
      res,
    } as never);
    expect(result).toEqual({
      redirect: { destination: '/ko/funding/creator/auth', permanent: false },
    });
  });
});
