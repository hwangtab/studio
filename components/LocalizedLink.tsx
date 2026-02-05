import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useTranslation } from 'react-i18next';

interface LocalizedLinkProps extends LinkProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const LocalizedLink = ({ href, children, ...props }: LocalizedLinkProps) => {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  // Handle external links or already localized links if needed (though usually we pass relative paths)
  // Assuming href is a string for simplicity in this helper
  const path = href.toString();
  const isExternal = path.startsWith('http') || path.startsWith('//');
  const localizedHref = isExternal ? path : `/${locale}${path.startsWith('/') ? '' : '/'}${path}`;

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  );
};
