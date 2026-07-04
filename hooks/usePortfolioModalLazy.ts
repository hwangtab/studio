import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { PortfolioItem, PortfolioCategory } from '../types/data';
import type { Locale } from '../lib/i18n';

/**
 * release-project 페이지들에서 portfolio detail 모달을 띄울 때 사용.
 *
 * 핵심: portfolio items 전체를 `getStaticProps` props로 전달하면 (28 페이지)
 * inline JSON 폭증으로 빌드 시간 3분→21분 폭증. 그래서 **클라이언트 측에서
 * data/portfolio 모듈을 dynamic import**해 lazy load로 가져옴.
 *
 * - SSG 단계 props 전달 0 → 빌드 시간 정상
 * - 첫 페이지 로드 후 백그라운드에서 portfolio data chunk 다운로드
 * - 사용자가 카드 클릭 시 모달 즉시 노출 (data 이미 메모리에 있음)
 * - URL `?item={id}` shallow routing → 같은 페이지에서 모달 열림 (페이지 전환 없음)
 */
export const usePortfolioModalLazy = (locale: Locale, basePath: string) => {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [allItems, setAllItems] = useState<PortfolioItem[]>([]);
  const [categories, setCategories] = useState<PortfolioCategory[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('../data/portfolio')
      .then(({ getPortfolioItems, getCategories }) => {
        if (cancelled) return;
        setAllItems(getPortfolioItems(locale));
        setCategories(getCategories(locale));
        setLoadError(false);
      })
      .catch((error) => {
        // dynamic import 실패(청크 네트워크 오류 등) 시 rejection이 유실되면 모달이
        // 조용히 작동 불능해진다. 에러 상태를 노출해 호출부가 모달을 비활성화하고
        // 실제 상세 페이지로 폴백할 수 있게 한다. (언마운트 시엔 상태 갱신 생략)
        if (cancelled) return;
        console.error('[usePortfolioModalLazy] portfolio 데이터 로드 실패:', error);
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    const itemId = router.query.item;
    if (typeof itemId === 'string' && allItems.length > 0) {
      const item = allItems.find((p) => p.id === itemId);
      setSelectedItem(item || null);
    } else if (!itemId) {
      setSelectedItem(null);
    }
  }, [router.query.item, allItems]);

  const open = (id: string) => {
    const item = allItems.find((p) => p.id === id);
    if (item) {
      setSelectedItem(item);
    }
    router.push(`${basePath}?item=${id}`, undefined, { shallow: true, scroll: false });
  };

  const close = () => {
    setSelectedItem(null);
    router.push(basePath, undefined, { shallow: true, scroll: false });
  };

  return { selectedItem, categories, open, close, loadError };
};
