import React from 'react';
import Link from 'next/link';

import { FOCUS_RING } from '../ui/focusRing';

/**
 * 재무 화면(`/admin/finance/**`)의 탭 줄 — 매출·수익 / 지출 / 장부 내보내기.
 *
 * 탭을 `?tab=`이 아니라 하위 경로로 둔 이유: 매출 화면은 이미 year·month·line·type 쿼리를 쓰고, 탭마다 읽는 데이터가
 * 크게 다르다(매출은 3년치 결제 행, 지출은 지출 표만). 경로가 갈려 있으면 각 탭이 자기 데이터만 읽고, 메뉴 활성 판정
 * (가장 긴 접두사)도 그대로 맞는다. 옛 주소(`/admin/revenue`·`/admin/expenses`)는 next.config.mjs가 이리로 돌린다.
 */
export const FINANCE_TABS = [
  { href: '/admin/finance', label: '매출·수익' },
  { href: '/admin/finance/expenses', label: '지출' },
  { href: '/admin/finance/export', label: '장부 내보내기' },
] as const;

export type FinanceTabHref = (typeof FINANCE_TABS)[number]['href'];

export const FinanceTabs = ({ active }: { active: FinanceTabHref }) => (
  <nav aria-label="재무 탭" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
    <ul className="flex min-w-max gap-1 border-b border-gray-200">
      {FINANCE_TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-sm transition-colors ${FOCUS_RING} ${
                isActive ? 'border-primary font-semibold text-primary' : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </Link>
          </li>
        );
      })}
    </ul>
  </nav>
);
