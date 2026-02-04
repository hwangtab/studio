import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function PricingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/pricing`);
  }, [router]);

  return null;
}