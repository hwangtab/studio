import { useEffect, useState } from 'react';

import { Button } from '../ui/Button';

/**
 * 모바일(<lg) 하단 고정 "예매하기" 바. 예매 폼(#book)이나 히어로 예매 버튼이 화면에 들어오면 숨는다 — 폼 안에
 * 결제 버튼이 따로 있어 같은 자리에 두 개가 겹치지 않게 한다. 진짜 앵커(#book)라 스크립트가
 * 죽어도 폼으로 간다. 하단 바는 z-50(카카오 FAB z-40 위) — Layout이 공연 상세에서 FAB을
 * <lg로 숨긴다(펀딩 상세와 같은 규칙, components/funding/mobileCtaFabCollision.test.tsx).
 */
export default function ShowMobileCta({ label }: { label: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // 예매 폼이나 히어로의 예매 버튼이 화면에 있으면 같은 말을 하는 바를 또 띄우지 않는다.
    const targets = ['book', 'show-hero-cta'].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const inView = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inView.add(e.target);
          else inView.delete(e.target);
        }
        setHidden(inView.size > 0);
      },
      { threshold: 0.05 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  if (hidden) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <Button asChild size="lg" fullWidth>
        <a href="#book">{label}</a>
      </Button>
    </div>
  );
}
