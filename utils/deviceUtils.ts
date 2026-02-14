import { useEffect, useState, useSyncExternalStore } from 'react';

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

const canDetectInCurrentEnv = typeof window !== 'undefined' && typeof navigator !== 'undefined';
let cachedIsIOSSafari = canDetectInCurrentEnv ? detectIOSSafari() : false;
let hasResolvedIOSSafari = canDetectInCurrentEnv;
const safariStoreListeners = new Set<() => void>();

const subscribeIOSSafariStore = (listener: () => void) => {
  safariStoreListeners.add(listener);
  return () => safariStoreListeners.delete(listener);
};

const getIOSSafariSnapshot = () => cachedIsIOSSafari;
const getIOSSafariServerSnapshot = () => false;

const resolveIOSSafariOnce = () => {
  if (hasResolvedIOSSafari || typeof window === 'undefined') {
    return;
  }
  hasResolvedIOSSafari = true;
  cachedIsIOSSafari = detectIOSSafari();
  safariStoreListeners.forEach((listener) => listener());
};

export const useIsIOSSafari = (): boolean => {
  return useSyncExternalStore(
    (listener) => {
      const unsubscribe = subscribeIOSSafariStore(listener);
      resolveIOSSafariOnce();
      return unsubscribe;
    },
    getIOSSafariSnapshot,
    getIOSSafariServerSnapshot
  );
};

export const useDisableMotionEffects = (): boolean => {
  const isIOSSafari = useIsIOSSafari();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Keep motion disabled until hydration completes to avoid SSR/CSR animation mismatches.
  return !hasMounted || isIOSSafari;
};
