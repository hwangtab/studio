import { useSyncExternalStore } from 'react';

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

const isClient = typeof window !== 'undefined';
let hasHydrated = false;
const hydrationStoreListeners = new Set<() => void>();

const subscribeHydrationStore = (listener: () => void) => {
  hydrationStoreListeners.add(listener);
  return () => hydrationStoreListeners.delete(listener);
};

const getHydrationSnapshot = () => hasHydrated;
const getHydrationServerSnapshot = () => false;

const resolveHydrationOnce = () => {
  if (hasHydrated || !isClient) {
    return;
  }
  hasHydrated = true;
  hydrationStoreListeners.forEach((listener) => listener());
};

const useHasHydrated = (): boolean => {
  return useSyncExternalStore(
    (listener) => {
      const unsubscribe = subscribeHydrationStore(listener);
      resolveHydrationOnce();
      return unsubscribe;
    },
    getHydrationSnapshot,
    getHydrationServerSnapshot
  );
};

export const useDisableMotionEffects = (): boolean => {
  const isIOSSafari = useIsIOSSafari();
  const hasHydratedClient = useHasHydrated();

  // Keep motion disabled until hydration completes to avoid SSR/CSR animation mismatches.
  return !hasHydratedClient || isIOSSafari;
};
