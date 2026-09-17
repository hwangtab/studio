/**
 * @jest-environment node
 *
 * 이 페이지는 더 이상 creatorAuth·creatorToken을 직접 임포트하지 않지만(소진 로직이
 * session.ts로 옮겨 갔다), funding SSR 형제 테스트 전부가 node 환경을 쓰는 관례를
 * 따른다 — jsdom은 iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유).
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

  // 2026-09-17 리뷰 지적: 이 GSSP는 더 이상 토큰을 소진하지 않는다(GET 1회용이라 메일
  // 링크 검사기·미리보기 봇이 배달 시점에 태워 버리는 문제 — pages/api/funding/download.ts
  // 32~40번째 줄과 같은 함정). ko 요청은 토큰을 그대로 props로 넘기기만 한다. 실제 소진은
  // 화면의 버튼이 부르는 pages/api/funding/creator/session.ts(POST)가 맡고, 그 단언은
  // tests/api/funding/creator/session.test.ts로 옮겼다.
  it('ko + 토큰 있음 → 소진하지 않고 props로 그대로 넘긴다', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko' },
      query: { token: 'raw-token-value' },
      resolvedUrl: '/ko/funding/creator/auth?token=raw-token-value',
      req: { headers: {}, cookies: {} },
      res,
    } as never);
    expect(result).toEqual({ props: expect.objectContaining({ token: 'raw-token-value' }) });
  });

  it('ko + 토큰 없음 → props.token은 null', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'ko' },
      query: {},
      resolvedUrl: '/ko/funding/creator/auth',
      req: { headers: {}, cookies: {} },
      res,
    } as never);
    expect(result).toEqual({ props: expect.objectContaining({ token: null }) });
  });
});
