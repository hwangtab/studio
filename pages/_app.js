import '../styles/globals.css';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

import Head from 'next/head';
import { appWithTranslation } from 'next-i18next';
import Layout from '../components/Layout';
import nextI18NextConfig from '../next-i18next.config';

function StudioNoriApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="스튜디오 놀 - 레코딩, 믹싱, 마스터링 전문 음악 제작 스튜디오" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </>
  );
}

export default appWithTranslation(StudioNoriApp, nextI18NextConfig);
