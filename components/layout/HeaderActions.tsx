import React from 'react';
import { Menu, X, Sun, Moon } from '@/lib/lucide-icons';
import { type TFunction } from 'i18next';
import Link from 'next/link';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';

interface HeaderActionsProps {
  isTransparent: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  locale: Locale;
  t: TFunction;
  siteConfig: ReturnType<typeof getSiteConfig>;
  isMenuOpen: boolean;
  setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileNavId: string;
}

export const HeaderActions = ({
  isTransparent,
  isDarkMode,
  toggleDarkMode,
  locale,
  siteConfig,
  isMenuOpen,
  setIsMenuOpen,
  mobileNavId,
  t
}: HeaderActionsProps) => {
  const headerCtaBaseClass = 'inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-full text-sm font-bold leading-normal text-center whitespace-nowrap border touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all duration-300 transform hover:scale-105 active:scale-95';

  // ko의 목적지는 카카오톡이므로 헤더 두 상태 모두 옐로(노란 버튼 = 카카오톡 규칙).
  // 투명 상태에서도 옐로는 솔리드라 배경 사진 밝기와 무관하게 kakao-ink 글씨 대비가
  // 16:1로 고정된다 — 밝은 히어로에서 글씨가 흐려지던 스크림 방식보다 안정적이라
  // text-shadow도 필요 없다. focus ring만 배경에 맞춰 가른다.
  const kakaoCtaButtonClass = `${headerCtaBaseClass} bg-kakao hover:bg-kakao-dark text-kakao-ink border-transparent shadow-md hover:shadow-lg ${isTransparent
    ? 'focus-visible:ring-white/70 focus-visible:ring-offset-black/20'
    : 'focus-visible:ring-kakao-ink focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900'
    }`;

  // 비-ko는 목적지가 카카오톡이 아니라 /contact 폼이라 옐로를 쓰면 안 된다 — 기존 배색 유지.
  // 투명 헤더 CTA는 히어로 위 흰 글씨 오버레이. 흰 틴트(bg-white/*)는 배경을
  // 밝혀 흰 글씨 대비를 오히려 낮추므로, 어두운 스크림(bg-black/25)+text-shadow로
  // 밝은 히어로에서도 글씨가 읽히게 한다. glass 토큰은 모바일 폴백 시 불투명
  // 흰색이 되어 흰 글씨가 사라지므로 여기선 쓰지 않는다.
  const formCtaButtonClass = `${headerCtaBaseClass} focus-visible:ring-primary/40 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:shadow-lg border-transparent'
    : 'bg-black/25 hover:bg-black/35 text-white border-white/35 [text-shadow:0_1px_2px_rgb(0_0_0/0.55)]'
    }`;

  return (
    <div className="flex-shrink-0 flex items-center space-x-2 sm:space-x-4">
      <div className="hidden sm:flex items-center space-x-2">
        <button
          className={`flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-full transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
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
          className={kakaoCtaButtonClass}
          onClick={() =>
            trackLeadEvent('lead_click_kakao', {
              locale,
              component: 'HeaderActions',
              cta_id: 'header_kakao',
            })
          }
        >
          {t('actions.kakao')}
        </a>
      ) : (
        <Link
          href={`/${locale}/contact`}
          prefetch={false}
          className={formCtaButtonClass}
          onClick={() =>
            trackMicroEvent('micro_click_contact', {
              locale,
              component: 'HeaderActions',
              cta_id: 'header_contact',
            })
          }
        >
          {t('nav.contact')}
        </Link>
      )}

      <button
        className={`lg:hidden flex items-center justify-center p-2 min-h-[44px] min-w-[44px] rounded-full transition-colors duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${!isTransparent
          ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          : 'text-white hover:bg-white/20'
          }`}
        onClick={() => setIsMenuOpen((prev) => !prev)}
        aria-label={isMenuOpen ? t('actions.closeMenu') : t('actions.openMenu')}
        aria-expanded={isMenuOpen}
        aria-controls={mobileNavId}
        aria-haspopup="dialog"
      >
        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
  );
};

export default HeaderActions;
