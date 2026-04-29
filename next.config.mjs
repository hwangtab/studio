import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,
  outputFileTracingRoot: __dirname,

  // Optimized image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.bugsm.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'img.tumblbug.com',
      },
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'thumb.mt.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'cdn.imweb.me',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'www.news-art.co.kr',
      },
    ],
    minimumCacheTTL: 31536000, // 1 year for external images
    formats: ['image/avif', 'image/webp'],
    // Tailwind breakpoints 기반 최적 이미지 사이즈 생성
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256, 384],
  },

  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'react-i18next',
      'markdown-to-jsx',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    // critical CSS inlining: 첫 paint에 필요한 CSS만 <style>로 inline해
    // CSS render-blocking을 줄임. PageSpeed 모바일 보고서의 850ms 차단 완화.
    // 빌드 시 critters 라이브러리로 처리되며 prerendered HTML 크기는 +5~10KB 정도.
    optimizeCss: true,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  async rewrites() {
    return [
      { source: '/llms.txt', destination: '/api/llms' },
      { source: '/llms-full.txt', destination: '/api/llms-full' },
    ];
  },

  async headers() {
    return [
      // API 라우트 크롤링 차단 (단, llms.txt rewrite 대상은 제외)
      {
        source: '/api/:path((?!llms$|llms-full$).*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Sitemap & robots.txt Content-Type 헤더
      {
        source: '/sitemap(-[0-9]+)?.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml' },
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=43200' },
        ],
      },
      {
        source: '/robots.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain' },
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=43200' },
        ],
      },
      {
        source: '/llms(-full)?.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // public/ 자산은 content hash 없는 고정 URL이라 immutable 부적합 —
        // theme-init.js 변경 시 재방문자에게 전파되지 않는다. SWR window를 max-age와
        // 동일하게 맞춰 최악의 stale 노출을 2시간으로 제한. theme-init은 <head>에서
        // 동기 실행돼 다크모드 초기화 결과가 첫 페인트에 박히므로, 구버전 노출 시간을
        // 짧게 유지해야 한다. 근본 해결은 hash URL(`theme-init.[hash].js`) 전환.
        source: '/scripts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=3600' },
        ],
      },
      {
        source: '/locales/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=43200' },
        ],
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions-Policy는 middleware.ts가 페이지 응답에 더 엄격한 정책을 적용한다.
          // 정적 자산은 권한 API를 사용하지 않아 헤더가 필요 없으므로 여기선 제외.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
