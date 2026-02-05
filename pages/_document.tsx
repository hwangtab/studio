import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

const themeInitializer = `
(function() {
  try {
    var supportedLocales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
    var pathLocale = window.location.pathname.split('/')[1] || 'ko';
    if (supportedLocales.indexOf(pathLocale) !== -1) {
      document.documentElement.lang = pathLocale;
    } else {
      document.documentElement.lang = 'ko';
    }

    var storageKey = 'darkMode';
    var storedPreference = localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);

    // documentElement에 dark 클래스 설정
    document.documentElement.classList.toggle('dark', shouldUseDark);

    // sessionStorage에 초기 상태 저장 (Layout에서 hydration mismatch 방지)
    sessionStorage.setItem('initialDarkMode', shouldUseDark.toString());
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();
`;

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
        className="scroll-smooth"
        prefix="og: https://ogp.me/ns#"
        suppressHydrationWarning
      >
        <Head>
          <link
            rel="preload"
            href="https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSansMedium.woff"
            as="font"
            type="font/woff"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2307-1@1.1/PartialSansKR-Regular.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        </Head>
        <body className="bg-white dark:bg-gray-900 transition-colors duration-300 ease-in-out">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
