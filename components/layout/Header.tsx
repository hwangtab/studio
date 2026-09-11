import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { getSiteConfig } from '../../data/siteConfig';
import { type Locale } from '../../lib/i18n';
import { HeaderBrand } from './HeaderBrand';
import { DesktopNav } from './DesktopNav';
import { MobileNav } from './MobileNav';
import { HeaderActions } from './HeaderActions';

interface HeaderProps {
  locale: Locale;
  isScrolled: boolean;
  hasHero: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

/**
 * 드롭다운 밖 1탭 경로 — 데스크톱 헤더와 모바일 퀵링크가 같은 것을 가리키도록
 * 한 곳에서 정의한다.
 *
 * 여기 들어오는 기준은 "드롭다운에 넣으면 오히려 못 찾는 것"이다.
 * 음악연습실(최다 유입·전환, 2026-08-24 IA 감사: GSC 449클릭·리드 51),
 * 스토리(1,582편·11개 카테고리라 어떤 그룹에도 안 들어간다),
 * 가격(전 상품 공통).
 *
 * 라벨 키가 둘인 이유: 데스크톱은 가로 배치라 축약형(nav.short.*)을 쓰고,
 * 모바일은 세로 타일이라 전체 이름을 쓴다. 스토리는 원래 짧아 둘이 같다.
 */
const PRIMARY_ROUTES = [
  { id: 'practice-room', path: 'practice-room', shortKey: 'nav.short.practiceRoom', fullKey: 'nav.practiceRoom' },
  { id: 'stories', path: 'stories', shortKey: 'nav.stories', fullKey: 'nav.stories' },
  { id: 'pricing', path: 'pricing', shortKey: 'nav.short.pricing', fullKey: 'nav.pricing' },
] as const;

export const Header = React.forwardRef<HTMLElement, HeaderProps>(({ locale, isScrolled, hasHero, isDarkMode, toggleDarkMode }, ref) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const mobileNavId = React.useId();
  const { t } = useTranslation('common', { lng: locale });
  const currentPath = router.asPath.split('?')[0].split('#')[0];
  const siteConfig = getSiteConfig(locale);

  /**
   * 라우트가 바뀌면 모바일 메뉴를 닫는다.
   *
   * Header는 Layout 안에 있어 페이지 전환으로 remount되지 않는다(_app.tsx의 remount key는
   * 안쪽 Component에만 걸린다). 그래서 메뉴를 연 채 **브라우저 뒤로가기**처럼 링크 클릭이
   * 아닌 경로로 이동하면 isMenuOpen이 true로 남았다. MobileNav는 iOS 성능 때문에 항상
   * mount된 채 CSS로만 토글하는 구조라 새 페이지 위에 이전 메뉴가 그대로 떠 있고,
   * useFocusTrapDialog가 포커스를 그 안에 계속 가둬 **키보드·스크린리더 사용자는 새
   * 페이지를 조작할 수 없게 된다**. 시각적 잔존보다 이쪽이 심각하다.
   *
   * 닫는 경로가 X 버튼·메뉴 내 링크·Esc뿐이었으므로 라우트 이벤트를 추가한다.
   */
  useEffect(() => {
    const closeMenu = () => setIsMenuOpen(false);
    router.events.on('routeChangeStart', closeMenu);
    return () => router.events.off('routeChangeStart', closeMenu);
  }, [router.events]);

  /**
   * 메뉴는 "방문자가 무엇을 하러 왔는가"로 가른다 (2026-09-11 재정렬).
   *
   *   당신의 음악을 만든다  → 녹음·제작 · 음원 발매   (의뢰인)
   *   우리 음악을 듣고 함께한다 → 아티스트            (청중·팬)
   *   우리를 안다            → 스튜디오 · 스토리 · 가격 · 연습실
   *
   * 1탭 링크는 "드롭다운에 넣으면 오히려 못 찾는 것"만 둔다 — 최다 유입·전환인
   * 음악연습실(2026-08-24 IA 감사: GSC 449클릭·리드 51), 전 상품 공통인 가격,
   * 그리고 1,582편·11개 카테고리라 어떤 그룹에도 안 들어가는 스토리.
   *
   * 아티스트 그룹의 항목은 전부 ko 전용이라 그룹째 ko에서만 렌더한다 — 비-ko에서
   * 빈 드롭다운이 열리면 안 된다.
   */
  const directLinks = useMemo(
    () => PRIMARY_ROUTES.map(({ id, path, shortKey }) => ({
      id,
      label: t(shortKey),
      href: `/${locale}/${path}`,
    })),
    [locale, t]
  );

  const navGroups = useMemo(() => [
    {
      id: 'production',
      label: t('nav.groups.production'),
      items: [
        { label: t('nav.recording'), href: `/${locale}/recording` },
        { label: t('nav.mixingMastering'), href: `/${locale}/mixing-mastering` },
        { label: t('nav.voiceActing'), href: `/${locale}/voice-acting` },
        { label: t('nav.weddingSong'), href: `/${locale}/wedding-song` },
        { label: t('nav.coverVideo'), href: `/${locale}/cover-video` },
        { label: t('nav.lesson'), href: `/${locale}/lesson` },
      ]
    },
    {
      /**
       * 티어(싱글·EP·정규)는 넣지 않는다. 개요 페이지의 티어 비교표가 그 역할이고,
       * 메뉴에 네 개가 들어가 있으면 단독 상품인 발매 홍보가 그 뒤에 묻힌다.
       * 티어 페이지는 개요·푸터·사이트맵에서 계속 링크된다.
       */
      id: 'release',
      label: t('nav.groups.release'),
      items: [
        { label: t('nav.releaseProject'), href: `/${locale}/release-project` },
        { label: t('nav.musicPromotion'), href: `/${locale}/music-promotion` },
      ]
    },
    /**
     * 후원·선구매·예매는 행위가 제각각이라 행위로는 묶이지 않는다. 묶이는 건
     * 대상이다 — 전부 "스튜디오 놀과 함께 만든 음악의 주인공들"이 중심이다.
     * 공연 예매가 붙으면 여기 들어간다.
     */
    ...(locale === 'ko' ? [{
      id: 'artist',
      label: t('nav.groups.artist'),
      items: [
        { label: t('nav.artists'), href: `/${locale}/artists` },
        { label: t('nav.funding'), href: `/${locale}/funding` },
      ]
    }] : []),
    {
      // 소개(누구인가) → 포트폴리오(무엇을 했나) → 장비(무엇으로) → 문의(연락).
      id: 'studio',
      label: t('nav.groups.studio'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
        { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
        { label: t('nav.equipment'), href: `/${locale}/studio-info` },
        { label: t('nav.contact'), href: `/${locale}/contact` },
      ]
    }
  ], [locale, t]);

  // 데스크톱 헤더의 좌→우 배치 순서. 1탭 링크와 드롭다운이 섞이므로 한 배열로 표현한다.
  const desktopNavItems = useMemo(() => [
    { kind: 'link' as const, ...directLinks[0] },
    ...navGroups.map((group) => ({ kind: 'group' as const, ...group })),
    ...directLinks.slice(1).map((link) => ({ kind: 'link' as const, ...link })),
  ], [directLinks, navGroups]);

  /**
   * 모바일 메뉴 최상단 고정 퀵링크. 그룹 아코디언이 모두 접힌 채 시작하므로
   * 그룹 밖 1탭 경로를 위로 올린다.
   *
   * 데스크톱 1탭과 **같은 PRIMARY_ROUTES에서 파생한다.** 예전엔 두 배열을 따로
   * 적어 두고 주석으로만 "일치해야 한다"고 해 뒀는데, 실제로 아티스트 후원이
   * 여기만 남아 아티스트 그룹과 중복된 적이 있다. 주석은 한쪽만 고치는 것을
   * 막지 못한다.
   *
   * 문의만 추가로 둔다 — 모바일에서는 전환 경로를 손가락 가까이 두는 편이 낫다.
   * 라벨은 nav.short.*(가로 배치용 축약) 대신 전체 이름을 쓴다. 세로 타일이라
   * 폭에 여유가 있다.
   */
  const quickLinks = useMemo(
    () => [
      ...PRIMARY_ROUTES.map(({ path, fullKey }) => ({
        label: t(fullKey),
        href: `/${locale}/${path}`,
      })),
      { label: t('nav.contact'), href: `/${locale}/contact` },
    ],
    [locale, t]
  );

  const handleNavigate = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const isTransparent = hasHero && !isScrolled;

  return (
    // backdrop-filter는 안쪽 바/pill div에만 둔다 — <header> 자체에 filter/transform을
    // 주면 containing block이 생겨 자식 MobileNav(fixed inset-x-0 top-16)의 뷰포트 기준
    // 배치가 깨진다.
    // 반응형: 모바일/태블릿(<lg)은 전폭 글래스 바(전폭 MobileNav와 정합·좌우 어긋남 없음),
    // 데스크톱(lg+)은 iOS 26 플로팅 pill. 두 경우 모두 하단선이 64px —
    // 모바일 h-16(64) / 데스크톱 pt-2(8)+h-14(56) — 라 MobileNav top-16 ·
    // SectionAnchorNav sticky top-16 · 본문 scroll-mt 오프셋과 그대로 맞물린다.
    <header ref={ref} className="fixed w-full z-50">
      <div className="max-w-7xl mx-auto lg:px-6 lg:pt-2">
        {/* 열 구성이 [auto_1fr_auto]인 이유: 이전 [1fr_auto_1fr]은 nav가 넓어지면
            양쪽 1fr을 0px까지 압축해 로고를 통째로 지웠다(uz·vi 로케일 1024px에서 실측).
            로고와 우측 액션은 콘텐츠 폭을 보장하고, 남는 공간을 nav가 갖게 한다. */}
        <div
          className={`grid h-16 lg:h-14 grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-4 rounded-none lg:rounded-full transition-[background-color,box-shadow,border-color] duration-300 transform-gpu ${!isTransparent
            // 데스크톱 pill 그림자: shadow-[...var(--glass-shadow)]는 Tailwind이
            // '섀도 색상'으로 오판해 box-shadow를 안 내보낸다(감사에서 확인). arbitrary
            // *property* 문법 [box-shadow:...]로 raw 선언을 직접 출력해 우회한다.
            ? 'glass-bar border-b border-gray-200/60 dark:border-gray-800/60 lg:border lg:border-[color:var(--glass-border)] lg:[box-shadow:inset_0_1px_0_var(--glass-spec),var(--glass-shadow)]'
            : 'bg-transparent'
            }`}
        >
          <div className="justify-self-start">
            <HeaderBrand
              locale={locale}
              isTransparent={isTransparent}
              isDarkMode={isDarkMode}
              siteConfig={siteConfig}
              onLogoClick={() => setIsMenuOpen(false)}
            />
          </div>

          <div className="justify-self-center">
            <DesktopNav
              items={desktopNavItems}
              isTransparent={isTransparent}
              currentPath={currentPath}
              onNavigate={handleNavigate}
              locale={locale}
            />
          </div>

          <div className="justify-self-end">
            <HeaderActions
              isTransparent={isTransparent}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
              locale={locale}
              t={t}
              siteConfig={siteConfig}
              isMenuOpen={isMenuOpen}
              setIsMenuOpen={setIsMenuOpen}
              mobileNavId={mobileNavId}
            />
          </div>
        </div>
      </div>

      <MobileNav
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        navGroups={navGroups}
        quickLinks={quickLinks}
        currentPath={currentPath}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        locale={locale}
        navId={mobileNavId}
        t={t}
      />
    </header>
  );
});

Header.displayName = 'Header';
