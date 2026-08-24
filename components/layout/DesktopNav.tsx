import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { DropdownMenu } from './DropdownMenu';
import { defaultLocale, type Locale } from '../../lib/i18n';

interface NavLinkItem {
  kind: 'link';
  id: string;
  label: string;
  href: string;
}

interface NavGroupItem {
  kind: 'group';
  id: string;
  label: string;
  items: { label: string; href: string; }[];
}

export type DesktopNavItem = NavLinkItem | NavGroupItem;

interface DesktopNavProps {
  items: DesktopNavItem[];
  isTransparent: boolean;
  currentPath: string;
  onNavigate: () => void;
  locale?: Locale;
}

// 1탭 링크의 시각 스펙은 DropdownMenu 트리거 버튼과 같다 — 같은 줄에 섞여 있으므로
// 패딩·타이포·상태 색이 어긋나면 두 종류가 다른 위계로 보인다. 차이는 chevron 유무뿐.
const linkClass = (isActive: boolean, isTransparent: boolean) =>
  `flex items-center px-2 xl:px-3 py-2 rounded-md typo-nav-link text-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${isActive
    ? !isTransparent
      ? 'text-primary dark:text-accent font-bold'
      : 'text-white font-bold bg-white/20'
    : !isTransparent
      ? 'text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary dark:hover:text-accent'
      : 'text-white hover:bg-white/10 hover:text-white'
  }`;

export const DesktopNav = ({
  items,
  isTransparent,
  currentPath,
  onNavigate,
  locale = defaultLocale,
}: DesktopNavProps) => {
  const { t } = useTranslation('common', { lng: locale });
  return (
    <nav aria-label={t('nav.mainLabel')} className="hidden lg:flex items-center gap-x-0.5 xl:gap-x-1">
      {items.map((item) => (
        item.kind === 'link' ? (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            onClick={onNavigate}
            aria-current={currentPath === item.href ? 'page' : undefined}
            className={linkClass(currentPath === item.href, isTransparent)}
          >
            {item.label}
          </Link>
        ) : (
          <DropdownMenu
            key={item.id}
            label={item.label}
            items={item.items}
            isTransparent={isTransparent}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        )
      ))}
    </nav>
  );
};
