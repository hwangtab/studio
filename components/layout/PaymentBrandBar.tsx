import Image from 'next/image';

import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';

/**
 * 결제 결과·후원 확인처럼 **사이트 헤더를 두르지 않는 화면**의 브랜드 바.
 *
 * 이 화면들은 "한 가지 일만 하러 온 자리"라 내비게이션을 걷어냈는데(Layout의 isBareLayout),
 * 그 결과 흰 바탕에 카드 하나만 뜨는 모양이 됐다. 결제를 막 마친 사람에게는 **결제대행사
 * 페이지처럼 보여** 그대로 닫고 나가게 된다 — 걷어내려던 이탈을 오히려 부른다.
 *
 * 그래서 내비게이션은 계속 두지 않고 **브랜드만** 되돌린다. 로고 하나로 "여기는 아직
 * 스튜디오 놀"이라고 말하는 것이 목적이다.
 *
 * **링크는 반드시 평범한 `<a>`다.** 이 화면들의 URL에는 관리 토큰이 실린다. next/link로
 * 클라이언트 전환을 하면 공개 페이지에 나갔다 뒤로 왔을 때 그 사이 mount된 gtag가 살아
 * 있는 채로 돌아와 이 화면의 상태를 다시 측정한다(lib/analytics/privatePaths.ts,
 * 회귀 테스트 tests/pages/privateLinkNavigation.test.ts). `rel="noreferrer"`도 같은 이유 —
 * 도착지의 page_referrer에 주문번호를 실어 보내지 않는다.
 */
export const PaymentBrandBar = ({ locale, isDarkMode }: { locale: Locale; isDarkMode: boolean }) => {
  const siteConfig = getSiteConfig(locale);
  return (
    <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <a
          href={`/${locale}`}
          rel="noreferrer"
          aria-label={siteConfig.name}
          className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 dark:focus-visible:ring-primary-lighter/70 dark:focus-visible:ring-offset-gray-900"
        >
          {/* HeaderBrand와 같은 두 장 겹치기 — 'studio'만 다크에서 흰색으로 뒤집는다. */}
          <span className="relative flex h-8 w-auto items-center">
            <Image src={siteConfig.logo} alt="" aria-hidden="true" height={862} width={3350} sizes="200px"
              className="h-full w-auto object-contain" style={{ clipPath: 'inset(0 0 0 52.3%)' }} />
            <Image src={siteConfig.logo} alt="" aria-hidden="true" height={862} width={3350} sizes="200px"
              className="absolute left-0 top-0 h-full w-auto object-contain"
              style={{ clipPath: 'inset(0 47.7% 0 0)', filter: isDarkMode ? 'brightness(0) invert(1) brightness(1.2)' : 'none' }} />
          </span>
        </a>
      </div>
    </div>
  );
};
