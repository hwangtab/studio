import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function AboutRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/about`);
  }, [router]);

  return null;
}