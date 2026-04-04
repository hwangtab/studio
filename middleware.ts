import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales, type Locale } from './lib/i18n-config';
const DEFAULT_SITE_URL = 'https://studionol.co.kr';

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

function buildContentSecurityPolicy(): string {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net https://fastly.jsdelivr.net https://fonts.gstatic.com",
        "frame-src 'self' https://www.google.com https://www.google.co.kr",
        "connect-src 'self' https://api.emailjs.com https://vitals.vercel-insights.com",
        "object-src 'none'",
        "base-uri 'self'",
    ].join('; ');
}

function setSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
    return response;
}

function getPreferredLocale(request: NextRequest): Locale {
    const acceptLanguage = request.headers.get('accept-language');
    if (!acceptLanguage) return defaultLocale;

    const languages = acceptLanguage
        .split(',')
        .map((lang) => {
            const [code, quality] = lang.trim().split(';q=');
            return {
                code: code.split('-')[0].toLowerCase(),
                quality: quality ? parseFloat(quality) : 1.0,
            };
        })
        .sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
        if (locales.includes(code as Locale)) {
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
    if (!pathnameHasLocale) {
        // Redirect to locale-prefixed path
        // 봇(Accept-Language 없음)은 x-default와 일치하도록 /en으로 보냄
        const userAgent = request.headers.get('user-agent') || '';
        const isBot = /bot|googlebot|crawler|spider|robot|crawling|yeti|bingpreview|slurp|duckduckbot/i.test(userAgent);
        const acceptLanguage = request.headers.get('accept-language');
        const locale = (isBot && !acceptLanguage) ? 'en' as Locale : getPreferredLocale(request);
        redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
        shouldRedirect = true;
        shouldVaryByLanguage = true;
    }

    if (shouldRedirect) {
        // 검색 엔진 봇의 접근일 경우 SEO 점수를 올바르게 이전하기 위해 308(영구 이동)을 사용하고,
        // 일반 사용자의 언어 기반 리디렉션은 브라우저 캐싱 방지를 위해 307(임시 이동)을 사용합니다.
        const userAgent = request.headers.get('user-agent') || '';
        const isBot = /bot|googlebot|crawler|spider|robot|crawling|yeti|bingpreview|slurp|duckduckbot/i.test(userAgent);
        const redirectStatus = !shouldVaryByLanguage || isBot ? 308 : 307;

        const response = NextResponse.redirect(redirectUrl, redirectStatus);
        if (shouldVaryByLanguage) {
            response.headers.set('Vary', 'Accept-Language');
        }
        return setSecurityHeaders(response);
    }

    const response = NextResponse.next();
    const pathLocale = pathname.split('/')[1];
    if (locales.includes(pathLocale as Locale)) {
        response.headers.set('Content-Language', pathLocale);
    }
    return setSecurityHeaders(response);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap.*\\.xml|locales|images|logo.*|audio|styles|fonts).*)',
    ],
};
