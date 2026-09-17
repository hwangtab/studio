/**
 * @jest-environment node
 *
 * jsdom 환경은 iron-session이 의존하는 uncrypto를 ESM(.mjs)으로 풀어 파싱이 깨진다
 * (lib/funding/creatorAuth.test.ts와 같은 사유 — 이 페이지가 creatorAuth를 임포트한다).
 */
import { getServerSideProps } from '../../../../pages/[locale]/funding/creator';

const resStub = () => ({ setHeader: jest.fn() }) as unknown as import('http').ServerResponse;

describe('funding creator 목록 getServerSideProps', () => {
  // funding의 다른 SSR 형제 페이지(success·manage/[orderNo])와 같은 자리, 같은 방식 —
  // 세션 쿠키가 path=/라 로케일을 가리지 않으므로, 이 가드가 없으면 /en/funding/creator가
  // 인증 검사를 그대로 통과해 같은 화면이 7개 URL로 존재하게 된다(2026-09-17 리뷰 지적).
  // 인증 검사보다 먼저 걸려야 하므로 세션·DB 목이 없어도 이 리다이렉트가 나와야 한다.
  it('비-ko locale → /ko/funding/creator redirect (인증 검사보다 먼저)', async () => {
    const res = resStub();
    const result = await getServerSideProps({
      params: { locale: 'en' }, query: {}, req: { headers: {}, cookies: {} }, res,
    } as never);
    expect(result).toEqual({ redirect: { destination: '/ko/funding/creator', permanent: false } });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});
