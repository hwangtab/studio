import { Html, Head, Main, NextScript } from 'next/document';

const themeInitializer = `
(function() {
  try {
    var storageKey = 'darkMode';
    var storedPreference = localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();
`;

export default function Document() {
  return (
    <Html lang="ko" className="scroll-smooth" prefix="og: https://ogp.me/ns#">
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
          href="https://cdn.jsdelivr.net/gh/Project-Noonnu/noonfonts_2107@1.1/Pretendard-Regular.woff"
          as="font"
          type="font/woff"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </Head>
      <body className="bg-white dark:bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
