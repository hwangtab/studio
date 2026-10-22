import React from 'react';
import Link from 'next/link';

import { cn } from '../../lib/utils';

/**
 * 관리자 목록의 필터 알약(상태·종류·기간·라인 고르기) — 한 곳에서만 모양을 정한다.
 *
 * 예전에는 화면마다 손으로 짰고, 같은 화면 안에서도 첫 줄은 파랑(bg-primary)·둘째 줄은 검정(bg-gray-900)으로
 * 켜져 있어 어느 쪽이 "지금 고른 것"인지 위계가 흔들렸다(예약·계약·구독·매출·펀딩, 2026-10-22). 이제 켜진 알약은
 * 전부 관리자 주색(파랑)이다.
 *
 * - `href`를 주면 링크(주소로 거르는 필터, `aria-current`), `onClick`을 주면 버튼(화면 안에서 거르는 필터, `aria-pressed`),
 *   둘 다 없으면 지금 걸린 필터를 보여 주기만 하는 표시(span)다.
 * - `tone`은 의미가 따로 있는 지름길에만 쓴다 — `sky`는 계좌 입금 대기, `violet`은 대시보드에서 넘어온 작업 묶음.
 */
export type FilterPillTone = 'primary' | 'sky' | 'violet';

const BASE =
  'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const TONE: Record<FilterPillTone, { on: string; off: string }> = {
  primary: { on: 'bg-primary text-white', off: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  sky: { on: 'bg-sky-700 text-white', off: 'bg-sky-100 text-sky-900 hover:bg-sky-200' },
  violet: { on: 'bg-violet-700 text-white', off: 'bg-violet-100 text-violet-900 hover:bg-violet-200' },
};

export const filterPillClass = (active: boolean, tone: FilterPillTone = 'primary', className?: string): string =>
  cn(BASE, active ? TONE[tone].on : TONE[tone].off, className);

interface FilterPillProps {
  active: boolean;
  tone?: FilterPillTone;
  href?: string;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export const FilterPill = ({ active, tone = 'primary', href, onClick, className, children }: FilterPillProps) => {
  const classes = filterPillClass(active, tone, className);
  if (href) {
    return (
      <Link href={href} aria-current={active ? 'true' : undefined} className={classes}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" aria-pressed={active} onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }
  return <span className={classes}>{children}</span>;
};

export default FilterPill;
