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
      // prefetch={false}: 모든 페이지 헤더에 노출되어 자동 prefetch가 home의
      // SSG JSON·featured links 등을 매번 끌어옴. hover/focus 시 prefetch는 유지.
      prefetch={false}
      className="flex-shrink-0 flex items-center hover:opacity-90 transition-opacity duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 rounded-sm"
      onClick={onLogoClick}
    >
      <div className="relative h-8 sm:h-10 w-auto flex items-center">
        {/* NOL Part - Always original color */}
        <Image
          src={siteConfig.logo}
          alt={siteConfig.name}
          // 실제 파일 종횡비(3350×862 = 3.886:1)를 그대로 선언. 200×40(5:1)로 잘못
          // 선언하면 sm(h-10=40px)에서 렌더 높이가 선언 height와 우연히 일치하는데
          // width만 auto로 어긋나 next/image 종횡비 경고가 뜬다. h-full+w-auto는 유지
          // (한 축 auto = 권고 방식), 표시 크기는 CSS가 결정하므로 시각 결과 불변.
          height={862}
          width={3350}
          // sizes 미지정 시 Next.js가 deviceSizes 기준 srcset을 생성해 640w 변종을 요청하던 문제
          // (Lighthouse: 124×32 display에 640×165 image = 12KB 낭비) → 200px 고정으로 imageSizes
          // 기반 srcset 사용하도록 힌트. DPR=2에서 256~384w 변종이 선택됨.
          sizes="200px"
          className="h-full w-auto object-contain"
          style={{
            clipPath: 'inset(0 0 0 52.3%)', // Show only the right part (NOL)
          }}
          // priority 제거 — 200px 작은 로고를 preload하면 LCP 후보(hero 이미지)와
          // 초기 대역폭 경쟁. above-the-fold이지만 작은 이미지라 default loading으로 충분.
        />
        {/* Studio Part - Turns white on dark/transparent backgrounds */}
        <Image
          src={siteConfig.logo}
          alt=""
          aria-hidden="true"
          // 위 로고와 동일: 실제 종횡비 3350×862로 선언(종횡비 경고 방지).
          height={862}
          width={3350}
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
