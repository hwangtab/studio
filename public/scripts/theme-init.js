(function() {
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

    var themeColor = shouldUseDark ? '#1e3a8a' : '#1a56db';
    var metaThemeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor);
    }
  } catch (error) {
    console.warn('theme init failed', error);
  }
})();
