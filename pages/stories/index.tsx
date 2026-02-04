import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../../lib/i18n';

export default function StoriesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/stories`);
  }, [router]);

  return null;
}