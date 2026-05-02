import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

type PillNavVariant = 'invert' | 'subtle';

interface PillNavLinkProps {
  href: string;
  label: string;
  /**
   * Hover 스타일.
   * - invert (기본): hover 시 ink 배경 + 흰 텍스트로 반전. 강한 강조 — 페이지 하단 핵심 서비스 nav.
   * - subtle: hover 시 ink/[0.04] 만 비치게 — 보조 영역에서 주변과 조화롭게.
   */
  variant?: PillNavVariant;
  /**
   * 우측 화살표 아이콘 표시 여부. 기본 true. 단순 nav이고 화살표가 시각적 노이즈일 때 false.
   */
  showArrow?: boolean;
  /**
   * Next.js Link prefetch. 메인 등 LCP 측정 영역에서 다수의 nav link를 노출할 때
   * 모든 경로의 청크를 사전 다운로드하지 않도록 false 권장.
   */
  prefetch?: boolean;
  className?: string;
}

const VARIANT_HOVER: Record<PillNavVariant, string> = {
  invert:
    'hover:bg-ink hover:text-white dark:hover:bg-white dark:hover:text-ink',
  subtle:
    'hover:bg-ink/[0.04] dark:hover:bg-white/[0.06]',
};

/**
 * 다크/라이트 모드 모두 동일 시각적 무게로 보이는 outline pill 링크.
 * DESIGN.md §4 Pill 토큰 + Apple HIG 44px 터치 타깃 준수.
 *
 * 사용 케이스: 페이지 하단 보조 네비, 서비스 바로가기 그룹.
 * 인라인 className으로 같은 마크업을 다시 작성하지 말 것.
 */
const PillNavLink: React.FC<PillNavLinkProps> = ({
  href,
  label,
  variant = 'invert',
  showArrow = true,
  prefetch = false,
  className,
}) => (
  <Link
    href={href}
    prefetch={prefetch}
    className={cn(
      'inline-flex items-center gap-2 px-6 py-3 rounded-pill font-medium transition-colors duration-200 touch-manipulation',
      'border border-hairline-strong text-ink dark:border-white/20 dark:text-on-dark',
      VARIANT_HOVER[variant],
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2',
      'focus-visible:ring-offset-canvas dark:focus-visible:ring-offset-canvas-deep',
      className
    )}
  >
    {label} {showArrow && <ArrowRight size={16} aria-hidden="true" />}
  </Link>
);

export default PillNavLink;
