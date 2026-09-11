import { isPrivateAnalyticsPath, PRIVATE_NO_STORE_SOURCES } from './privatePaths';

describe('isPrivateAnalyticsPath', () => {
  it('관리 토큰·paymentKey가 실리는 경로는 측정 대상에서 뺀다', () => {
    for (const path of [
      '/ko/funding/manage/FND-20261015-ABCD1234?token=secret',
      '/ko/funding/deposit/FND-20261015-ABCD1234?token=secret',
      '/ko/funding/success?paymentKey=pk_abc&orderId=FND-1',
      '/en/booking/manage/SNB-1?token=secret',
      '/uz/booking/success?paymentKey=pk_abc',
      '/ko/contracts/abc123',
      '/ko/contracts',
      // fail에는 토스가 orderId(=주문번호)를 붙인다 — success와 같은 등급으로 제외한다.
      '/ko/funding/fail?code=PAY_PROCESS_CANCELED&orderId=FND-20261015-ABCD1234',
      '/ko/funding/fail',
      '/en/booking/fail?orderId=SNB-1',
    ]) {
      expect(isPrivateAnalyticsPath(path)).toBe(true);
    }
  });

  it('일반 공개 경로는 그대로 측정한다', () => {
    for (const path of [
      '/ko',
      '/ko/funding',
      '/ko/funding/demo',
      '/ko/funding/demo/pledge',
      '/ko/stories/mixing1',
      '/ko/booking/recording',
      '/ko/pricing',
      // 로케일 세그먼트가 아닌 경로는 이 규칙의 대상이 아니다.
      '/funding/manage/FND-1',
    ]) {
      expect(isPrivateAnalyticsPath(path)).toBe(false);
    }
  });

  it('해시·빈 문자열도 안전하게 처리한다', () => {
    expect(isPrivateAnalyticsPath('/ko/funding/success#top')).toBe(true);
    expect(isPrivateAnalyticsPath('')).toBe(false);
  });

  // 측정 제외와 no-store 헤더가 갈라지면 "헤더는 막는데 측정은 새는" 조합이 조용히 생긴다
  // — funding/fail이 실제로 그랬다. next.config.mjs와의 대조는 noStoreHeaders.test.ts가 한다.
  it('no-store source 목록은 측정 제외와 같은 경로 집합에서 파생된다', () => {
    expect(PRIVATE_NO_STORE_SOURCES).toEqual([
      '/:locale(ko|en|zh|es|vi|th|uz)/contracts/:path*',
      '/:locale(ko|en|zh|es|vi|th|uz)/funding/(success|fail)',
      '/:locale(ko|en|zh|es|vi|th|uz)/funding/(deposit|manage)/:path*',
      '/:locale(ko|en|zh|es|vi|th|uz)/booking/(success|fail)',
      '/:locale(ko|en|zh|es|vi|th|uz)/booking/manage/:path*',
    ]);
    // pledge 폼은 no-store 전용 예외라 측정 제외 목록에는 없어야 한다.
    expect(isPrivateAnalyticsPath('/ko/funding/demo/pledge')).toBe(false);
  });
});
