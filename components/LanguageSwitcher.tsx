import Link from 'next/link';
import { useRouter } from 'next/router';
import { locales, localeNames, type Locale } from '../lib/i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
  isScrolled: boolean;
  hasHero: boolean;
}

export const LanguageSwitcher = ({ currentLocale, isScrolled, hasHero }: LanguageSwitcherProps) => {
  const router = useRouter();

  const getPathForLocale = (targetLocale: Locale) => {
    const path = router.asPath;
    const segments = path.split('/');
    // segments[0] is empty
    // segments[1] is usually the locale in our new structure
    
    if (locales.includes(segments[1] as Locale)) {
       segments[1] = targetLocale;
       return segments.join('/') || '/';
    }
    
    // Fallback for root or other paths
    return `/${targetLocale}${path === '/' ? '' : path}`;
  };

  return (
    <div className="flex items-center space-x-1 ml-2">
      {locales.map((locale) => (
        <Link 
            key={locale} 
            href={getPathForLocale(locale)}
            className={`
              px-2 py-1 rounded text-xs font-bold transition-colors duration-200
              ${currentLocale === locale 
                ? 'bg-primary text-white shadow-sm' 
                : (isScrolled || !hasHero 
                    ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100' 
                    : 'text-gray-300 hover:text-white hover:bg-white/10')
              }
            `}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
};
