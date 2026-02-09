import Document, { Html, Head, Main, NextScript, DocumentContext, DocumentInitialProps } from 'next/document';

const themeInitializer = `
(function() {
  try {
    var supportedLocales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
    var pathSegments = window.location.pathname.split('/');
    var pathLocale = pathSegments[1];
    
    if (supportedLocales.indexOf(pathLocale) !== -1) {
      document.documentElement.lang = pathLocale;
    } else {
      // For root path or unknown paths, fallback to 'ko'
      document.documentElement.lang = 'ko';
    }

    // sessionStorage 제거, localStorage만 사용
    var storageKey = 'darkMode';
    var storedPreference = localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);

    document.documentElement.classList.toggle('dark', shouldUseDark);
    
    // theme-color 메타 태그 초기 설정
    var themeColor = shouldUseDark ? '#1e3a8a' : '#1a56db';
    var metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
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
        prefix="og: https://ogp.me/ns#"
        suppressHydrationWarning
      >
         <Head>
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
           {/* 
             CSP Nonce Integration Guide:
             
             This inline script currently runs without a nonce attribute.
             The current CSP policy (next.config.mjs) allows 'unsafe-inline' for compatibility.
             
             To enable strict CSP in the future (removing 'unsafe-inline'):
             
             OPTION 1: Use Next.js CSP Nonce (Recommended)
             ─────────────────────────────────────────────
             1. Update next.config.mjs CSP header:
                'Content-Security-Policy': "script-src 'self' 'nonce-{RANDOM}' ..."
             
             2. Modify this _document.tsx to inject nonce:
                - Access nonce from Next.js context via getInitialProps
                - Pass nonce as prop to render()
                - Apply nonce to script tag:
                  <script 
                    nonce={nonce}
                    dangerouslySetInnerHTML={{ __html: themeInitializer }}
                  />
             
             3. Reference: https://nextjs.org/docs/advanced-features/security-headers
             
             OPTION 2: External Script File
             ────────────────────────────────
             1. Move themeInitializer to public/scripts/theme-init.js
             2. Update CSP to allow this specific script:
                'script-src 'self' /scripts/theme-init.js'
             3. Add cache headers in next.config.mjs:
                {
                  source: '/scripts/:path*',
                  headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
                  ]
                }
             4. Reference script in _document.tsx:
                <script src="/scripts/theme-init.js" />
             
             OPTION 3: Hash-based CSP
             ────────────────────────
             1. Generate SHA-256 hash of themeInitializer content
             2. Update CSP to allow specific hash:
                'script-src 'self' 'sha256-{HASH}' ...'
             3. No code changes needed in _document.tsx
             
             Current Status:
             ───────────────
             - CSP allows 'unsafe-inline' (line 88 in next.config.mjs)
             - No nonce currently applied
             - Theme initialization runs before React hydration (correct placement)
             
             Migration Checklist:
             ────────────────────
             [ ] Choose CSP strategy (nonce/external/hash)
             [ ] Update next.config.mjs CSP header
             [ ] Implement nonce injection or external script
             [ ] Test in development: npm start
             [ ] Verify CSP in browser DevTools (Console tab)
             [ ] Run production build: npm run build
             [ ] Test in production environment
             [ ] Remove 'unsafe-inline' from CSP once verified
           */}
           <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
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
