import React, { useState, useCallback, useMemo } from 'react';
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

  const navGroups = useMemo(() => [
    {
      id: 'release',
      label: t('nav.groups.release'),
      items: [
        { label: t('nav.releaseProject'), href: `/${locale}/release-project` },
        { label: t('nav.releaseSingle'), href: `/${locale}/release-project/single` },
        { label: t('nav.releaseEp'), href: `/${locale}/release-project/ep` },
        { label: t('nav.releaseAlbum'), href: `/${locale}/release-project/album` },
      ]
    },
    {
      id: 'recording',
      label: t('nav.groups.recording'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
        { label: t('nav.pricing'), href: `/${locale}/pricing` },
        { label: t('nav.equipment'), href: `/${locale}/studio-info` },
        { label: t('nav.weddingSong'), href: `/${locale}/wedding-song` },
        { label: t('nav.voiceActing'), href: `/${locale}/voice-acting` },
        { label: t('nav.coverVideo'), href: `/${locale}/cover-video` },
      ]
    },
    {
      id: 'practice',
      label: t('nav.groups.practice'),
      items: [
        { label: t('nav.practiceRoom'), href: `/${locale}/practice-room` },
        { label: t('nav.lesson'), href: `/${locale}/lesson` },
      ]
    },
    {
      id: 'explore',
      label: t('nav.groups.explore'),
      items: [
        { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
        { label: t('nav.stories'), href: `/${locale}/stories` },
        { label: t('nav.contact'), href: `/${locale}/contact` },
      ]
    }
  ], [locale, t]);

  // 모바일 메뉴 최상단 고정 노출 퀵링크. 4개 그룹 아코디언이 모두 접힌 채 시작하므로
  // 고객 최다 의도(가격 확인·방문/전화·작업물 확인)를 그룹 밖 1탭 경로로 승격한다.
  const quickLinks = useMemo(() => [
    { label: t('nav.pricing'), href: `/${locale}/pricing` },
    { label: t('nav.contact'), href: `/${locale}/contact` },
    { label: t('nav.portfolio'), href: `/${locale}/portfolio` },
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
        <div
          className={`grid h-16 lg:h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-4 rounded-none lg:rounded-full transition-[background-color,box-shadow,border-color] duration-300 transform-gpu ${!isTransparent
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
              navGroups={navGroups}
              isTransparent={isTransparent}
              currentPath={currentPath}
              onNavigate={handleNavigate}
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
