import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../utils/localeUtils';

export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    const targetLocale = getClientLocale();
    router.replace(`/${targetLocale}`);
  }, [router]);

  return null;
}
