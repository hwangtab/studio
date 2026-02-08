import { NextRequest, NextResponse } from 'next/server';

const locales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = 'ko';

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

    // Skip if path already has a locale prefix
    const pathnameHasLocale = locales.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );
    if (pathnameHasLocale) return NextResponse.next();

    // Redirect to locale-prefixed path
    const locale = getPreferredLocale(request);
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

    return NextResponse.redirect(newUrl, 307);
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap.*\\.xml|locales|images|logo.*|audio|styles).*)',
    ],
};
