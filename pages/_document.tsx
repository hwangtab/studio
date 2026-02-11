import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

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
            <script src="/scripts/theme-init.js" defer />
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
