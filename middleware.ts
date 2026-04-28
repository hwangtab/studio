import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales, type Locale } from './lib/i18n-config';
import { BOT_PATTERN } from './lib/bot-detection';
import regionRedirectMap from './lib/regionRedirectMap.json';

const DEFAULT_SITE_URL = 'https://studionol.co.kr';

// 일반 시·군 지역 페이지 386개 → 광역 허브 308 redirect.
// next.config.mjs redirects()는 routes 한도(1000)를 초과하므로 middleware에서 처리.
const REGION_REDIRECT_MAP = regionRedirectMap as Record<string, string>;
const STORIES_PATH_RE = /^\/(ko|en|zh|es|vi|th|uz)\/stories\/([^/]+)\/?$/;

const parseCanonicalSiteUrl = (): URL | null => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL;
    try {
        return new URL(raw);
    } catch {
        return null;
    }
};

const canonicalSiteUrl = parseCanonicalSiteUrl();
const shouldEnforceCanonicalHost = process.env.NODE_ENV === 'production' && Boolean(canonicalSiteUrl);

// CSP는 production 빌드에서만 적용된다 — Next.js dev runtime이 react-refresh를 위해
// eval-기반 hot reload를 쓰고 upgrade-insecure-requests는 localhost http를 https로
// 강제해 정적 자산 SSL 오류를 일으키므로 dev에서 CSP를 강제하면 개발이 막힌다.
// production 검증은 `next build && next start`로 별도로 수행한다.
const isCspEnabled = process.env.NODE_ENV === 'production';

function buildContentSecurityPolicy(): string {
    // SSG-heavy 아키텍처(8,500+ prerendered routes)에서 'unsafe-inline'은 페이지별로
    // 동적 생성되는 application/ld+json schema(_app.tsx Site Navigation, components/SEO.tsx
    // 페이지별 graph)를 위해 현재 필요. JSON-LD는 type 상 실행되지 않는 데이터지만 CSP는
    // 모든 <script> 태그에 적용되므로 inline 허용이 필수다.
    //
    // theme-init은 외부 /scripts/theme-init.js로 분리되어 'self'만으로 허용된다 — inline
    // script 표면이 줄어 XSS 공격 surface가 낮아졌다. inline event handler는
    // 'script-src-attr none'으로 별도 차단된다.
    //
    // 추가 보호:
    // - form-action 'self': 폼 제출이 외부로 hijack되지 않도록 self로 한정
    // - manifest-src 'self': PWA manifest는 /api/manifest 자체 호스팅
    // - frame-ancestors 'self': clickjacking 방어 (X-Frame-Options 보강)
    // - base-uri 'self': <base> 태그 주입 통한 상대경로 redirect 차단
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com https://www.googletagmanager.com",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://fonts.gstatic.com",
        "frame-src 'self' https://www.google.com https://www.google.co.kr",
        "connect-src 'self' https://api.emailjs.com https://vitals.vercel-insights.com https://va.vercel-scripts.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "manifest-src 'self'",
        "upgrade-insecure-requests",
    ].join('; ');
}

function setSecurityHeaders(response: NextResponse): NextResponse {
    if (isCspEnabled) {
        response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
    }
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions-Policy single source. 음악 스튜디오 사이트 특성상 카메라/마이크/
    // 결제·USB·센서류 권한 사용 가능성이 없어 모두 차단. 향후 AR 투어, device
    // orientation 등 새 기능에서 센서가 필요하면 명시적으로 풀어주는 형태로 변경.
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );
    return response;
}

