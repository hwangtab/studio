import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';
import { PaymentBrandBar } from './layout/PaymentBrandBar';
import { type Locale, defaultLocale } from '../lib/i18n';
import { isPrivatePageRoute } from '../lib/analytics/privatePaths';
import { isAdminRoute } from '../lib/adminRoute';

// 스크롤 인터랙션 보조 컴포넌트들은 첫 paint에 시각적 영향이 없어 hydration 후 lazy load.
// LCP/FCP 측정 창에서 빠지면서 _app/Layout 청크에서 분리.
const ScrollToTop = dynamic(() => import('./ui/ScrollToTop').then(m => m.ScrollToTop), { ssr: false });
// 전 페이지 상시 카카오 진입점. 검증된 유일 전환 채널을 모든 페이지에 노출.
const KakaoFab = dynamic(() => import('./common/KakaoFab'), { ssr: false });
// 관리자 화면 전용 라우트 전환 표시. dynamic + ssr:false라 다른 페이지는 청크를 받지 않는다.
const AdminRouteProgress = dynamic(() => import('./admin/RouteProgress'), { ssr: false });

interface LayoutProps {
  children: React.ReactNode;
  hasHero?: boolean;
  locale?: Locale;
}

// 헤더 높이는 80px 정적 처리(Tailwind pt-20). 이전엔 ResizeObserver로 실측 후
// setState했지만 hydration·re-render 비용이 PSI 데스크톱 TBT 1680ms·강제 리플로우
// 920ms의 잠재 원인이었다. 헤더 높이 변동 빈도가 낮고 첫 paint 후 발생이라 LCP
// 영향 없어 정적 처리로 충분. 헤더 스타일이 바뀌면 styles/globals.css의 page-main
// 또는 이 className을 같이 조정.

