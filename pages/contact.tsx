import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../utils/localeUtils';

export default function ContactRedirect() {
  const router = useRouter();

  useEffect(() => {
    const locale = getClientLocale();
    router.replace(`/${locale}/contact`);
  }, [router]);

  return null;
}
