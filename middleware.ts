import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales, type Locale } from './lib/i18n-config';
import { BOT_PATTERN } from './lib/bot-detection';
import { isRoutePatternPath } from './lib/routePattern';
import regionRedirectMap from './lib/regionRedirectMap.json';

const DEFAULT_SITE_URL = 'https://studionol.co.kr';

// 일반 시·군 지역 페이지 386개 → 광역 허브 308 redirect.
// next.config.mjs redirects()는 routes 한도(1000)를 초과하므로 middleware에서 처리.
const REGION_REDIRECT_MAP = regionRedirectMap as Record<string, string>;
const STORIES_PATH_RE = /^\/(ko|en|zh|es|vi|th|uz)\/stories\/([^/]+)\/?$/;

// /stories/<slug>이 스토리가 아니라 상위 페이지로 308되는 슬러그 → 목적지 경로.
// regionRedirectMap이 이 슬러그를 destSlug로 가리킬 때 /stories/destSlug(다시 308)로
// 보내면 2-hop chain이 생기므로, middleware에서 최종 페이지로 곧장 보내 chain을 붕괴한다.
// (next.config.mjs의 동일 슬러그 redirect는 직접 요청 fallback으로 유지.)
const PAGE_REDIRECT_SLUGS: Record<string, string> = {
  'practice-room-drum1': 'practice-room',
};

const parseCanonicalSiteUrl = (): URL | null => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL;
    try {
        return new URL(raw);
    } catch {
        return null;
    }
};

const canonicalSiteUrl = parseCanonicalSiteUrl();
// canonical host 강제는 실제 프로덕션 배포에서만. Vercel 프리뷰도 NODE_ENV=production
// 이라 NODE_ENV 조건만으로는 프리뷰 전체가 studionol.co.kr로 308되어 프리뷰 검증이
// 불가능해진다(2026-07-20 확인). VERCEL_ENV는 배포별 빌드에 production/preview로
// 주입된다. 비-Vercel 환경(로컬 next start 등)은 VERCEL_ENV가 없어 기존 동작 유지.
const shouldEnforceCanonicalHost =
    process.env.NODE_ENV === 'production' &&
    (process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : true) &&
    Boolean(canonicalSiteUrl);

// CSP는 production 빌드에서만 적용된다 — Next.js dev runtime이 react-refresh를 위해
// eval-기반 hot reload를 쓰고 upgrade-insecure-requests는 localhost http를 https로
// 강제해 정적 자산 SSL 오류를 일으키므로 dev에서 CSP를 강제하면 개발이 막힌다.
// production 검증은 `next build && next start`로 별도로 수행한다.
const isCspEnabled = process.env.NODE_ENV === 'production';

