import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';
import Script from 'next/script';

type Props = {
  locale: string;
};

class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps & Props> {
    const initialProps = await Document.getInitialProps(ctx);
    // ctx.query.locale exists because pages are under pages/[locale]/
    const locale = (ctx.query?.locale as string) || 'ko';

    return { ...initialProps, locale };
  }

  render() {
    const { locale } = this.props;

    return (
      <Html
        lang={locale}
        prefix="og: https://ogp.me/ns#"
      >
        <Head>
          {/* Critical fonts for above-the-fold content */}
          <link
            rel="preload"
            href="/fonts/Pretendard-Regular.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/PartialSansKR-Regular.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          {/* Other fonts load on demand */}
          <script
            id="theme-init"
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  try {
                    var supportedLocales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
                    var pathSegments = window.location.pathname.split('/');
                    var pathLocale = pathSegments[1];
                
                    if (supportedLocales.indexOf(pathLocale) !== -1) {
                      document.documentElement.lang = pathLocale;
                    } else {
                      document.documentElement.lang = 'ko';
                    }
                
                    var storageKey = 'darkMode';
                    var storedPreference = localStorage.getItem(storageKey);
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);
                
                    document.documentElement.classList.toggle('dark', shouldUseDark);
                
                    var themeColor = shouldUseDark ? '#1e3a8a' : '#1a56db';
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
