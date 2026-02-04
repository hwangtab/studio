import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../utils/localeUtils';

export default function LessonRedirect() {
  const router = useRouter();

  useEffect(() => {
    const locale = getClientLocale();
    router.replace(`/${locale}/lesson`);
  }, [router]);

  return null;
}
