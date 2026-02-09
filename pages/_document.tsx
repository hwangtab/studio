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
        suppressHydrationWarning
      >
         <Head nonce={nonce}>
           <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
           <link rel="preconnect" href="https://fastly.jsdelivr.net" crossOrigin="anonymous" />
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
             href="/fonts/GmarketSansBold.woff"
             as="font"
             type="font/woff"
             crossOrigin="anonymous"
           />
           {/* Other fonts (GmarketSansMedium, PartialSansKR-Regular, Pretendard-Bold) will load normally */}
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
