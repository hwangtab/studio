import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale, locales } from '../lib/i18n';

export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    // Detect browser language
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : defaultLocale;
    
    // Check if the browser language is one of our supported locales
    const targetLocale = locales.includes(browserLang as any) ? browserLang : defaultLocale;
    
    router.replace(`/${targetLocale}`);
  }, [router]);

  return null;
}