function getPreferredLocale(request: NextRequest): Locale {
    const acceptLanguage = request.headers.get('accept-language');
    if (!acceptLanguage) return defaultLocale;

    const languages = acceptLanguage
        .split(',')
        .map((lang) => {
            const [rawCode, quality] = lang.trim().split(';q=');
            const parts = rawCode.trim().split('-');
            const langCode = parts[0].toLowerCase();
            const regionCode = parts[1]?.toLowerCase();
            // 번체 중국어(zh-TW, zh-HK, zh-Hant)는 간체 zh 매칭에서 제외
            const isTraditionalChinese = langCode === 'zh' && regionCode && ['tw', 'hk', 'hant'].includes(regionCode);
            return {
                code: isTraditionalChinese ? null : langCode,
                quality: quality ? parseFloat(quality) : 1.0,
            };
        })
        .sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
        if (code && locales.includes(code as Locale)) {
            return code as Locale;
        }
    }
    return defaultLocale;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const redirectUrl = request.nextUrl.clone();
    let shouldRedirect = false;
    let shouldVaryByLanguage = false;

    if (
        shouldEnforceCanonicalHost &&
        canonicalSiteUrl &&
        redirectUrl.hostname !== canonicalSiteUrl.hostname
    ) {
        redirectUrl.protocol = canonicalSiteUrl.protocol;
        redirectUrl.hostname = canonicalSiteUrl.hostname;
        redirectUrl.port = canonicalSiteUrl.port;
        shouldRedirect = true;
    }

    // Skip if path already has a locale prefix
    const pathnameHasLocale = locales.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = BOT_PATTERN.test(userAgent);

    if (!pathnameHasLocale) {
        // Redirect to locale-prefixed path
        // 봇은 Accept-Language 유무와 관계없이 항상 x-default(/ko)로 보내 canonical 신호를 /ko로 집중
        // 일반 사용자는 Accept-Language 기반 감지 유지
        const locale = isBot ? defaultLocale : getPreferredLocale(request);
        redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
        shouldRedirect = true;
        shouldVaryByLanguage = !isBot;
    }

    if (shouldRedirect) {
        // 검색 엔진 봇의 접근일 경우 SEO 점수를 올바르게 이전하기 위해 308(영구 이동)을 사용하고,
        // 일반 사용자의 언어 기반 리디렉션은 브라우저 캐싱 방지를 위해 307(임시 이동)을 사용합니다.
        const redirectStatus = !shouldVaryByLanguage || isBot ? 308 : 307;

        const response = NextResponse.redirect(redirectUrl, redirectStatus);
        if (shouldVaryByLanguage) {
            response.headers.set('Vary', 'Accept-Language');
        }
        return setSecurityHeaders(response);
    }

    // 일반 시·군 지역 페이지 → 광역 허브 308 redirect.
    const storiesMatch = pathname.match(STORIES_PATH_RE);
    if (storiesMatch) {
        const [, locale, slug] = storiesMatch;
        const destSlug = REGION_REDIRECT_MAP[slug];
        if (destSlug) {
            // request.nextUrl.clone()은 입력의 trailing slash를 destination에 보존하는데,
            // 프로젝트는 trailingSlash:false라 Next.js가 한번 더 308 → redirect chain 생성.
            // origin 기준으로 새 URL을 만들어 canonical 형태(no slash)로 한 번에 보낸다.
            const regionRedirect = new URL(`/${locale}/stories/${destSlug}`, request.nextUrl);
            const response = NextResponse.redirect(regionRedirect, 308);
            return setSecurityHeaders(response);
        }
    }

    const response = NextResponse.next();
    const pathLocale = pathname.split('/')[1];
    if (locales.includes(pathLocale as Locale)) {
        response.headers.set('Content-Language', pathLocale);
    }
    setSecurityHeaders(response);
    return response;
}

export const config = {
    matcher: [
        // icons / browserconfig.xml 추가: /icons/icon-192.png이 로케일 미들웨어에 걸려
        // /ko/icons/icon-192.png로 307 → 404가 발생하던 PWA/Apple touch icon 요청 수정.
        '/((?!api|_next|favicon\\.ico|manifest\\.json|browserconfig\\.xml|sw\\.js|robots\\.txt|sitemap.*\\.xml|llms\\.txt|llms-full\\.txt|locales|images|icons|logo.*|audio|styles|scripts|fonts).*)',
    ],
};
