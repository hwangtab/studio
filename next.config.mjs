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
    // Tailwind breakpoints + 모바일 small device 추가.
    // 360px (Galaxy S 기본) × DPR 2 = 720px → 기존 768 srcset 사용했지만,
    // 작은 안드로이드(320-360 viewport)에서 480 srcset이 더 적합.
    // hero 이미지 sizes="100vw"가 모바일 viewport에 정확히 맞춘 srcset 선택.
    deviceSizes: [480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 64, 96, 128, 256, 384],
  },

  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'markdown-to-jsx',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
    ],
    // optimizeCss(critters) 시도했으나 PageSpeed 모바일 점수 85→38로 급락.
    // TBT가 260ms→7,130ms로 폭증, LCP 3.5s→4.6s 악화. critters가 lazy load CSS를
    // 기다리느라 메인 스레드를 장시간 차단하는 것으로 추정. Next.js 15 + React 19
    // + Pages Router 조합에서 critters가 안정적이지 않다고 판단해 비활성화.

    // nextScriptWorkers(Partytown): TBT 260ms→1,990ms 회귀 확인으로 비활성화.
  },

  eslint: {
    ignoreDuringBuilds: false,
  },

  webpack(config, { dev }) {
    if (!dev) {
      // The production filesystem cache serializes large generated server chunks
      // and emits PackFileCacheStrategy warnings; clean CI/Vercel builds do not
      // benefit enough from that cache to justify the noisy, slower path.
      config.cache = false;
    }

    return config;
  },

  async redirects() {
    return [
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/stories/song-structure1',
        destination: '/:locale/stories/songstructure1',
        permanent: true,
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/stories/practice-room-drum1',
        destination: '/:locale/practice-room',
        permanent: true,
      },
      {
        source: '/en/stories/english-speaking-music-lessons-seoul',
        destination: '/en/stories/recording-in-seoul-for-foreign-musicians',
        permanent: true,
      },
      {
        source: '/zh/stories/chinese-music-lessons-seoul',
        destination: '/zh/stories/recording-in-seoul-for-chinese-musicians',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/llms.txt', destination: '/api/llms' },
      { source: '/llms-full.txt', destination: '/api/llms-full' },
      // locale-scoped LLM index — 영어/중국어 화자 AI 쿼리에 fetch budget 절약 (전체
      // 통합본 839KB → locale별로 100-300KB로 작아져 ChatGPT/Perplexity 인덱싱 효율 ↑).
      { source: '/llms-full-ko.txt', destination: '/api/llms-full?locale=ko' },
      { source: '/llms-full-en.txt', destination: '/api/llms-full?locale=en' },
      { source: '/llms-full-zh.txt', destination: '/api/llms-full?locale=zh' },
    ];
  },

  async headers() {
    return [
      // API 라우트 크롤링 차단 (단, llms.txt rewrite 대상은 제외).
      // CSP는 middleware.ts가 페이지 응답에만 적용 — API는 JSON/text 반환이라 불필요.
      // middleware matcher가 /api/* 를 명시적으로 제외하므로 이 블록에 CSP를 추가해도
      // middleware CSP와 충돌 없음. 현재는 HTML 반환 없으므로 미설정.
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
        // theme-init.js 변경 시 재방문자에게 전파되지 않는다. 다만 git log 기준
        // 변경 빈도가 매우 낮아(연 1-2회) max-age=1일·SWR=1일로 늘려 PSI 캐시 수명
        // 권장치 충족. 최악 stale 노출 2일은 다크모드 초기화 로직 안정성 고려 시 허용.
        // 근본 해결은 hash URL(`theme-init.[hash].js`) 전환.
        source: '/scripts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=86400' },
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
          // Permissions-Policy·CSP는 middleware.ts가 페이지 응답에 더 완성된 정책을 적용한다.
          // 정적 자산은 권한 API / 스크립트를 사용하지 않아 여기선 HSTS만 설정.
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
