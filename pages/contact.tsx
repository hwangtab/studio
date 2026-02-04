import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function ContactRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/contact`);
  }, [router]);

  return null;
}
