/**
 * GA4(gtag.js)는 PSI 점수 보호를 위해 첫 인터랙션 이후에야 로드된다(DeferredAnalytics).
 * 그런데 lead_form_start는 "첫 타이핑" 시점에 발화하므로, keydown이 스크립트 로드를
 * 트리거한 바로 그 순간 gtag는 아직 존재하지 않는다. 이 구간의 이벤트가 유실되면
 * 폼 퍼널 초반이 구조적으로 과소집계된다(2026-07 진단에서 실제 관측).
 */
import { trackLeadEvent, flushPendingLeadEvents } from './analytics';

type GtagCall = [string, string, Record<string, unknown>];

const getCalls = (): GtagCall[] => (window as unknown as { __calls: GtagCall[] }).__calls;

const installGtag = () => {
  (window as unknown as { __calls: GtagCall[] }).__calls = [];
  (window as unknown as { gtag: unknown }).gtag = (...args: GtagCall) => {
    getCalls().push(args);
  };
};

const removeGtag = () => {
  delete (window as unknown as { gtag?: unknown }).gtag;
};

describe('trackLeadEvent GA4 큐잉', () => {
  beforeEach(() => {
    removeGtag();
    // 이전 테스트가 남긴 큐를 비운다 — gtag를 붙였다 떼며 flush.
    installGtag();
    flushPendingLeadEvents();
    removeGtag();
  });

  afterEach(removeGtag);

  it('gtag가 아직 없으면 이벤트를 버리지 않고 큐에 담는다', () => {
    trackLeadEvent('lead_form_start', { component: 'ContactForm', path: '/ko/contact' });

    installGtag();
    expect(getCalls()).toHaveLength(0); // 아직 flush 전

    flushPendingLeadEvents();

    expect(getCalls()).toHaveLength(1);
    const [command, name, payload] = getCalls()[0];
    expect(command).toBe('event');
    expect(name).toBe('lead_form_start');
    expect(payload).toMatchObject({ component: 'ContactForm', locale: 'ko' });
  });

  it('큐에 쌓인 순서를 그대로 보존한다', () => {
    trackLeadEvent('lead_form_start', { component: 'ContactForm' });
    trackLeadEvent('lead_form_field_error', { component: 'ContactForm', field: 'email' });
    trackLeadEvent('lead_submit_success', { component: 'ContactForm' });

    installGtag();
    flushPendingLeadEvents();

    expect(getCalls().map((c) => c[1])).toEqual([
      'lead_form_start',
      'lead_form_field_error',
      'lead_submit_success',
    ]);
  });

  it('gtag가 이미 있으면 큐를 거치지 않고 즉시 전송한다', () => {
    installGtag();

    trackLeadEvent('lead_click_kakao', { component: 'FloatingCta' });

    expect(getCalls()).toHaveLength(1);
    expect(getCalls()[0][1]).toBe('lead_click_kakao');
  });

  it('flush 이후에 들어온 이벤트는 다시 큐에 쌓이지 않는다', () => {
    trackLeadEvent('lead_form_start', { component: 'ContactForm' });
    installGtag();
    flushPendingLeadEvents();

    trackLeadEvent('lead_submit_success', { component: 'ContactForm' });

    expect(getCalls().map((c) => c[1])).toEqual(['lead_form_start', 'lead_submit_success']);
  });

  it('gtag 없이 flush하면 큐를 비우지 않는다 (유실 방지)', () => {
    trackLeadEvent('lead_form_start', { component: 'ContactForm' });

    flushPendingLeadEvents(); // gtag 없음 — no-op이어야 한다

    installGtag();
    flushPendingLeadEvents();

    expect(getCalls()).toHaveLength(1);
  });

  it('gtag가 끝내 로드되지 않아도 큐가 무한히 자라지 않는다', () => {
    for (let i = 0; i < 100; i += 1) {
      trackLeadEvent('lead_form_field_error', { component: 'ContactForm', field: `f${i}` });
    }

    installGtag();
    flushPendingLeadEvents();

    const calls = getCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(20);
  });
});
