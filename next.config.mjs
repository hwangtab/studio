import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  trailingSlash: false,
  outputFileTracingRoot: __dirname,

  // 전자계약 라우트는 계약서 템플릿·이용수칙 마크다운과 한글 폰트를 런타임에 readFileSync로
  // 읽는다. 경로가 동적이라 Next.js 파일 트레이싱이 감지하지 못해, 명시하지 않으면 배포
  // 환경에서 ENOENT로 실패한다(로컬은 소스 트리를 그대로 읽어 드러나지 않음).
  // @sparticuz/chromium은 bin/*.br(압축된 Chromium 바이너리)을 런타임에 풀어 쓴다.
  // 번들에 포함되면 경로가 재배치돼 "input directory does not exist"로 PDF 생성이
  // 실패하므로 externalize해서 node_modules에 그대로 두어야 한다.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],

  outputFileTracingIncludes: {
    '/api/contracts/**': [
      './lib/contracts/*.md',
      './lib/fonts/pretendard-variable-full.woff2',
      './public/images/contract-seal.png',
      // externalize만으로는 .br 바이너리가 추적되지 않는다(코드에서 동적으로 참조).
      './node_modules/@sparticuz/chromium/bin/**',
    ],
    '/[locale]/contracts/**': ['./lib/contracts/*.md'],
    '/admin/contracts/**': ['./lib/contracts/*.md'],
    // 펀딩 프로젝트 md는 런타임에 fs로 읽는다(getFundingProject) — 계약서 md와 같은 이유로
    // 이 목록에 없으면 서버리스 번들에서 빠져 배포판에서만 프로젝트가 통째로 사라진다.
    '/api/funding/**': ['./content/funding/*.md'],
    '/[locale]/funding/**': ['./content/funding/*.md'],
    '/admin/funding/**': ['./content/funding/*.md'],
    '/api/admin/funding/**': ['./content/funding/*.md'],
  },

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
    // next/image가 실제 요청하는 quality 집합만 허용(Next 16 필수 — 미설정 시 실측 경고).
    // 60 = ImageHero 배경(components/common/ImageHero.tsx), 75 = Next.js 기본값
    // (ResponsiveImage 미지정 호출·HeaderBrand 로고 등). 목록 밖 값은 최적화기가 400 반환.
    qualities: [60, 75],
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
      // song-structure1 → songstructure1 규칙은 여기 없다: lib/regionRedirectMap.json에
      // 같은 키가 있어 middleware가 항상 먼저 308을 낸다(실측 2026-09-08, 단일 308 확인).
      // 이 규칙이 있었을 때도 절대 실행되지 않는 죽은 코드였다 — 제거함.
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
      // API 라우트 크롤링 차단.
      // headers()는 rewrite '이전'의 요청 경로로 매칭되므로 /llms.txt·/llms-full-ko.txt로
      // 들어온 요청은 여기 걸리지 않고, 직접 접근한 /api/llms만 noindex를 받는다.
      // (예전에는 negative lookahead로 llms를 제외하고 핸들러가 직접 noindex를 붙였는데,
      //  그러면 rewrite 경로인 /llms.txt에도 noindex가 나가 AI 색인 파일 자신이 비색인이
      //  되는 자기모순이었다. 아래 llms 핸들러의 setHeader 제거와 한 쌍이다.)
      // CSP는 middleware.ts가 페이지 응답에만 적용 — API는 JSON/text 반환이라 불필요.
      // middleware matcher가 /api/* 를 명시적으로 제외하므로 이 블록에 CSP를 추가해도
      // middleware CSP와 충돌 없음. 현재는 HTML 반환 없으므로 미설정.
      {
        source: '/api/:path*',
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
      // 주의: 아래 stale-while-revalidate는 코드상 선언일 뿐, 이 라우트는 서버리스
      // 함수(/api/llms, /api/llms-full)로 rewrite되므로 Vercel이 응답 헤더를 정규화해
      // SWR 지시자가 실제로는 빠진다. 실측(2026-09-08) `/llms.txt` 프로덕션 응답:
      // `Cache-Control: public, max-age=3600`만 나감(stale-while-revalidate 없음).
      // 캐시 자체는 정상 작동(x-vercel-cache: HIT, age 증가) — "재검증 유예 없이 만료
      // 후 즉시 미스"로 동작한다는 뜻이지 캐시가 깨졌다는 뜻이 아니다. 정적 파일인
      // /sitemap.xml은 같은 헤더를 선언해도 SWR이 그대로 보존된다 — 서버리스 응답에서만
      // 벌어지는 차이. 다음에 헤더를 의심하게 되면 코드가 아니라 실제 응답을 먼저 볼 것.
      {
        source: '/llms(-full)?.txt',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
      // locale-scoped 변종은 위 패턴이 잡지 못한다(/llms-full-ko.txt 등). 핸들러가 같은
      // 헤더를 직접 세팅하므로 실피해는 없지만, config가 실제와 어긋나 있으면 나중에
      // 핸들러 쪽을 정리할 때 조용히 깨진다. 같은 서버리스 SWR 소실이 여기도 적용된다.
      {
        source: '/llms-full-:locale(ko|en|zh).txt',
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
      // 계약 페이지 캐시 방어 이중화 — GSSP의 denyContractPageCaching(코드)이 유일한
      // 방어선이었는데, Vercel 프록시가 아래 로케일 캐시 규칙을 함수 헤더보다 먼저
      // 적용하면(next.config headers는 첫 매칭이 우선) 계약 열람 페이지가 s-maxage=3600
      // 으로 공유 캐시에 얹힐 수 있다(미검증 리스크). 이 규칙을 로케일 캐시 규칙보다
      // 앞에 둬 계약 경로만 먼저 매칭시킨다. denyContractPageCaching 호출은 그대로 둘 것
      // — 코드+설정 이중 방어가 목적이라 어느 한쪽만으로 충분하다고 판단해 제거하지 말 것.
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/contracts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      },
      // 펀딩·예약의 결제·관리 화면도 같은 이유로 공유 캐시에 얹히면 안 된다 — URL에
      // 관리 토큰·paymentKey가 실리고, 응답 본문에 후원자 이름·연락처·주소가 들어간다.
      // 계약 규칙과 마찬가지로 아래 로케일 캐시 규칙보다 반드시 앞에 둘 것(첫 매칭 우선).
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/funding/(success|fail)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/funding/(deposit|manage)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/funding/:slug/pledge',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/booking/(success|fail)',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/:locale(ko|en|zh|es|vi|th|uz)/booking/manage/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
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
