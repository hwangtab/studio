import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getClientLocale } from '../../utils/localeUtils';

export default function StoryItemRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      const locale = getClientLocale();
      router.replace(`/${locale}/stories/${id}`);
    }
  }, [router, id]);

  return null;
}
