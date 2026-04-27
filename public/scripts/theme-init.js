/*
 * theme-init: FOUC 방지를 위해 <head>에서 동기 실행되는 외부 스크립트.
 * - 사용자 darkMode 선호(localStorage) 또는 시스템 prefers-color-scheme 적용
 * - <html>에 .dark 클래스 토글, <meta name="theme-color"> 갱신
 * - <html lang> 도 path locale로 설정 (SSR HTML의 lang과 일치 보장)
 *
 * 색상 상수는 components/Layout.tsx의 토글 핸들러와 반드시 동기화.
 * 인라인이 아니라 외부 파일이라 CSP에서 'self'만으로 허용 가능.
 */
(function () {
  try {
    var supportedLocales = ['ko', 'en', 'zh', 'es', 'vi', 'th', 'uz'];
    var pathSegments = window.location.pathname.split('/');
    var pathLocale = pathSegments[1];

    if (supportedLocales.indexOf(pathLocale) !== -1) {
      document.documentElement.lang = pathLocale;
    } else {
      document.documentElement.lang = 'ko';
    }

    var storageKey = 'darkMode';
    var storedPreference = localStorage.getItem(storageKey);
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldUseDark = storedPreference === 'true' || (storedPreference === null && prefersDark);

    document.documentElement.classList.toggle('dark', shouldUseDark);

    var themeColor = shouldUseDark ? '#5b21b6' : '#6d28d9';
    var metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();
