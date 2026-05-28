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

  const handleNavigate = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const isTransparent = hasHero && !isScrolled;

  return (
    <header
      ref={ref}
      className={`fixed w-full z-50 transition-[background-color,box-shadow,border-color] duration-300 transform-gpu ${!isTransparent
        ? 'bg-white/95 dark:bg-gray-950/95 shadow-sm border-b border-gray-200/50 dark:border-gray-800/50'
        : 'bg-transparent border-b border-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
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
