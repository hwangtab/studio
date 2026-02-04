import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../utils/localeUtils';

export default function StudioRedirect() {
  const router = useRouter();

  useEffect(() => {
    const locale = getClientLocale();
    router.replace(`/${locale}/studio-info`);
  }, [router]);

  return null;
}