function buildContentSecurityPolicy(): string {
    // GA4 초기화를 /scripts/ga4-init.js로 외부화해 'unsafe-inline'이 불필요해졌다.
    // JSON-LD(<script type="application/ld+json">)는 실행되지 않는 데이터 블록이므로
    // 브라우저가 CSP script-src 적용 대상에서 제외한다.
    // theme-init·ga4-init 모두 /scripts/*.js self 서빙. inline event handler는
    // 'script-src-attr none'으로 별도 차단.
    //
    // 추가 보호:
    // - form-action 'self': 폼 제출이 외부로 hijack되지 않도록 self로 한정
    // - manifest-src 'self': PWA manifest는 /api/manifest 자체 호스팅
    // - frame-ancestors 'self': clickjacking 방어 (X-Frame-Options 보강)
    // - base-uri 'self': <base> 태그 주입 통한 상대경로 redirect 차단
    return [
        "default-src 'self'",
        "script-src 'self' https://www.google.com https://www.gstatic.com https://va.vercel-scripts.com https://www.googletagmanager.com",
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        "frame-src 'self' https://www.google.com https://www.google.co.kr",
        "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
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
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
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

    // locale-scoped LLM index 파일은 next.config.mjs rewrites가 처리하므로 middleware
    // bypass. matcher의 negative lookahead가 `llms-full-{ko,en,zh}.txt`까지 정확히
    // 매칭하지 못해 locale prefix가 자동 추가되며 404로 떨어지던 회귀를 명시적 early
    // return으로 해소.
    if (pathname === '/llms-full-ko.txt' || pathname === '/llms-full-en.txt' || pathname === '/llms-full-zh.txt') {
        return NextResponse.next();
    }

    // 라우트 패턴 문자열이 URL로 요청된 것(`/[locale]/contact` 등). 여기서 끊지 않으면
    // 아래 locale 협상이 프리픽스를 붙여 `/en/[locale]/contact`를 만들어내고, 그 404
    // 페이지가 GA4 page_view를 쏴 분석을 오염시킨다(90일간 12건 관측). 404 페이지의
    // LanguageSwitcher가 이 깨진 URL을 링크로 재생산하기까지 한다.
    if (isRoutePatternPath(pathname)) {
        return setSecurityHeaders(new NextResponse(null, { status: 404 }));
    }

    const redirectUrl = request.nextUrl.clone();
    let shouldRedirect = false;
    let shouldVaryByLanguage = false;

    // trailing slash 정규화 — Vercel platform이 trailingSlash:false 규칙에 따라
    // 별도 308을 발사하면 middleware의 locale prefix·region redirect와 합쳐져
    // 2-hop chain이 생긴다. middleware가 슬래시를 미리 정규화해 모든 redirect를
    // single 308로 통합한다. (D-H1 fix)
    const hasTrailingSlash = pathname !== '/' && pathname.endsWith('/');
    let workingPathname = hasTrailingSlash ? pathname.replace(/\/+$/, '') : pathname;
    if (hasTrailingSlash) shouldRedirect = true;

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

    const pathnameHasLocale = locales.some(
        (locale) => workingPathname === `/${locale}` || workingPathname.startsWith(`/${locale}/`)
    );
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = BOT_PATTERN.test(userAgent);

    if (!pathnameHasLocale) {
        // 봇은 Accept-Language 유무와 관계없이 항상 x-default(/ko)로 보내 canonical 신호를 /ko로 집중
        // 일반 사용자는 Accept-Language 기반 감지 유지
        const locale = isBot ? defaultLocale : getPreferredLocale(request);
        workingPathname = `/${locale}${workingPathname === '/' ? '' : workingPathname}`;
        shouldRedirect = true;
        shouldVaryByLanguage = !isBot;
    }

    // 일반 시·군 지역 슬러그 → 광역 허브 308 redirect. trailing slash·locale 정규화
    // 이후 workingPathname 기준으로 매칭하므로 동일 호출 안에서 single 308로 통합.
    const storiesMatch = workingPathname.match(STORIES_PATH_RE);
    if (storiesMatch) {
        const [, locale, slug] = storiesMatch;
        const destSlug = REGION_REDIRECT_MAP[slug];
        if (destSlug) {
            // destSlug가 상위 페이지로 308되는 슬러그면 chain 붕괴 — /stories/destSlug 대신 최종 페이지로.
            workingPathname = PAGE_REDIRECT_SLUGS[destSlug]
                ? `/${locale}/${PAGE_REDIRECT_SLUGS[destSlug]}`
                : `/${locale}/stories/${destSlug}`;
            shouldRedirect = true;
        }
    }

    if (shouldRedirect) {
        // redirect status 결정:
        // shouldVaryByLanguage(= locale 프리픽스 없는 요청 + 비봇)일 때만 307(임시)+Vary: Accept-Language.
        // 이 경로의 최종 목적지는 Accept-Language에 따라 /ko/… vs /en/…로 갈린다. 이를 308(영구)로
        // 내보내면 Vary를 무시하는 중간 캐시가 한 사용자의 언어 redirect를 영구 캐싱해 다른 언어
        // 사용자에게 오배송한다(cache poisoning). region map·trailing slash redirect가 이 locale
        // 감지 경로에 합성돼도 동일하게 307이 된다 — "region/trailing slash는 항상 308"이 아니다.
        // 그 외는 모두 308(영구):
        //  · 봇: Accept-Language와 무관하게 defaultLocale(/ko) 고정 → 결정적이라 영구 안전 + SEO 신호 집중.
        //  · 이미 locale 프리픽스가 있는 요청의 region map·trailing slash redirect: 목적지 locale이
        //    요청 locale과 동일(언어 비의존)하므로 영구가 맞다. 구글은 이 locale URL로 크롤링한다.
        const redirectStatus = !shouldVaryByLanguage || isBot ? 308 : 307;

        // NextURL.pathname setter가 원본 URL의 trailing slash를 보존하는 이슈를 방지하기 위해
        // origin + workingPathname으로 URL 문자열을 직접 구성한다.
        // redirectUrl.origin은 host normalization 이후 canonical 호스트를 반영한다.
        const destUrl = `${redirectUrl.origin}${workingPathname}${redirectUrl.search}`;
        const response = NextResponse.redirect(destUrl, redirectStatus);
        if (shouldVaryByLanguage) {
            response.headers.set('Vary', 'Accept-Language');
        }
        if (isBot) {
            response.cookies.set('__bt', '1', { maxAge: 3600, sameSite: 'lax', path: '/', httpOnly: false });
        }
        return setSecurityHeaders(response);
    }

    const response = NextResponse.next();
    if (isBot) {
        response.cookies.set('__bt', '1', { maxAge: 3600, sameSite: 'lax', path: '/', httpOnly: false });
    }
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
        // /admin/*은 locale 자동 프리픽스 없이 운영자 페이지로 직접 매핑되도록 제외.
        '/((?!api|_next|favicon\\.ico|manifest\\.json|browserconfig\\.xml|sw\\.js|robots\\.txt|sitemap.*\\.xml|llms\\.txt|llms-full.*\\.txt|locales|images|icons|logo.*|audio|styles|scripts|fonts|admin).*)',
    ],
};
