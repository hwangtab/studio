import { isPrivateAnalyticsPath, MEASURED_PRIVATE_PAGE_ROUTES, PRIVATE_NO_STORE_SOURCES } from './privatePaths';

describe('isPrivateAnalyticsPath', () => {
  it('관리 토큰·paymentKey가 실리는 경로는 측정 대상에서 뺀다', () => {
    for (const path of [
      '/ko/funding/manage/FND-20261015-ABCD1234?token=secret',
      '/en/booking/manage/SNB-1?token=secret',
      '/uz/booking/success?paymentKey=pk_abc',
      '/ko/contracts/abc123',
      '/ko/contracts',
      // fail에는 토스가 orderId(=주문번호)를 붙인다 — success와 같은 등급으로 제외한다.
      '/ko/funding/fail?code=PAY_PROCESS_CANCELED&orderId=FND-20261015-ABCD1234',
      '/ko/funding/fail',
      '/en/booking/fail?orderId=SNB-1',
      // 정기결제(구독) — setupToken·manageToken이 쿼리에 실린다. manageToken은 만료도
      // 1회성도 없고 그 값 하나로 결제 이력 열람·해지·새 등록 토큰 발급까지 된다.
      '/ko/subscribe/sub_abc?token=setup_secret',
      '/ko/subscribe/sub_abc/success?token=s&customerKey=sub_abc&authKey=ak',
      '/ko/subscribe/sub_abc/fail?token=setup_secret',
      '/ko/subscribe/manage/sub_abc?token=manage_secret',
      // 개설자 매직링크 착지 화면 — `?token=`이 15분 유효 원문 그대로 실린다.
      '/ko/funding/creator/auth?token=magic_secret',
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
      // funding/creator 아래라도 착지 경로(auth)가 아니면 공개다 — 목록 페이지까지
      // 함께 좁혀지면 측정에서 조용히 빠진다.
      '/ko/funding/creator',
    ]) {
      expect(isPrivateAnalyticsPath(path)).toBe(false);
    }
  });

  it('해시·빈 문자열도 안전하게 처리한다', () => {
    expect(isPrivateAnalyticsPath('/ko/funding/manage/FND-1#top')).toBe(true);
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
      '/:locale(ko|en|zh|es|vi|th|uz)/funding/manage/:path*',
      '/:locale(ko|en|zh|es|vi|th|uz)/funding/creator/auth',
      '/:locale(ko|en|zh|es|vi|th|uz)/booking/(success|fail)',
      '/:locale(ko|en|zh|es|vi|th|uz)/booking/manage/:path*',
      '/:locale(ko|en|zh|es|vi|th|uz)/subscribe/:path*',
    ]);
    // pledge 폼은 no-store 전용 예외라 측정 제외 목록에는 없어야 한다.
    expect(isPrivateAnalyticsPath('/ko/funding/demo/pledge')).toBe(false);
  });

  /**
   * 관리자 화면은 `/[locale]/` 밖이라 로케일 정규식에 걸리지 않아, 처리방침 20항이
   * "관리자 화면에는 측정 스크립트를 싣지 않는다"고 적는 동안 실제로는 실리고 있었다.
   * 그 주소에는 프로젝트 id·주문번호·계약 id가 그대로 들어간다.
   */
  it('관리자 화면은 측정 대상에서 뺀다 — 로케일 접두사가 없어 위 목록에 안 걸린다', () => {
    for (const path of [
      '/admin',
      '/admin/login',
      '/admin/funding',
      '/admin/funding/01H8ZP?tab=payout',
      '/admin/bookings?orderNo=SNB-1',
      '/admin/contracts/abc123',
      '/admin/subscriptions',
      '/admin/artists',
      '/admin#top',
    ]) {
      expect(isPrivateAnalyticsPath(path)).toBe(true);
    }
  });

  it('`/admin`으로 시작하는 다른 단어의 공개 경로까지 먹지 않는다', () => {
    expect(isPrivateAnalyticsPath('/administrator')).toBe(false);
    expect(isPrivateAnalyticsPath('/ko/stories/admin-guide')).toBe(false);
  });

  // 관리자 화면은 no-store `source` 목록의 대상이 아니다 — 그 목록은 `/<locale>/<body>`
  // 꼴만 만들 수 있어 `/admin`을 넣으면 `/ko/admin`이라는 없는 주소의 규칙이 생긴다.
  it('관리자 화면을 빼도 no-store source 목록은 그대로다', () => {
    expect(PRIVATE_NO_STORE_SOURCES.some((source) => source.includes('admin'))).toBe(false);
  });
});
