import React from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { type TFunction } from 'i18next';
import Link from 'next/link';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';

interface HeaderActionsProps {
  isTransparent: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  locale: Locale;
  t: TFunction;
  siteConfig: ReturnType<typeof getSiteConfig>;
  isMenuOpen: boolean;
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const HeaderActions = ({
  isTransparent,
  isDarkMode,
  toggleDarkMode,
  locale,
  t,
  siteConfig,
  isMenuOpen,
  setIsMenuOpen
}: HeaderActionsProps) => {
  const headerCtaButtonClass = `inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-full text-sm font-bold leading-none text-center transition-all duration-300 transform hover:scale-105 active:scale-95 whitespace-nowrap border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg border-transparent'
    : 'bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm'
    }`;

  return (
    <div className="flex-shrink-0 flex items-center space-x-2 sm:space-x-4">
      <div className="hidden sm:flex items-center space-x-2">
        <button
          className={`p-2 min-h-[44px] min-w-[44px] rounded-full transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
            ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            : 'text-white hover:bg-white/20'
            }`}
          onClick={toggleDarkMode}
          aria-label={isDarkMode ? t('actions.toggleThemeLight') : t('actions.toggleThemeDark')}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <LanguageSwitcher
          currentLocale={locale}
          isFloating={isTransparent}
        />
      </div>

      {locale === 'ko' ? (
        <a
          href={siteConfig.contact.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('actions.kakaoExternal')}
          className={headerCtaButtonClass}
        >
          {t('actions.kakao')}
        </a>
      ) : (
        <Link
          href={`/${locale}/contact`}
          className={headerCtaButtonClass}
        >
          {t('nav.contact')}
        </Link>
      )}

      <button
        className={`xl:hidden p-2 min-h-[44px] min-w-[44px] rounded-full transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
          ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          : 'text-white hover:bg-white/20'
          }`}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label={isMenuOpen ? t('actions.closeMenu') : t('actions.openMenu')}
      >
        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
  );
};
