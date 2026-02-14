import { NextRequest, NextResponse } from 'next/server';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'ko';
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
        const locale = getPreferredLocale(request);
        redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
        shouldRedirect = true;
        shouldVaryByLanguage = true;
    }

    if (shouldRedirect) {
        // Language negotiation redirects should be temporary to avoid sticky caching by intermediaries.
        const redirectStatus = shouldVaryByLanguage ? 307 : 308;
        const response = NextResponse.redirect(redirectUrl, redirectStatus);
        if (shouldVaryByLanguage) {
            response.headers.set('Vary', 'Accept-Language');
        }
        return setSecurityHeaders(response);
    }

    const response = NextResponse.next();
    return setSecurityHeaders(response);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap.*\\.xml|locales|images|logo.*|audio|styles|fonts).*)',
    ],
};
