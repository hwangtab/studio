import { isPrivateAnalyticsPath } from './privatePaths';

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
});
