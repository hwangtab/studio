import { useEffect, useState } from 'react';

export const detectIOSSafari = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  const isIOSDevice =
    /iP(ad|hone|od)/.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);

  const isWebKit = /WebKit/i.test(ua);
  const isExcludedBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);

  return isIOSDevice && isWebKit && !isExcludedBrowser;
};

export const useIsIOSSafari = (): boolean => {
  const [isIOSSafari, setIsIOSSafari] = useState(false);

  useEffect(() => {
    setIsIOSSafari(detectIOSSafari());
  }, []);

  return isIOSSafari;
};
