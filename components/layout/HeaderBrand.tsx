import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { type Locale } from '../../lib/i18n';
import { getSiteConfig } from '../../data/siteConfig';

interface HeaderBrandProps {
  locale: Locale;
  isTransparent: boolean;
  isDarkMode: boolean;
  disableEffects?: boolean;
  siteConfig: ReturnType<typeof getSiteConfig>;
  onLogoClick: () => void;
}

export const HeaderBrand = ({
  locale,
  isTransparent,
  isDarkMode,
  disableEffects = false,
  siteConfig,
  onLogoClick
}: HeaderBrandProps) => {
  const shouldUseWhiteStudio = isTransparent || isDarkMode;

  if (disableEffects) {
    return (
      <Link
        href={`/${locale}`}
        className="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-sm"
        onClick={onLogoClick}
      >
        <div className="relative h-8 sm:h-10 w-auto flex items-center ios-stable-layer">
          {/* Base logo keeps original color for NOL/right side and default studio/left side */}
          <Image
            src={siteConfig.logo}
            alt={siteConfig.name}
            height={40}
            width={200}
            className="h-full w-auto object-contain"
            priority
          />
          {/* iOS-safe color swap: no filter transition, only static overlay visibility */}
          <Image
            src={siteConfig.logo}
            alt=""
            aria-hidden="true"
            height={40}
            width={200}
            className="h-full w-auto object-contain absolute top-0 left-0"
            style={{
              clipPath: 'inset(0 47.7% 0 0)', // studio(left) only
              filter: 'brightness(0) invert(1) brightness(1.2)',
              opacity: shouldUseWhiteStudio ? 1 : 0
            }}
            priority
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/${locale}`}
      className="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-sm"
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
