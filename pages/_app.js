import '../styles/globals.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import Head from 'next/head';
import { appWithTranslation } from 'next-i18next';
import { Montserrat } from 'next/font/google';
import Layout from '../components/Layout';
import nextI18NextConfig from '../next-i18next.config';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

function StudioNoriApp({ Component, pageProps }) {
  return (
    <div className={montserrat.variable}>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a56db" />
        <meta name="theme-color" content="#1e3a8a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </div>
  );
}

export default appWithTranslation(StudioNoriApp, nextI18NextConfig);
