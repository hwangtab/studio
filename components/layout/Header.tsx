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
  disableEffects?: boolean;
}

export const Header = React.forwardRef<HTMLElement, HeaderProps>(({ locale, isScrolled, hasHero, isDarkMode, toggleDarkMode, disableEffects = false }, ref) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const router = useRouter();
  const { t } = useTranslation('common', { lng: locale });
  const currentPath = router.asPath.split('?')[0].split('#')[0];
  const siteConfig = getSiteConfig(locale);

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }, []);

  const navGroups = useMemo(() => [
    {
      id: 'recording',
      label: t('nav.groups.recording'),
      items: [
        { label: t('nav.about'), href: `/${locale}/about` },
        { label: t('nav.pricing'), href: `/${locale}/pricing` },
        { label: t('nav.equipment'), href: `/${locale}/studio-info` },
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
      className={`fixed w-full z-50 transition-[background-color,backdrop-filter,box-shadow] duration-300 py-4 transform-gpu ${!isTransparent
        ? disableEffects
          ? 'bg-white/95 dark:bg-gray-900/95 shadow-md shadow-gray-200/40 dark:shadow-gray-950/40'
          : 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-lg shadow-gray-200/50 dark:shadow-gray-950/50'
        : 'bg-transparent'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-12">
          <HeaderBrand
            locale={locale}
            isTransparent={isTransparent}
            isDarkMode={isDarkMode}
            disableEffects={disableEffects}
            siteConfig={siteConfig}
            onLogoClick={() => setIsMenuOpen(false)}
          />

          <DesktopNav
            navGroups={navGroups}
            isTransparent={isTransparent}
            currentPath={currentPath}
            onNavigate={handleNavigate}
          />

          <HeaderActions
            isTransparent={isTransparent}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            locale={locale}
            t={t}
            siteConfig={siteConfig}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
          />
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
        isTransparent={isTransparent}
        disableEffects={disableEffects}
        expandedGroups={expandedGroups}
        toggleGroup={toggleGroup}
        t={t}
      />
    </header>
  );
});

Header.displayName = 'Header';
