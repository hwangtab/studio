import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../lib/i18n';

export default function PracticeRoomRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${defaultLocale}/practice-room`);
  }, [router]);

  return null;
}