import { useEffect, useState } from 'react';

import { Button } from '../ui/Button';

interface Props {
  href: string;
  label: string;
  /**
   * 이 CSS 선택자 중 하나라도 화면에 보이면 바를 숨긴다 — 같은 말을 하는 버튼(히어로 CTA·결제 폼)이 한 화면에
   * 둘이 되지 않게. 비우면 항상 보인다.
   */
  hideWhenInView?: string[];
  /** 주면 클릭을 가로챈다(결제 모달 열기 등). 새 탭 열기(⌘·Ctrl·Shift·가운데 클릭)는 그대로 둔다. */
  onOpen?: () => void;
  /** false면 아무것도 그리지 않는다(모금 종료 등). */
  visible?: boolean;
}

/**
 * 모바일(<lg) 하단 고정 주 버튼 바 — 공연 상세(옛 ShowMobileCta)와 펀딩 상세(FundingMobileCta)가 같은 모양을
 * 쓰도록 모은 자리다. 규칙은 둘이 이미 공유하던 것이다: `z-50`(카카오 FAB `z-40` 위), `lg:hidden`,
 * 안전 영역 패딩, 공용 `Button`(크기·모서리·포커스 링). 진짜 링크라 스크립트가 죽어도 간다.
 * 이 바가 뜨는 페이지는 Layout이 카카오 FAB을 <lg로 숨긴다(components/Layout.tsx isShowDetail·isFundingDetail,
 * 겹침 회귀 테스트는 components/funding/mobileCtaFabCollision.test.tsx).
 *
 * FundingMobileCta는 아직 이걸로 옮기지 않았다 — 펀딩 상세 HTML이 바뀌면 진행 중인 전환 실험의
 * 계측 지점이 흔들리므로 2026-10-14 이후에 옮긴다(메모리 design-v2-redesign-plan).
 */
export default function MobileStickyCta({ href, label, hideWhenInView = [], onOpen, visible = true }: Props) {
  const [hidden, setHidden] = useState(false);
  const key = hideWhenInView.join('|');

  useEffect(() => {
    if (!key || typeof IntersectionObserver === 'undefined') return;
    const targets = key.split('|').flatMap((sel) => Array.from(document.querySelectorAll(sel)));
    if (targets.length === 0) return;
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
  }, [key]);

  if (!visible || hidden) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <Button asChild size="lg" fullWidth>
        <a
          href={href}
          onClick={
            onOpen
              ? (e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpen();
                }
              : undefined
          }
        >
          {label}
        </a>
      </Button>
    </div>
  );
}
