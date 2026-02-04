import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function PortfolioRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/portfolio`);
  }, [router]);

  return null;
}