const Layout = ({ children, hasHero, locale = defaultLocale }: LayoutProps) => {
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [hasThemeLoaded, setHasThemeLoaded] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);


  // Consolidated Theme Management
  useEffect(() => {
    if (typeof document === 'undefined') return;
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    setHasThemeLoaded(true);
  }, []);

  // Theme 적용 및 theme-color 동적 갱신
  useEffect(() => {
    if (!hasThemeLoaded || typeof document === 'undefined') return;

    // 2. Apply Theme
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      localStorage.setItem('darkMode', String(isDarkMode));
    } catch {
      // Storage can be blocked in private browsing or hardened browser modes.
    }

    // 3. Update theme-color meta tag
    const themeColor = isDarkMode ? '#5b21b6' : '#6d28d9';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }

    // 4. Sync Lang
    document.documentElement.lang = locale;
  }, [isDarkMode, hasThemeLoaded, locale]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    let rafId: number | null = null;

    const handleScroll = () => {
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          const y = window.scrollY;
          setIsScrolled((prev) => {
            const next = y > 10;
            return prev !== next ? next : prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const isHome = router.pathname === '/[locale]';
  // 스토리 상세는 스크롤 시 StickyBottomCTA(하단 바)가 상시 카카오 CTA 역할을 하므로
  // 전역 KakaoFab을 숨겨 우하단 요소 중복·시각 충돌을 제거한다.
  const isStoryDetail = router.pathname === '/[locale]/stories/[id]';
  // 펀딩 후원 페이지는 결제 한 건만 하러 오는 화면이다. 계약 서명 화면과 같은 이유로
  // 떠 있는 버튼을 전부 치운다 — 폼과 결제 위젯이 화면 아래까지 차서 손가락이 닿는 자리가
  // 겹친다. 카카오 문의는 헤더 버튼으로 계속 갈 수 있다.
  const isFundingPledge = router.pathname === '/[locale]/funding/[slug]/pledge';
  /**
   * 전폭 하단 고정 바(FundingMobileCta)가 뜨는 건 후원 페이지가 아니라 **펀딩 상세**다.
   * 이 주석이 한동안 위 후원 페이지에 붙어 있었는데 사실이 아니었고(그 페이지는 바를 쓰지
   * 않는다), 그래서 정작 겹치는 상세 화면은 아무도 막지 않아 카카오 FAB이 「후원하기」
   * 버튼의 오른쪽 절반을 덮고 있었다. 바는 `lg:hidden`이라 데스크톱에는 없으므로 FAB도
   * 그 폭에서만 숨긴다.
   */
  const isFundingDetail = router.pathname === '/[locale]/funding/[slug]';
  /**
   * 계약 화면에서는 떠 있는 버튼을 전부 치운다.
   *
   * 서명 캔버스와 [계약서 서명 완료] 버튼이 화면 아래쪽에 있어, 우하단에 떠 있는 카카오
   * 버튼과 손가락이 닿는 자리가 겹친다. 서명하려다 카카오톡이 열리면 그리던 서명이 날아간다.
   * 계약 화면은 서명 하나만 하러 오는 곳이라 다른 데로 새게 할 이유도 없다.
   */
  const isContractPage = router.pathname.startsWith('/[locale]/contracts/');
  /**
   * 관리자 화면도 사이트 껍데기를 두르지 않는다.
   *
   * 로그인 화면에 릴리스·녹음 메뉴와 언어 전환기가 붙어 있을 이유가 없고, 푸터의 사업자
   * 정보·SNS 링크도 마찬가지다. 목록·상세는 이미 자기 헤더(보라색 바 + 로그아웃)를 갖고 있다.
   *
   * 세로 길이 문제도 여기서 온다 — 관리자 화면은 min-h-screen인데 고정 헤더 자리로 pt-20이
   * 더해져, 화면보다 80px + 푸터 높이만큼 길어져 있었다. 로그인 카드가 화면 정중앙이 아니라
   * 40px쯤 아래로 밀려 보이던 것이 그 때문이다.
   */
  const isAdminPage = isAdminRoute(router.pathname);

  /**
   * 결제·관리 화면도 사이트 껍데기를 두르지 않는다.
   *
   * URL에 관리 토큰·paymentKey·주문번호가 실리는 페이지들이다. 측정 스크립트는 `_app`이
   * mount하지 않지만(lib/analytics/privatePaths.ts), 그 게이팅은 `router.asPath` 기준이라
   * **클라이언트 전환으로 이 화면을 벗어나는 순간 무력해진다** — 공개 페이지에서 gtag가
   * mount되고, 뒤로가기로 돌아오면 토큰이 붙은 URL로 page_view가 나간다. 본문 링크를 전부
   * 문서 이동으로 바꿔도 헤더 로고·네비·푸터가 next/link라 그대로 재현되고, 실제로는 본문
   * "홈으로"보다 헤더 로고가 더 자주 눌린다.
   *
   * 계약 화면과 같은 판단이기도 하다 — 결제 결과·예약 확인은 한 가지 일만 하러 온 화면이라
   * 네비게이션은 새게 만들 뿐이고, 각 페이지가 자기 상단에서 브랜드를, 본문에서 이탈 경로를
   * 직접 밝힌다. `/funding/[slug]/pledge`는 결제 전 입력 폼이라 제외한다(위 파일 주석 참조).
   */
  const isPrivatePaymentPage = isPrivatePageRoute(router.pathname);

  /** 한 가지 일만 하러 온 화면 — 사이트 헤더·푸터·플로팅 버튼을 두르지 않는다. */
  const isBareLayout = isContractPage || isAdminPage || isPrivatePaymentPage;

  // 하단 고정 바가 없는 화면에서만 「맨 위로」와 카카오 FAB을 한 행으로 묶는다.
  const hasFloatingRow = !isStoryDetail && !isFundingDetail && !isFundingPledge && !isBareLayout;
  /**
   * 결제 결과·후원 확인 화면에는 **브랜드 바만** 되돌린다. 내비게이션을 걷어낸 것까지는
   * 맞았는데 그 결과가 '흰 바탕에 카드 하나'라, 결제를 막 마친 사람에게 결제대행사 화면처럼
   * 보여 그대로 닫고 나가게 된다. 계약 서명·관리자 화면은 그대로 둔다 — 거기는 외부에서
   * 들어오는 자리가 아니다.
   */
  const showPaymentBrandBar = isPrivatePaymentPage && !isContractPage && !isAdminPage;
  const textBreakClass = locale === 'ko' ? 'break-keep' : 'break-words';
  /**
   * 기본값을 들고 t()를 부른다. 관리자 화면은 사전을 받지 않으므로(_app의 isAdmin 분기)
   * 기본값이 없으면 이 자리에 키 문자열 'actions.skipToContent'가 그대로 찍힌다.
   * 사전을 받는 다른 페이지에서는 종전대로 번역이 이긴다.
   */
  const skipLabel = t('actions.skipToContent', { defaultValue: '본문 바로가기' });

  return (
    <div
      className={`flex flex-col min-h-screen bg-white dark:bg-gray-900 ${textBreakClass} overflow-x-hidden w-full`}
    >
      {isAdminPage && <AdminRouteProgress />}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-md focus:bg-white dark:focus:bg-gray-800 focus:text-gray-900 dark:focus:text-white focus:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70"
      >
        {skipLabel}
      </a>

      {/*
        계약 화면에는 사이트 헤더를 붙이지 않는다.

        서명하러 온 사람에게 필요한 것은 계약서와 서명란뿐이다. 네비게이션은 다른 데로
        새게 만들고, 언어 전환기는 눌러도 계약서가 한국어 그대로인 채 입력만 초기화되며,
        다크 모드 토글은 계약 화면이 라이트 고정이라 아무 일도 하지 않는다.
        브랜드는 계약 화면이 자기 상단에 직접 밝힌다 — 피싱과 구별되어야 하는 화면이라
        "어디서 온 문서인가"는 남아 있어야 한다.
      */}
      {showPaymentBrandBar && <PaymentBrandBar locale={locale} isDarkMode={isDarkMode} />}
      {!isBareLayout && (
        <Header
          ref={headerRef}
          locale={locale}
          isScrolled={isScrolled}
          hasHero={hasHero || false}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
      )}

      {/* paddingTop을 inline style 동적 변경(setHeaderHeight setState)에서 정적 Tailwind
          'pt-20' (=80px, INITIAL_HEADER_HEIGHT_PX와 일치)로 변경. React re-render 시
          자식 컴포넌트 layout 재계산 비용 0 + main thread block 감소. ResizeObserver
          제거(헤더 실측 갱신 미사용) — 헤더 높이가 변동되는 경우는 거의 없고(다크모드
          toggle·hover 등), 첫 paint 후 변동도 사용자 인터랙션 시에만 발생해 LCP 무관. */}
      <main
        id="main-content"
        tabIndex={-1}
        // 본문 바로가기 링크의 도착 지점. outline-none만 두면 건너뛰기가 동작했는지
        // 키보드 사용자에게 보이지 않는다. ring-inset은 전폭 요소 바깥으로 링이
        // 삐져나와 가로 스크롤을 만드는 것을 막는다. focus-visible이라 마우스로
        // 본문을 클릭했을 때(tabIndex=-1 요소는 클릭으로도 focus가 간다)는 뜨지 않는다.
        className={`page-main flex-grow outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 ${
          isHome || hasHero || isBareLayout ? 'pt-0' : 'pt-20'
        }`}
      >
        {children}
      </main>

      {!isBareLayout && <Footer locale={locale} />}
      {/*
        우하단 플로팅 컨트롤은 한 행에 묶는다. 예전에는 「맨 위로」가 bottom-24, FAB이
        bottom-6에 따로 떠서 고정 영역이 세로로 140px 두 밴드를 차지했고, 두 덩어리가
        본문 위에서 L자로 흩어져 보였다. 한 행이면 52px 한 밴드로 줄고 하나의 컨트롤
        묶음으로 읽힌다.

        단, **전폭 하단 고정 바가 뜨는 화면은 묶지 않는다.** 스토리 상세의
        StickyBottomCTA와 펀딩 상세의 FundingMobileCta는 화면 아래를 가로로 채우므로,
        행을 bottom-6에 두면 「맨 위로」가 바 뒤로 숨는다. 그 두 화면은 예전처럼
        bottom-24에 홀로 띄워 바 위로 비켜서게 한다.
      */}
      {!isFundingPledge && !isBareLayout && (
        hasFloatingRow ? (
          <div
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            className="fixed right-6 z-40 flex items-center gap-2"
          >
            <ScrollToTop locale={locale} inline />
            <KakaoFab locale={locale} inline />
          </div>
        ) : (
          <>
            {!isStoryDetail && <KakaoFab locale={locale} suppressBelowLg={isFundingDetail} />}
            <ScrollToTop locale={locale} />
          </>
        )
      )}
    </div>
  );
};

export default Layout;
