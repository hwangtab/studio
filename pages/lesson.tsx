import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function LessonRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/lesson`);
  }, [router]);

  return null;
}
