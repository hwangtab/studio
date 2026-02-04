import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { defaultLocale } from '../../lib/i18n';

export default function StoryItemRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      router.replace(`/${defaultLocale}/stories/${id}`);
    }
  }, [router, id]);

  return null;
}