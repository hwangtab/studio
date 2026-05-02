import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PillNavLinkProps {
  href: string;
  label: string;
  /**
   * Next.js Link prefetch. 메인 등 LCP 측정 영역에서 다수의 nav link를 노출할 때
   * 모든 경로의 청크를 사전 다운로드하지 않도록 false 권장.
   */
  prefetch?: boolean;
  className?: string;
}

/**
 * 다크/라이트 모드 모두 동일 시각적 무게로 보이는 outline pill 링크.
 * DESIGN.md §4 Pill 토큰 + Apple HIG 44px 터치 타깃 준수.
 *
 * 사용 케이스: 페이지 하단 보조 네비, 서비스 바로가기 그룹 등.
 */
const PillNavLink: React.FC<PillNavLinkProps> = ({ href, label, prefetch = false, className }) => (
  <Link
    href={href}
    prefetch={prefetch}
    className={cn(
      'inline-flex items-center gap-2 px-6 py-3 rounded-pill font-medium transition-colors duration-200 touch-manipulation',
      'border border-hairline-strong text-ink hover:bg-ink hover:text-white',
      'dark:border-white/20 dark:text-on-dark dark:hover:bg-white dark:hover:text-ink',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-link-focus focus-visible:ring-offset-2',
      'focus-visible:ring-offset-canvas dark:focus-visible:ring-offset-canvas-deep',
      className
    )}
  >
    {label} <ArrowRight size={16} aria-hidden="true" />
  </Link>
);

export default PillNavLink;
