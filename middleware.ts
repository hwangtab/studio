import { NextRequest, NextResponse } from 'next/server';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'ko';

function createNonce(): string {
    return btoa(crypto.randomUUID());
}

function buildContentSecurityPolicy(): string {
    return [
        "default-src 'self'",
        "script-src 'self' https://cdn.jsdelivr.net https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com",
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

function setSecurityHeaders(response: NextResponse, nonce: string): NextResponse {
    response.headers.set('Content-Security-Policy', buildContentSecurityPolicy());
    response.headers.set('x-nonce', nonce);
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
    const nonce = createNonce();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    // Skip if path already has a locale prefix
    const pathnameHasLocale = locales.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );
    if (pathnameHasLocale) {
        const response = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        return setSecurityHeaders(response, nonce);
    }

    // Redirect to locale-prefixed path
    const locale = getPreferredLocale(request);
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    // SEO: Permanent redirect for locale normalization
    const response = NextResponse.redirect(newUrl, 308);
    response.headers.set('Vary', 'Accept-Language');
    return setSecurityHeaders(response, nonce);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap.*\\.xml|locales|images|logo.*|audio|styles|fonts).*)',
    ],
};
