import { track } from '@vercel/analytics/react';
import { defaultLocale, locales, type Locale } from '../lib/i18n-config';

type LeadEventValue = string | number | boolean | null | undefined;

export type LeadEventName =
  | 'lead_click_kakao'
  | 'lead_click_phone'
  | 'lead_submit_success'
  | 'lead_submit_error'
  // 폼 funnel 분석용 — 방문자가 어느 단계에서 이탈하는지 추적.
  | 'lead_form_start'        // 첫 필드 입력 시작
  | 'lead_form_field_error'  // 필드 검증 실패 (어느 필드에서 막히는지)
  | 'lead_form_abandon';     // 폼 시작했으나 성공 전 페이지 이탈

export type LeadEventProps = {
  locale?: Locale | string;
  path?: string;
  component: string;
  cta_id?: string;
  landing_slug?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
} & Record<string, LeadEventValue>;

const getSearchParam = (key: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  return new URLSearchParams(window.location.search).get(key) || undefined;
};

const normalizePath = (path?: string): string => {
  const fallbackPath =
    typeof window !== 'undefined' ? window.location.pathname || '/' : '/';
  const basePath = (path || fallbackPath).split('?')[0].split('#')[0];

  if (!basePath) return '/';
  return basePath.startsWith('/') ? basePath : `/${basePath}`;
};

const getLocaleFromPath = (path: string): Locale => {
  const firstSegment = path.split('/').filter(Boolean)[0];
  if (firstSegment && locales.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  return defaultLocale;
};

const getLandingSlug = (path: string): string => {
  const segments = path.split('/').filter(Boolean);
  const segmentsWithoutLocale =
    segments.length > 0 && locales.includes(segments[0] as Locale)
      ? segments.slice(1)
      : segments;

  if (segmentsWithoutLocale.length === 0) {
    return 'home';
  }

  return segmentsWithoutLocale[0];
};

const toFlatProperties = (
  payload: Record<string, LeadEventValue>
): Record<string, string | number | boolean | null> =>
  Object.entries(payload).reduce<Record<string, string | number | boolean | null>>(
    (acc, [key, value]) => {
      if (value === undefined) return acc;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        acc[key] = value;
      }
      return acc;
    },
    {}
  );

type GtagFn = (command: 'event', eventName: string, params: Record<string, unknown>) => void;

export const trackLeadEvent = (name: LeadEventName, props: LeadEventProps): void => {
  if (typeof window === 'undefined') return;

  const path = normalizePath(props.path);
  const locale = props.locale || getLocaleFromPath(path);

  const payload = toFlatProperties({
    ...props,
    locale,
    path,
    landing_slug: props.landing_slug || getLandingSlug(path),
    utm_source: props.utm_source ?? getSearchParam('utm_source'),
    utm_medium: props.utm_medium ?? getSearchParam('utm_medium'),
    utm_campaign: props.utm_campaign ?? getSearchParam('utm_campaign'),
  });

  // 1) Vercel Analytics — 항상 전송 (페이지 즉시 집계)
  track(name, payload);

  // 2) Google Analytics 4 — gtag.js가 lazyOnload라 페이지 로드 초반엔 없음.
  //    존재할 때만 동일 payload 전송. GA4 Conversions·Funnels 설정 가능.
  const gtag = (window as typeof window & { gtag?: GtagFn }).gtag;
  if (typeof gtag === 'function') {
    gtag('event', name, payload);
  }
};
