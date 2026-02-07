import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { defaultLocale, locales, type Locale } from '../lib/i18n';

interface LocalizedLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'> {
  href: LinkProps['href'];
  children: React.ReactNode;
  locale?: Locale;
}

const normalizeLocale = (value?: string): Locale | undefined => {
  const normalized = value?.split('-')[0] as Locale | undefined;
  return normalized && locales.includes(normalized) ? normalized : undefined;
};

export const LocalizedLink = ({ href, children, locale, ...props }: LocalizedLinkProps) => {
  const { i18n } = useTranslation();
  const router = useRouter();
  const resolvedLocale =
    locale ||
    normalizeLocale(router.query.locale as string | undefined) ||
    normalizeLocale(i18n.language) ||
    defaultLocale;

  // Handle external links or already localized links if needed (though usually we pass relative paths)
  // Assuming href is a string for simplicity in this helper
  const path = href.toString();
  const isExternal =
    path.startsWith('http') ||
    path.startsWith('//') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:');
  const isHashOrQuery = path.startsWith('#') || path.startsWith('?');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const hasLocalePrefix = locales.some(
    (candidate) => normalizedPath === `/${candidate}` || normalizedPath.startsWith(`/${candidate}/`)
  );
  const localizedHref = isExternal || isHashOrQuery
    ? path
    : hasLocalePrefix
      ? normalizedPath
      : `/${resolvedLocale}${normalizedPath}`;

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  );
};
