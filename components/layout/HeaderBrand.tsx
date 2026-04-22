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
          // sizes 미지정 시 Next.js가 deviceSizes 기준 srcset을 생성해 640w 변종을 요청하던 문제
          // (Lighthouse: 124×32 display에 640×165 image = 12KB 낭비) → 200px 고정으로 imageSizes
          // 기반 srcset 사용하도록 힌트. DPR=2에서 256~384w 변종이 선택됨.
          sizes="200px"
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
          sizes="200px"
          className="h-full w-auto object-contain absolute top-0 left-0 transition-[filter] duration-300"
          style={{
            clipPath: 'inset(0 47.7% 0 0)', // Show only the left part (studio)
            filter: (isTransparent || isDarkMode)
              ? 'brightness(0) invert(1) brightness(1.2)' // Make it white
              : 'none'
          }}
          priority={false}
        />
      </div>
    </Link>
  );
};
