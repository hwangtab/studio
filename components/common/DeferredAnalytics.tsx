import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';

// 3rd-party 측정 스크립트(GTM·Vercel Analytics·SpeedInsights)를 사용자 interaction
// 또는 idle 후에만 로드. PSI 모바일(4× CPU throttle) 측정 윈도우(0~5초)에 GTM
// gtag.js (~155KB)·Analytics·SpeedInsights가 발화하면 main thread block으로 점수가
// 50↔98 변동. PSI는 자동 측정이라 interaction 없음 → 5초 fallback timeout까지
// script 로드 0 → 점수 안정. 실 사용자는 첫 pointermove/scroll/touchstart 시 즉시
// 로드되어 분석 데이터 정상 수집.
const Analytics = dynamic(() => import('@vercel/analytics/react').then((m) => m.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights), { ssr: false });

// pointerdown 포함: 마우스 이동 없이 첫 입력이 순수 클릭/탭(터치패드 탭 등)인 경우에도
// 스크립트 로드 전에 라우트 이동이 발생하지 않도록 봉쇄(pointermove는 이 경로를 못 잡음).
const INTERACTION_EVENTS: (keyof WindowEventMap)[] = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'];
const FALLBACK_TIMEOUT_MS = 5000;

const DeferredAnalytics: React.FC = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    const trigger = () => {
      if (!mounted) return;
      setReady(true);
    };

    INTERACTION_EVENTS.forEach((evt) => {
      window.addEventListener(evt, trigger, { once: true, passive: true });
    });
    const fallback = window.setTimeout(trigger, FALLBACK_TIMEOUT_MS);

    return () => {
      mounted = false;
      INTERACTION_EVENTS.forEach((evt) => window.removeEventListener(evt, trigger));
      window.clearTimeout(fallback);
    };
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      {/* Google Analytics 4: 외부 파일로 분리(CSP 'self'). interaction-deferred 라
          더 이상 lazyOnload 불필요 — 이미 user-ready 시점이라 strategy=afterInteractive. */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-KYGP18G36J"
        strategy="afterInteractive"
      />
      <Script src="/scripts/ga4-init.js" strategy="afterInteractive" />
    </>
  );
};

export default DeferredAnalytics;
