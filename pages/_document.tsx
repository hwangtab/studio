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
          {/*
            Resource hints — 모바일 LCP를 해치지 않도록 최소화.
            - preconnect 0개로 유지: 모든 3rd-party 스크립트(GA4, Vercel Analytics)는 lazyOnload 또는 window.load 이후 발화.
              초기 preconnect는 LCP 이미지·CSS·JS와 소켓/대역폭을 놓고 경쟁하므로 가성비가 나쁨.
            - dns-prefetch만 남김: 라우팅 후 실제 요청 시 DNS lookup 대기를 줄여주는 값싼 힌트(비용 <1KB, 소켓 미점유).
            - contact 페이지 전용 maps.*·www.google.com 프리커넥트는 contact 페이지에서만 주입(향후 필요시).
            - jsdelivr 폴백(Pretendard)은 window.load + 3초 후 주입되므로 초기 preconnect 불필요.
            - vercel.live 는 프리뷰 환경 Comments bar 전용 → 제거.
          */}
          {/* Analytics & form endpoints */}
          <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
          <link rel="dns-prefetch" href="https://www.google-analytics.com" />
          <link rel="dns-prefetch" href="https://analytics.google.com" />
          <link rel="dns-prefetch" href="https://api.emailjs.com" />
          <link rel="dns-prefetch" href="https://vitals.vercel-insights.com" />
          <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
          {/* Pretendard CDN fallback (load + 3s 이후에만 사용) */}
          <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
          {/* Portfolio image CDN prefetch */}
          <link rel="dns-prefetch" href="https://image.bugsm.co.kr" />
          <link rel="dns-prefetch" href="https://i.ytimg.com" />
          <link rel="dns-prefetch" href="https://is1-ssl.mzstatic.com" />
          <link rel="dns-prefetch" href="https://img.tumblbug.com" />
          <link rel="dns-prefetch" href="https://thumb.mt.co.kr" />
          <link rel="dns-prefetch" href="https://cdn.imweb.me" />
          {/* 폰트 preload 제거: Slow 4G에서 1MB 폰트가 preload로 CSS/JS 다운로드를 블로킹하던 현상 해소.
              font-display: swap 으로 시스템 폰트 즉시 렌더 → 폰트 도착 후 swap. FCP 대폭 단축. */}
          {/* theme-init: FOUC 방지를 위해 <head>에서 *동기* 실행이 의도적.
              async/defer를 두면 본문 렌더 후 실행되어 라이트→다크 토글 깜빡임이
              생긴다 (no-sync-scripts 규칙은 일반 외부 라이브러리를 위한 것이라
              이 케이스는 예외). CSP 'unsafe-inline' 표면을 줄이기 위해 외부 파일로
              분리했다. 색상 상수는 components/Layout.tsx 토글 핸들러와 동기화. */}
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script id="theme-init" src="/scripts/theme-init.js" />
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
