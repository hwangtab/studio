import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../utils/localeUtils';

export default function PracticeRoomRedirect() {
  const router = useRouter();

  useEffect(() => {
    const locale = getClientLocale();
    router.replace(`/${locale}/practice-room`);
  }, [router]);

  return null;
}
