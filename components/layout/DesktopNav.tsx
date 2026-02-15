import React from 'react';
import { DropdownMenu } from './DropdownMenu';

interface NavGroup {
  id: string;
  label: string;
  items: { label: string; href: string; }[];
}

interface DesktopNavProps {
  navGroups: NavGroup[];
  isTransparent: boolean;
  currentPath: string;
  onNavigate: () => void;
}

export const DesktopNav = ({
  navGroups,
  isTransparent,
  currentPath,
  onNavigate,
}: DesktopNavProps) => {
  return (
    <nav className="hidden xl:flex items-center gap-x-2">
      {navGroups.map((group) => (
        <DropdownMenu
          key={group.id}
          label={group.label}
          items={group.items}
          isTransparent={isTransparent}
          currentPath={currentPath}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
};
