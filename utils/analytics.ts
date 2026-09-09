import { track } from '@vercel/analytics/react';
import { defaultLocale, locales, type Locale } from '../lib/i18n-config';

type LeadEventValue = string | number | boolean | null | undefined;

export type LeadEventName =
  | 'lead_click_kakao'
  | 'lead_click_phone'
  | 'lead_click_naver_map'
  | 'lead_click_email'
  | 'lead_submit_success'
  | 'lead_submit_error'
  // 폼 funnel 분석용 — 방문자가 어느 단계에서 이탈하는지 추적.
  | 'lead_form_start'        // 첫 필드 입력 시작
  | 'lead_form_field_error'  // 필드 검증 실패 (어느 필드에서 막히는지)
  | 'lead_form_abandon';      // 폼 시작했으나 성공 전 페이지 이탈

/**
 * 마이크로 전환 — 리드가 아니다.
 * 리드 지표(카카오·전화·이메일·폼 제출)는 이 사업의 유일하게 신뢰 가능한 신호이므로
 * 마이크로 클릭으로 희석하지 않는다.
 * scripts/ga4-fetch.mjs의 QUALIFIED_LEAD_EVENT_NAMES에 절대 넣지 말 것.
 *
 * micro_click_contact: 문의 페이지(/contact)로의 "이동" — 문의 자체가 아니다.
 * 이전에는 lead_click_contact라는 이름이었는데, `lead_` 접두사 때문에 GA4 콘솔에서
 * 주요 이벤트(key event) 지정 시 `lead_*` 패밀리를 훑다가 함께 체크될 위험이 있었다.
 * micro_ 접두사로 "리드 아님"을 이름 자체에 새긴다. 이 이벤트를 GA4 콘솔에서
 * 주요 이벤트로 지정하지 말 것 — 그러면 유일하게 신뢰 가능한 지표(카톡 리드)가
 * 다시 오염된다.
 */
// funding_pledge_start / funding_pledge_paid: 펀딩 신청 제출·확정 마이크로 전환.
// 위 micro_ 계열과 동일 이유로 GA4 key event로 지정 금지 — 지정하면 유일하게
// 신뢰 가능한 지표(카톡 리드)가 다시 희석된다.
// micro_click_booking_entry: 온라인 예약/주문 페이지(`/ko/booking/*`)로의 "이동" —
// 결제 확정이 아니다. 카카오 상담 없이 결제 퍼널로 바로 들어가는 신호이긴 하나
// 리드는 아니므로(진짜 전환은 결제 확정) micro_ 접두사로 남긴다. 이전 이름
// lead_click_booking_entry는 `lead_` 접두사 때문에 GA4 key event 지정 시
// lead_* 패밀리와 함께 체크될 위험이 있었다 — micro_click_contact와 같은 이유.
// pricing·mixing-mastering의 PricingCard 보조 CTA가 발화한다.
export type MicroEventName =
  | 'micro_click_service'
  | 'micro_click_contact'
  | 'micro_click_booking_entry'
  | 'funding_pledge_start'
  | 'funding_pledge_paid';

export type TrackedEventName = LeadEventName | MicroEventName;

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

const getGtag = (): GtagFn | undefined => {
  const gtag = (window as typeof window & { gtag?: GtagFn }).gtag;
  return typeof gtag === 'function' ? gtag : undefined;
};

// GA4(gtag.js)는 PSI 점수 보호를 위해 첫 인터랙션 이후에야 로드된다(DeferredAnalytics).
// 그런데 lead_form_start는 "첫 타이핑" 시점에 발화하므로, keydown이 로드를 트리거한 바로
// 그 순간 gtag는 아직 없다. 예전 구현은 이 이벤트를 조용히 버렸고, 그 결과 폼 퍼널 초반이
// 구조적으로 과소집계됐다.
//
// window.dataLayer에 직접 밀어넣는 것으로는 해결되지 않는다 — gtag.js는 dataLayer를 순서대로
// 처리하는데, config보다 먼저 도착한 event는 측정 ID가 없어 버려진다. 그래서 여기 큐에
// 담아뒀다가 ga4-init.js가 config를 끝낸 뒤 flushPendingLeadEvents()로 내보낸다.
//
// 상한을 두는 이유: 사용자가 끝내 인터랙션하지 않아 GA4가 영영 로드되지 않는 경우
// (봇·프리렌더) 큐가 무한히 자라지 않게 한다. 리드 이벤트는 세션당 한 자릿수라 넉넉하다.
const MAX_PENDING_EVENTS = 20;
const pendingEvents: Array<[TrackedEventName, Record<string, unknown>]> = [];

/** ga4-init.js가 gtag config를 끝낸 뒤 호출된다 (DeferredAnalytics의 Script onLoad). */
export const flushPendingLeadEvents = (): void => {
  if (typeof window === 'undefined') return;
  const gtag = getGtag();
  if (!gtag) return; // 아직 준비 안 됨 — 큐를 유지한 채 다음 기회를 기다린다.

  while (pendingEvents.length > 0) {
    const [name, payload] = pendingEvents.shift() as [TrackedEventName, Record<string, unknown>];
    gtag('event', name, payload);
  }
};

const trackEvent = (name: TrackedEventName, props: LeadEventProps): void => {
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

  // 2) Google Analytics 4 — gtag.js는 interaction-deferred라 초반엔 없다.
  //    없으면 버리지 말고 큐에 담아 로드 직후 flush한다.
  const gtag = getGtag();
  if (gtag) {
    gtag('event', name, payload);
  } else if (pendingEvents.length < MAX_PENDING_EVENTS) {
    pendingEvents.push([name, payload]);
  }
};

export const trackLeadEvent = (name: LeadEventName, props: LeadEventProps): void =>
  trackEvent(name, props);

/** 마이크로 전환 전용. 리드 집계에 포함되지 않는다 — MicroEventName 주석 참조. */
export const trackMicroEvent = (name: MicroEventName, props: LeadEventProps): void =>
  trackEvent(name, props);
