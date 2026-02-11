import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

type Props = {
  locale: string;
  nonce?: string;
};

class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext): Promise<DocumentInitialProps & Props> {
    const initialProps = await Document.getInitialProps(ctx);
    // ctx.query.locale exists because pages are under pages/[locale]/
    const locale = (ctx.query?.locale as string) || 'ko';
    const nonceHeader = ctx.req?.headers['x-nonce'];
    const nonce = Array.isArray(nonceHeader) ? nonceHeader[0] : nonceHeader;
    return { ...initialProps, locale, nonce };
  }

  render() {
    const { locale, nonce } = this.props;

    return (
      <Html
        lang={locale}
        prefix="og: https://ogp.me/ns#"
      >
         <Head nonce={nonce}>
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
           <script src="/scripts/theme-init.js" nonce={nonce} defer />
          </Head>
        <body className="bg-white dark:bg-gray-900">
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
