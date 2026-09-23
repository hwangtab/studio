import React from 'react';
import { MessageCircle, Phone } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';

import { getSiteConfig } from '../../data/siteConfig';
import { CANONICAL_FACTS } from '../../lib/factTokens';
import type { Locale } from '../../lib/i18n';
import { trackLeadEvent } from '../../utils/analytics';

interface KakaoFabProps {
  locale: Locale;
  /**
   * 모바일·태블릿(<lg)에서만 숨긴다. 전폭 하단 고정 바가 뜨는 화면에서 같은 우하단 자리를
   * 두고 겹치기 때문이다. 데스크톱에는 그 바가 없으므로(바가 `lg:hidden`) FAB을 그대로 둔다
   * — 카카오는 GA4 기준 검증된 유일 전환 채널이라 필요 없는 화면에서까지 걷어내지 않는다.
   */
  suppressBelowLg?: boolean;
}

/**
 * 전 페이지 상시 노출 카카오톡 플로팅 버튼.
 *
 * 배경: GA4 90일 분석상 실질 전환은 lead_click_kakao 17건이 전부인데,
 * 상시 카카오 진입점이 stories 페이지(StickyBottomCTA)에만 있어 홈·연습실·
 * 가격 등 핵심 전환 페이지에서 진입점이 비어 있었다. 검증된 유일 전환 채널을
 * 모든 페이지·항상 노출해 전환 누수를 막는다.
 *
 * 위치: 우하단. ScrollToTop(bottom-24로 상향 조정됨)과 stack. z-40으로 두어
 * 스토리 페이지의 StickyBottomCTA(z-50 하단 바)가 뜰 때 그 아래에 위치.
 *
 * 첫 화면에서는 띄우지 않는다(2026-09). 홈·pricing·recording 히어로는 CTA 블록이
 * 뷰포트 하단에 놓이는데 FAB이 정확히 그 자리라, 모바일에서 히어로 CTA 두 개를 통째로
 * 덮고 있었다. 히어로 1차 버튼이 이미 카카오 목적지라 **같은 목적지 버튼이 자기 자신을
 * 가리는** 상태였다. 스크롤 300px을 넘어야 뜨게 하면 겹침도 중복 노출도 사라지고,
 * 첫 화면 진입점은 헤더의 상시 옐로 CTA(HeaderActions)가 이미 맡고 있어 비지 않는다.
 * 임계·rAF 스로틀·opacity 토글은 ScrollToTop과 같은 장치다(iOS Safari 잔존 깜빡 회피).
 *
 * 전화 버튼을 카카오 왼쪽에 함께 둔다(2026-08). 리드의 90%가 카카오 단일 채널에 몰린 건
 * 고객 선호가 아니라 상시 노출이 카카오뿐이었기 때문일 가능성이 크다 — 40~60대 로컬
 * 고객은 오픈채팅보다 전화를 쓴다. 세로로 쌓지 않고 가로로 붙이는 이유는 ScrollToTop과의
 * 수직 stack을 건드리지 않기 위해서다. 두 버튼 모두 솔리드라 blur 예산(상시 고정 레이어
 * ≤2)에도 영향이 없다.
 */
/** 히어로 CTA 블록이 FAB 자리를 벗어나는 지점. ScrollToTop과 같은 값을 쓴다. */
const REVEAL_AFTER_PX = 300;

const KakaoFab = ({ locale, suppressBelowLg = false }: KakaoFabProps) => {
  const { t } = useTranslation('common', { lng: locale });
  const siteConfig = React.useMemo(() => getSiteConfig(locale), [locale]);

  // FAB 전용 키(actions.kakaoFab/actions.callFab). actions.kakao는 다른 곳에서
  // '카카오톡' 자체를 지칭하는 값이라 재사용하면 단일 소스가 깨진다(코드리뷰 후속).
  const label = t('actions.kakaoFab');

  const phoneLabel = t('actions.callFab');
  // 국제표기(+82)로 두면 국내·해외 어디서 눌러도 정상 연결된다.
  const telHref = `tel:${CANONICAL_FACTS.phoneIntl.replace(/[^0-9+]/g, '')}`;

  const handleClick = React.useCallback(() => {
    trackLeadEvent('lead_click_kakao', {
      locale,
      component: 'KakaoFab',
      cta_id: 'global_fab',
    });
  }, [locale]);

  const handlePhoneClick = React.useCallback(() => {
    trackLeadEvent('lead_click_phone', {
      locale,
      component: 'KakaoFab',
      cta_id: 'global_fab_phone',
    });
  }, [locale]);

  // 항상 mount한 채 opacity·pointer-events만 토글한다 — mount/unmount는 iOS Safari에서
  // paint jank를 남긴다(ScrollToTop과 같은 판단). rAF 스로틀로 경계 근처 thrashing 차단.
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    let rafId = 0;
    let pending = false;
    const update = () => {
      pending = false;
      const next = window.scrollY > REVEAL_AFTER_PX;
      setRevealed((prev) => (prev !== next ? next : prev));
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = window.requestAnimationFrame(update);
    };
    // 새로고침으로 중간 지점에 복원된 경우를 위해 초기 1회 평가한다.
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      className={`fixed right-6 z-40 items-center gap-2 transition-opacity duration-200 ${suppressBelowLg ? 'hidden lg:flex' : 'flex'} ${revealed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!revealed}
    >
      <a
        href={telHref}
        onClick={handlePhoneClick}
        aria-label={phoneLabel}
        tabIndex={revealed ? 0 : -1}
        className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-full bg-white dark:bg-gray-800 text-primary dark:text-primary-lighter border border-gray-200 dark:border-gray-700 shadow-lg shadow-black/20 touch-manipulation transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-primary-lighter focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <Phone size={22} aria-hidden="true" />
      </a>
      <a
        href={siteConfig.contact.kakaoUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label={label}
        tabIndex={revealed ? 0 : -1}
        className="inline-flex items-center gap-2 rounded-full bg-kakao hover:bg-kakao-dark text-kakao-ink shadow-lg shadow-black/20 w-[52px] justify-center py-3 sm:w-auto sm:justify-start sm:pl-4 sm:pr-5 min-h-[52px] font-bold touch-manipulation transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kakao-ink dark:focus-visible:ring-kakao focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
      >
        <MessageCircle size={22} aria-hidden="true" className="flex-shrink-0" />
        {/* aria-label이 이름을 들고 있으므로 좁은 폭에서는 라벨을 감춰도 접근성이 유지된다. */}
        <span className="hidden sm:inline text-sm whitespace-nowrap">{label}</span>
      </a>
    </div>
  );
};

export default React.memo(KakaoFab);
