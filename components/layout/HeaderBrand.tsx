import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';

interface HeaderBrandProps {
  locale: Locale;
  isTransparent: boolean;
  isDarkMode: boolean;
  siteConfig: ReturnType<typeof getSiteConfig>;
  onLogoClick: () => void;
}

export const HeaderBrand = ({
  locale,
  isTransparent,
  isDarkMode,
  siteConfig,
  onLogoClick
}: HeaderBrandProps) => {
  return (
    <Link
      href={`/${locale}`}
      className="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity duration-300 focus-visible:outline-none"
      onClick={onLogoClick}
    >
      <div className="relative h-8 sm:h-10 w-auto flex items-center">
        {/* NOL Part - Always original color */}
        <Image
          src={siteConfig.logo}
          alt={siteConfig.name}
          height={40}
          width={200}
          className="h-full w-auto object-contain"
          style={{
            clipPath: 'inset(0 0 0 52.3%)', // Show only the right part (NOL)
          }}
          priority
        />
        {/* Studio Part - Turns white on dark/transparent backgrounds */}
        <Image
          src={siteConfig.logo}
          alt=""
          aria-hidden="true"
          height={40}
          width={200}
          className="h-full w-auto object-contain absolute top-0 left-0 transition-[filter] duration-300"
          style={{
            clipPath: 'inset(0 47.7% 0 0)', // Show only the left part (studio)
            filter: (isTransparent || isDarkMode)
              ? 'brightness(0) invert(1) brightness(1.2)' // Make it white
              : 'none'
          }}
          priority
        />
      </div>
    </Link>
  );
};
