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
    <Html lang="ko" className="scroll-smooth">
      <Head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </Head>
      <body className="bg-white dark:bg-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
