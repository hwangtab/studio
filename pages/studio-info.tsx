import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function StudioRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/studio-info`);
  }, [router]);

  return null;
}