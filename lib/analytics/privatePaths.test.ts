import { isPrivateAnalyticsPath, MEASURED_PRIVATE_PAGE_ROUTES, PRIVATE_NO_STORE_SOURCES } from './privatePaths';

describe('isPrivateAnalyticsPath', () => {
  it('관리 토큰·paymentKey가 실리는 경로는 측정 대상에서 뺀다', () => {
    for (const path of [
      '/ko/funding/manage/FND-20261015-ABCD1234?token=secret',
      '/ko/funding/deposit/FND-20261015-ABCD1234?token=secret',
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
    expect(isPrivateAnalyticsPath('/ko/funding/deposit/FND-1#top')).toBe(true);
    expect(isPrivateAnalyticsPath('')).toBe(false);
  });

  /**
   * 펀딩 success는 확정 뒤 비밀값 없는 `?o=<주문번호>`로 리다이렉트하므로 **렌더되는 순간의
   * URL에 토큰·paymentKey가 없다.** 측정에서 빼 두면 funding_pledge_paid가 큐에만 쌓이다
   * 탭을 닫을 때 사라져 퍼널이 진입 100%·결제 0%로 보인다 — 그래서 이 경로만 예외다.
   * no-store는 그대로 유지된다(HTML에는 관리 토큰이 들어간다).
   */
  it('펀딩 success는 측정 대상이다 — 확정 뒤 비밀값 없는 URL로 리다이렉트하기 때문', () => {
    expect(isPrivateAnalyticsPath('/ko/funding/success')).toBe(false);
    expect(isPrivateAnalyticsPath('/ko/funding/success?o=FND-20261015-ABCD1234')).toBe(false);
    expect(isPrivateAnalyticsPath('/ko/funding/success#top')).toBe(false);
    expect(MEASURED_PRIVATE_PAGE_ROUTES).toEqual(['/[locale]/funding/success']);
  });

  /**
   * 예외는 **경로**에 거는 것이지 "이 경로는 무조건 안전하다"는 선언이 아니다. 실패 분기
   * 하나가 승인 URL을 그 자리에서 렌더하면 그대로 paymentKey가 측정에 적재된다 — 실제로
   * 이 예외를 처음 넣었을 때 확정 실패 경로가 그랬다. 비밀값 이름이 쿼리에 보이면 예외를
   * 취소하고 측정에서 뺀다.
   */
  it('비밀값이 쿼리에 있으면 예외를 취소한다 — 안전한 쪽으로 틀린다', () => {
    expect(isPrivateAnalyticsPath('/ko/funding/success?paymentKey=x')).toBe(true);
    expect(isPrivateAnalyticsPath('/ko/funding/success?orderId=FND-1&amount=1')).toBe(true);
    expect(isPrivateAnalyticsPath('/ko/funding/success?token=secret')).toBe(true);
    expect(isPrivateAnalyticsPath('/ko/funding/success?paymentKey=x#top')).toBe(true);
    // 우리가 만드는 URL 두 가지는 그대로 측정된다.
    expect(isPrivateAnalyticsPath('/ko/funding/success?o=FND-20261015-ABCD1234')).toBe(false);
    expect(isPrivateAnalyticsPath('/ko/funding/success?e=hold_expired')).toBe(false);
  });

  // 예외는 펀딩 success 하나뿐이다 — booking success는 토스 승인 URL을 그대로 렌더한다.
  it('예약 success·펀딩 fail은 여전히 측정 제외다', () => {
    expect(isPrivateAnalyticsPath('/ko/booking/success?paymentKey=pk_abc')).toBe(true);
    expect(isPrivateAnalyticsPath('/ko/funding/fail?orderId=FND-1')).toBe(true);
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
