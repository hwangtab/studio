import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';
import { defaultLocale, locales } from '../lib/i18n-config';

type Props = {
  locale: string;
};

class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps & Props> {
    const initialProps = await Document.getInitialProps(ctx);
    // ctx.query.locale exists because pages are under pages/[locale]/
    const locale = (ctx.query?.locale as string) || defaultLocale;

    return { ...initialProps, locale };
  }

  render() {
    const locale = locales.includes(this.props.locale as typeof locales[number])
      ? this.props.locale
      : defaultLocale;

    return (
      <Html
        lang={locale}
        prefix="og: https://ogp.me/ns#"
      >
        <Head>
          <meta name="naver-site-verification" content="ef87236e7323d19bf025b9606fc12ab06707d574" />
          {/* Google Search Console 사이트 인증 — 환경변수 NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
              (GSC에서 발급받은 meta 태그 content 값)을 Vercel에 등록하면 자동 주입. */}
          {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
            <meta
              name="google-site-verification"
              content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
            />
          )}
          {/* Resource hints */}
          <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
          <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://www.google-analytics.com" />
          <link rel="dns-prefetch" href="https://analytics.google.com" />
          <link rel="dns-prefetch" href="https://api.emailjs.com" />
          <link rel="dns-prefetch" href="https://vercel.live" />
          <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://fastly.jsdelivr.net" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://www.google.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://maps.googleapis.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
          <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
          {/* Portfolio image CDN prefetch */}
          <link rel="dns-prefetch" href="https://image.bugsm.co.kr" />
          <link rel="dns-prefetch" href="https://i.ytimg.com" />
          <link rel="dns-prefetch" href="https://is1-ssl.mzstatic.com" />
          <link rel="dns-prefetch" href="https://img.tumblbug.com" />
          <link rel="dns-prefetch" href="https://thumb.mt.co.kr" />
          <link rel="dns-prefetch" href="https://cdn.imweb.me" />
          <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
          {/* 폰트 preload 제거: Slow 4G에서 1MB 폰트가 preload로 CSS/JS 다운로드를 블로킹하던 현상 해소.
              font-display: swap 으로 시스템 폰트 즉시 렌더 → 폰트 도착 후 swap. FCP 대폭 단축. */}
          <script
            id="theme-init"
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var storageKey = 'darkMode';
                    var storedPreference = localStorage.getItem(storageKey);
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);
                
                    document.documentElement.classList.toggle('dark', shouldUseDark);
                
                    var themeColor = shouldUseDark ? '#5b21b6' : '#6d28d9';
                    var metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
                    if (metaThemeColor) {
                      metaThemeColor.setAttribute('content', themeColor);
                    }
                  } catch (error) {
                    console.warn('theme init failed', error);
                  }
                })();
                `,
            }}
          />
        </Head>
        <body className="bg-white dark:bg-gray-900">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
