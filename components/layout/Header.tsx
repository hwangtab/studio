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

  // 메뉴 순서는 성과 데이터에 맞춘다(2026-08-24 IA 감사).
  // 최다 유입·전환 페이지인 음악연습실(GSC 449클릭·리드 51)과 전 상품 공통인 가격은
  // 드롭다운 밖 1탭 링크로 둔다. 나머지는 라벨과 내용이 일치하는 4개 그룹.
  // 이전 구조의 '녹음/믹싱' 그룹에는 소개·가격·장비가 섞여 있어, 연습실 요금을 찾는
  // 사람이 '녹음/믹싱'을 열어야 했다.
  // 아티스트 후원은 ko 전용(결제 퍼널과 같은 정책, 스펙 §11.2) — 비-ko에선 링크를 만들지 않는다.
  const directLinks = useMemo(() => [
    { id: 'practice-room', label: t('nav.short.practiceRoom'), href: `/${locale}/practice-room` },
    { id: 'pricing', label: t('nav.short.pricing'), href: `/${locale}/pricing` },
    ...(locale === 'ko'
      ? [{ id: 'artists', label: t('nav.short.artists'), href: `/${locale}/artists` }]
      : []),
  ], [locale, t]);

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
      id: 'release',
      label: t('nav.groups.release'),
      items: [
        { label: t('nav.releaseProject'), href: `/${locale}/release-project` },
        { label: t('nav.releaseSingle'), href: `/${locale}/release-project/single` },
        { label: t('nav.releaseEp'), href: `/${locale}/release-project/ep` },
        { label: t('nav.releaseAlbum'), href: `/${locale}/release-project/album` },
        // 펀딩 퍼널은 ko 전용(스펙 §8) — 다른 로케일엔 항목 자체를 넣지 않는다.
        ...(locale === 'ko' ? [{ label: t('nav.funding'), href: `/${locale}/funding` }] : []),
      ]
    },
    {
      id: 'guide',
      label: t('nav.groups.guide'),
      items: [
        { label: t('nav.stories'), href: `/${locale}/stories` },
        { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
      ]
    },
    {
      id: 'studio',
      label: t('nav.groups.studio'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
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

  // 모바일 메뉴 최상단 고정 노출 퀵링크. 4개 그룹 아코디언이 모두 접힌 채 시작하므로
  // 고객 최다 의도를 그룹 밖 1탭 경로로 승격한다. 포트폴리오는 90일 검색 클릭 0·리드 0이라
  // 이 자리에서 내리고(가이드 그룹으로 이동), 최다 유입인 음악연습실을 올렸다.
  // 연습실·가격은 데스크톱에서도 1탭이므로 두 뷰포트의 우선순위가 일치한다.
  const quickLinks = useMemo(() => [
    { label: t('nav.practiceRoom'), href: `/${locale}/practice-room` },
    { label: t('nav.pricing'), href: `/${locale}/pricing` },
    ...(locale === 'ko' ? [{ label: t('nav.artists'), href: `/${locale}/artists` }] : []),
    { label: t('nav.contact'), href: `/${locale}/contact` },
  ], [locale, t]);

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
