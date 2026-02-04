import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../../utils/localeUtils';

export default function StoriesRedirect() {
  const router = useRouter();

  useEffect(() => {
    const locale = getClientLocale();
    router.replace(`/${locale}/stories`);
  }, [router]);

  return null;
}
