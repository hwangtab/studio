# 전환 계측 복구 및 오퍼 정합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리드 계측의 오염(비한국어 `/contact` 클릭이 `lead_click_kakao`로 집계됨)을 제거하고, 지역 연습실 글이 받는 잘못된 오퍼(보컬녹음 가격표)를 연습실 브릿지로 교정한다.

**Architecture:** 두 번의 독립 배포. **배포 1**은 계측만 고친다(행동 변화 없음) — 이후 2주간 새 카톡 기준선을 굳힌다. **배포 2**는 지역 글의 자동 fallback을 슬러그 인지 방식으로 바꾼다. 배포 1이 카톡 리드 수치를 (정확해지는 방향으로) 떨어뜨리므로, 두 배포를 섞으면 그 하락을 배포 2의 탓으로 오독하게 된다. **절대 함께 배포하지 말 것.**

**Tech Stack:** Next.js 15.5.12 (Pages Router), React 19, TypeScript, Jest + Testing Library, react-i18next (7 로케일), GA4 Data API.

## Global Constraints

- **리드 이벤트 집합을 오염시키지 말 것.** `micro_click_service`는 마이크로 전환이며 `scripts/ga4-fetch.mjs`의 `QUALIFIED_LEAD_EVENT_NAMES`에 **절대 넣지 않는다**. `lead_click_contact`도 마찬가지다 — 문의 페이지로의 이동은 문의가 아니다.
- **한국어 CTA의 동작을 바꾸지 말 것.** 카카오톡 87건이 이 사업의 유일하게 검증된 리드 경로다. 한국어에는 **추적만 추가**하고 라벨·목적지·버튼 구성은 그대로 둔다. 특히 한국어 `secondaryLabel`(`actions.location` = "위치")을 "문의하기"류로 바꾸지 않는다.
- **7개 로케일 전부**에 새 i18n 키를 추가해야 한다 (ko, en, zh, es, vi, th, uz). `content/localeKeyParity.test.ts`와 `content/i18nKeys.test.ts`가 CI에서 강제한다.
- **팩트 가드**: `lib/factGuards.ts`가 "english-speaking engineer"류 주장과 전화번호 하드코딩을 CI에서 차단한다. 새 카피를 쓸 때 주의.
- 기존 실패 테스트 1건(`content/i18nKeys.test.ts` — `stories.detail.faqTitle`/`faqSubtitle` 7개 로케일 누락)은 **이 작업과 무관한 선재 결함**이다. 고치지 말고 그대로 두되, 새로 깨뜨리지도 말 것.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 를 붙인다.

---

# 배포 1 — 계측 정확성 (행동 변화 없음)

## Task 1: 이벤트 타입 확장 — `lead_click_contact`, `micro_click_service`

**Files:**
- Modify: `utils/analytics.ts`
- Test: `utils/analytics.test.ts` (기존 파일에 describe 블록 추가)

**Interfaces:**
- Consumes: 없음 (기존 `trackLeadEvent`, `flushPendingLeadEvents`, `LeadEventName`, `LeadEventProps`)
- Produces:
  - `type MicroEventName = 'micro_click_service'`
  - `type TrackedEventName = LeadEventName | MicroEventName`
  - `LeadEventName`에 `'lead_click_contact'` 추가
  - `trackMicroEvent(name: MicroEventName, props: LeadEventProps): void` — Task 3이 사용
  - `trackLeadEvent(name: LeadEventName, props: LeadEventProps): void` — 시그니처 불변, Task 2가 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`utils/analytics.test.ts` 파일 **맨 끝에** 아래 describe 블록을 추가한다. 파일 상단의 import 문도 함께 수정한다.

기존 import 줄:
```ts
import { trackLeadEvent, flushPendingLeadEvents } from './analytics';
```
을 다음으로 교체:
```ts
import { trackLeadEvent, trackMicroEvent, flushPendingLeadEvents } from './analytics';
```

파일 끝에 추가:
```ts
describe('마이크로 전환 이벤트 분리', () => {
  beforeEach(() => {
    removeGtag();
    installGtag();
    flushPendingLeadEvents();
    removeGtag();
  });

  afterEach(removeGtag);

  it('trackMicroEvent는 micro_click_service를 전송한다', () => {
    installGtag();

    trackMicroEvent('micro_click_service', {
      component: 'InlineServiceCallout',
      cta_id: 'inline_service_practice_detail',
      service_type: 'practice',
    });

    expect(getCalls()).toHaveLength(1);
    const [command, name, payload] = getCalls()[0];
    expect(command).toBe('event');
    expect(name).toBe('micro_click_service');
    expect(payload).toMatchObject({ service_type: 'practice' });
  });

  it('마이크로 이벤트도 gtag 로드 전이면 큐에 담긴다', () => {
    trackMicroEvent('micro_click_service', { component: 'InlineServiceCallout' });

    installGtag();
    flushPendingLeadEvents();

    expect(getCalls().map((c) => c[1])).toEqual(['micro_click_service']);
  });

  it('lead_click_contact는 lead_click_kakao와 별개 이벤트로 전송된다', () => {
    installGtag();

    trackLeadEvent('lead_click_contact', {
      component: 'ContactCTA',
      cta_id: 'contact_cta_primary_contact',
    });

    expect(getCalls().map((c) => c[1])).toEqual(['lead_click_contact']);
    expect(getCalls().map((c) => c[1])).not.toContain('lead_click_kakao');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest utils/analytics.test.ts`
Expected: FAIL — `trackMicroEvent is not a function` (또는 TS 컴파일 에러 `'trackMicroEvent'가 없습니다`)

- [ ] **Step 3: 구현**

`utils/analytics.ts`에서 `LeadEventName` 유니온에 `'lead_click_contact'`를 추가한다:

```ts
export type LeadEventName =
  | 'lead_click_kakao'
  | 'lead_click_phone'
  | 'lead_click_naver_map'
  | 'lead_click_email'
  // 문의 페이지로의 "이동" — 문의 자체가 아니다. QUALIFIED 집계에서 제외한다.
  // 이전에는 비한국어 ContactCTA가 /contact로 가면서 lead_click_kakao를 발화해
  // 유일하게 신뢰 가능한 지표(카톡 리드)를 오염시켰다.
  | 'lead_click_contact'
  | 'lead_submit_success'
  | 'lead_submit_error'
  // 폼 funnel 분석용 — 방문자가 어느 단계에서 이탈하는지 추적.
  | 'lead_form_start'        // 첫 필드 입력 시작
  | 'lead_form_field_error'  // 필드 검증 실패 (어느 필드에서 막히는지)
  | 'lead_form_abandon';     // 폼 시작했으나 성공 전 페이지 이탈

/**
 * 마이크로 전환 — 리드가 아니다.
 * 리드 지표(카카오·전화·이메일·폼 제출)는 이 사업의 유일하게 신뢰 가능한 신호이므로
 * 마이크로 클릭으로 희석하지 않는다.
 * scripts/ga4-fetch.mjs의 QUALIFIED_LEAD_EVENT_NAMES에 절대 넣지 말 것.
 */
export type MicroEventName = 'micro_click_service';

export type TrackedEventName = LeadEventName | MicroEventName;
```

이어서 큐 타입과 전송 함수를 바꾼다. 기존:

```ts
const pendingEvents: Array<[LeadEventName, Record<string, unknown>]> = [];
```
을
```ts
const pendingEvents: Array<[TrackedEventName, Record<string, unknown>]> = [];
```
로 바꾸고, `flushPendingLeadEvents`의 shift 캐스팅도 맞춘다:

```ts
    const [name, payload] = pendingEvents.shift() as [TrackedEventName, Record<string, unknown>];
```

마지막으로 기존 `export const trackLeadEvent = (name: LeadEventName, props: LeadEventProps): void => { ... }` 전체를 아래로 교체한다 (본문은 그대로, 이름과 타입만 바뀐다):

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest utils/analytics.test.ts && npm run type-check`
Expected: 9 passed (기존 6 + 신규 3), 타입 체크 통과

- [ ] **Step 5: 커밋**

```bash
git add utils/analytics.ts utils/analytics.test.ts
git commit -m "$(cat <<'EOF'
feat(analytics): lead_click_contact·micro_click_service 이벤트 분리

문의 페이지로의 이동(lead_click_contact)과 서비스 페이지 클릭(micro_click_service)을
실제 리드(카카오·전화·이메일·폼 제출)와 분리한다. 둘 다 QUALIFIED 집계에서 제외한다 —
"카톡 87건"이 이 사업의 유일하게 신뢰 가능한 지표이므로 마이크로 전환으로 희석하지 않는다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `ContactCTA` 계측 버그 수정 + 비한국어 버튼 중복 제거

**Files:**
- Modify: `components/common/ContactCTA.tsx`
- Modify: `public/locales/{ko,en,zh,es,vi,th,uz}/common.json` (`actions.contact` 키 추가)
- Test: `components/common/ContactCTA.test.tsx` (신규)

**Interfaces:**
- Consumes: Task 1의 `trackLeadEvent('lead_click_contact', ...)`
- Produces: 없음 (컴포넌트 내부 변경)

**버그 내용:** `ContactCTA.tsx:47,50` — 비한국어에서 primary 버튼의 목적지는 `/contact`인데 발화 이벤트는 `lead_click_kakao`다. 게다가 라벨이 `actions.kakao`("KakaoTalk")이고 `MessageCircle`(채팅) 아이콘이 붙어 있는데 실제로는 폼 페이지로 간다. 그리고 secondary 버튼도 같은 `/contact`를 가리켜 **버튼 두 개가 같은 목적지**다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/common/ContactCTA.test.tsx` 생성:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ContactCTA from './ContactCTA';
import { trackLeadEvent } from '../../utils/analytics';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const dict: Record<string, string> = {
        'actions.kakao': '카카오톡',
        'actions.location': '위치',
        'actions.contact': '문의하기',
      };
      return dict[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
}));

jest.mock('framer-motion', () => ({
  m: { div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div> },
}));

const baseProps = {
  title: '문의',
  subtitle: '부담 없이 연락 주세요',
  imageSrc: '/images/hardware5.webp',
  imageAlt: 'Studio NOL',
};

describe('ContactCTA 리드 계측', () => {
  beforeEach(() => jest.clearAllMocks());

  it('한국어: primary 버튼은 카카오톡으로 가고 lead_click_kakao를 발화한다', () => {
    render(<ContactCTA locale="ko" {...baseProps} />);

    fireEvent.click(screen.getByRole('link', { name: /카카오톡/ }));

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_kakao', {
      locale: 'ko',
      component: 'ContactCTA',
      cta_id: 'contact_cta_primary_kakao',
    });
  });

  it('한국어: /contact 버튼은 lead_click_contact를 발화한다 (라벨·목적지는 그대로)', () => {
    render(<ContactCTA locale="ko" {...baseProps} />);

    const link = screen.getByRole('link', { name: '위치' });
    expect(link).toHaveAttribute('href', '/ko/contact');

    fireEvent.click(link);

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_contact', {
      locale: 'ko',
      component: 'ContactCTA',
      cta_id: 'contact_cta_secondary_contact',
    });
  });

  it('영어: /contact 버튼이 lead_click_kakao가 아니라 lead_click_contact를 발화한다', () => {
    render(<ContactCTA locale="en" {...baseProps} />);

    fireEvent.click(screen.getByRole('link', { name: /문의하기/ }));

    expect(trackLeadEvent).toHaveBeenCalledWith('lead_click_contact', {
      locale: 'en',
      component: 'ContactCTA',
      cta_id: 'contact_cta_primary_contact',
    });
    expect(trackLeadEvent).not.toHaveBeenCalledWith('lead_click_kakao', expect.anything());
  });

  it('영어: 카카오톡 라벨 버튼을 렌더하지 않는다 (영어권은 카톡을 쓰지 않는다)', () => {
    render(<ContactCTA locale="en" {...baseProps} />);

    expect(screen.queryByRole('link', { name: /카카오톡/ })).toBeNull();
  });

  it('영어: /contact로 가는 버튼이 버튼 행에 하나뿐이다 (중복 제거)', () => {
    const { container } = render(<ContactCTA locale="en" {...baseProps} />);

    const buttonRow = container.querySelector('.flex.flex-col.sm\\:flex-row');
    const contactLinks = buttonRow?.querySelectorAll('a[href="/en/contact"]') ?? [];
    expect(contactLinks).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/common/ContactCTA.test.tsx`
Expected: FAIL — 한국어 secondary 버튼에 onClick이 없어 `lead_click_contact` 미발화, 영어에서 "카카오톡" 라벨 버튼이 렌더됨

- [ ] **Step 3: i18n 키 추가**

7개 로케일 `public/locales/<locale>/common.json`의 `actions` 객체에 `"contact"` 키를 추가한다 (`"location"` 키 바로 뒤).

| 파일 | 추가할 줄 |
|---|---|
| `public/locales/ko/common.json` | `"contact": "문의하기",` |
| `public/locales/en/common.json` | `"contact": "Contact us",` |
| `public/locales/zh/common.json` | `"contact": "联系我们",` |
| `public/locales/es/common.json` | `"contact": "Contáctanos",` |
| `public/locales/vi/common.json` | `"contact": "Liên hệ",` |
| `public/locales/th/common.json` | `"contact": "ติดต่อเรา",` |
| `public/locales/uz/common.json` | `"contact": "Bog'lanish",` |

- [ ] **Step 4: 컴포넌트 구현**

`components/common/ContactCTA.tsx`:

(1) import에 `Mail` 추가 — 4번 줄을 교체:
```tsx
import { Mail, MessageCircle, Sparkles } from '@/lib/lucide-icons';
```

(2) 45~63번 줄(라벨·href·트래킹 콜백)을 아래로 교체:
```tsx
    // 비한국어에서는 primary가 카카오톡이 아니라 문의 폼이다. 라벨·아이콘·이벤트를 모두 그에 맞춘다.
    const primaryLabel = primaryButtonLabel ?? (isKorean ? t('actions.kakao') : t('actions.contact'));
    const secondaryLabel = secondaryButtonLabel ?? t('actions.location');
    const contactHref = getLink('/contact');
    const primaryHref = isKorean ? siteConfig.contact.kakaoUrl : contactHref;
    const imageHref = isKorean ? siteConfig.contact.kakaoUrl : contactHref;

    const trackPrimaryCta = React.useCallback(() => {
        // 목적지가 카카오톡일 때만 카톡 리드다. 비한국어는 /contact로 가므로 별개 이벤트.
        if (isKorean) {
            trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'ContactCTA',
                cta_id: 'contact_cta_primary_kakao',
            });
            return;
        }
        trackLeadEvent('lead_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_primary_contact',
        });
    }, [isKorean, locale]);

    const trackSecondaryContact = React.useCallback(() => {
        trackLeadEvent('lead_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_secondary_contact',
        });
    }, [locale]);

    const trackImageCta = React.useCallback(() => {
        if (isKorean) {
            trackLeadEvent('lead_click_kakao', {
                locale,
                component: 'ContactCTA',
                cta_id: 'contact_cta_image_kakao',
            });
            return;
        }
        trackLeadEvent('lead_click_contact', {
            locale,
            component: 'ContactCTA',
            cta_id: 'contact_cta_image_contact',
        });
    }, [isKorean, locale]);
```

(3) 87~117번 줄의 버튼 행 `<div className="flex flex-col sm:flex-row gap-4">…</div>` 전체를 아래로 교체.
비한국어에서는 secondary 버튼을 렌더하지 않는다 — primary와 목적지가 같아 중복이기 때문이다.

```tsx
                    <div className="flex flex-col sm:flex-row gap-4">
                        {isKorean && (
                            <Link
                                href={contactHref}
                                prefetch={false}
                                onClick={trackSecondaryContact}
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-4 px-8 rounded-2xl shadow-md hover:shadow-lg transition-colors transition-shadow duration-300 border border-gray-100 dark:border-gray-600 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                            >
                                <span className="min-w-0">{secondaryLabel}</span>
                            </Link>
                        )}
                        {isKorean ? (
                            <a
                                href={primaryHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={trackPrimaryCta}
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                            >
                                <MessageCircle className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                <span className="min-w-0">{primaryLabel}</span>
                            </a>
                        ) : (
                            <Link
                                href={primaryHref}
                                prefetch={false}
                                onClick={trackPrimaryCta}
                                className="inline-flex items-center justify-center w-full sm:w-auto text-center break-all sm:break-normal whitespace-normal leading-snug min-h-[44px] bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-colors transition-shadow duration-300 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
                            >
                                <Mail className="mr-2 flex-shrink-0" size={20} aria-hidden="true" />
                                <span className="min-w-0">{primaryLabel}</span>
                            </Link>
                        )}
                    </div>
```

(4) 이미지 링크(123~161번 줄)의 비한국어 `<Link>`에 `onClick={trackImageCta}`를 추가하고, 한국어 `<a>`의 `onClick={trackImageKakao}`를 `onClick={trackImageCta}`로 바꾼다. `trackImageKakao` 콜백은 (2)에서 `trackImageCta`로 대체되어 더 이상 존재하지 않는다.

```tsx
                {isKorean ? (
                    <a
                        href={imageHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={trackImageCta}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
```
```tsx
                    <Link
                        href={imageHref}
                        prefetch={false}
                        onClick={trackImageCta}
                        aria-label={imageAlt}
                        className="relative h-64 md:h-auto overflow-hidden block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900"
                    >
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest components/common/ContactCTA.test.tsx content/localeKeyParity.test.ts content/i18nKeys.test.ts && npm run type-check && npx eslint components/common/ContactCTA.tsx`

Expected: `ContactCTA.test.tsx` 5개 통과, `localeKeyParity` 통과, 타입·린트 클린.
`i18nKeys.test.ts`는 **선재 결함(`stories.detail.faqTitle`) 1건으로 계속 실패한다** — 실패 목록에 `actions.contact`가 **없어야** 성공이다. 있으면 로케일 파일 누락이다.

- [ ] **Step 6: 커밋**

```bash
git add components/common/ContactCTA.tsx components/common/ContactCTA.test.tsx public/locales/*/common.json
git commit -m "$(cat <<'EOF'
fix(analytics): ContactCTA 비한국어 /contact 클릭이 카톡 리드로 집계되던 버그

비한국어 로케일에서 primary 버튼의 목적지는 /contact인데 lead_click_kakao를
발화하고 있었다. 라벨도 actions.kakao("KakaoTalk")에 채팅 아이콘이라, 폼으로 가는
버튼이 카톡 버튼처럼 보였다. 게다가 secondary 버튼도 같은 /contact를 가리켜
버튼 두 개가 같은 목적지였다.

- 비한국어: /contact 버튼 1개로 통합, actions.contact 라벨 + Mail 아이콘,
  lead_click_contact 발화
- 한국어: 동작 불변(카톡이 primary). /contact 버튼에 추적만 추가
- actions.contact 키를 7개 로케일에 추가

이 수정으로 카톡 리드 집계가 줄어든다 — 정확해지는 방향이다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `InlineServiceCallout` 서비스 링크 추적

**Files:**
- Modify: `components/inline/InlineServiceCallout.tsx`
- Test: `components/inline/InlineCtaTracking.test.tsx` (기존 파일 수정)

**Interfaces:**
- Consumes: Task 1의 `trackMicroEvent('micro_click_service', ...)`
- Produces: 없음

**왜 필요한가:** 브릿지 카드의 "서비스 자세히 보기" 링크에 추적이 없어, "스토리 독자가 서비스 페이지로 넘어가는가"가 관측 불가능하다. 배포 2의 성공 판정이 바로 이 지표(`micro_click_service`)에 달려 있으므로 반드시 먼저 깔아야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`components/inline/InlineCtaTracking.test.tsx`의 모듈 mock(14~16번 줄)을 교체:

```tsx
jest.mock('../../utils/analytics', () => ({
  trackLeadEvent: jest.fn(),
  trackMicroEvent: jest.fn(),
}));
```

import 줄(6번)도 교체:
```tsx
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
```

그리고 `describe('inline CTA tracking', ...)` 블록 안 마지막에 테스트 추가:

```tsx
  it('서비스 페이지 링크는 리드가 아니라 micro_click_service로 집계된다', () => {
    render(<InlineServiceCallout type="practice" locale="ko" />);

    fireEvent.click(screen.getByRole('link', { name: /서비스 자세히 보기/ }));

    expect(trackMicroEvent).toHaveBeenCalledWith('micro_click_service', {
      locale: 'ko',
      component: 'InlineServiceCallout',
      cta_id: 'inline_service_practice_detail',
      service_type: 'practice',
    });
    // 리드 지표를 오염시키면 안 된다 — 서비스 페이지 클릭은 문의가 아니다.
    expect(trackLeadEvent).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest components/inline/InlineCtaTracking.test.tsx`
Expected: FAIL — `trackMicroEvent` 미호출 (링크에 onClick이 없음)

- [ ] **Step 3: 구현**

`components/inline/InlineServiceCallout.tsx` 8번 줄 import를 교체:
```tsx
import { trackLeadEvent, trackMicroEvent } from '../../utils/analytics';
```

184~191번 줄의 `<Link>`에 `onClick`을 추가:
```tsx
        <Link
          href={`/${locale}${path}`}
          prefetch={false}
          onClick={() =>
            trackMicroEvent('micro_click_service', {
              locale,
              component: 'InlineServiceCallout',
              cta_id: `inline_service_${type}_detail`,
              service_type: type,
            })
          }
          className="inline-flex items-center gap-1 text-sm font-semibold text-secondary dark:text-secondary-light hover:underline min-h-[44px] touch-manipulation"
        >
          {t('stories.inline.serviceDetail', { defaultValue: '서비스 자세히 보기' })}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest components/inline/InlineCtaTracking.test.tsx && npm run type-check`
Expected: 3 passed, 타입 체크 통과

- [ ] **Step 5: 커밋**

```bash
git add components/inline/InlineServiceCallout.tsx components/inline/InlineCtaTracking.test.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): 브릿지 카드의 서비스 페이지 링크에 micro_click_service 추적

"스토리 독자가 서비스 페이지로 넘어가는가"가 지금까지 관측 불가능했다.
리드가 아니라 마이크로 전환으로 분리 집계한다 — 서비스 페이지 클릭은 문의가 아니다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `ga4-fetch.mjs` 집계 분리

**Files:**
- Modify: `scripts/ga4-fetch.mjs`

**Interfaces:**
- Consumes: Task 1~3이 발화하는 `lead_click_contact`, `micro_click_service`
- Produces: `docs/ga4-raw/events.csv`에 신규 이벤트가 나타남. `source.csv`의 `qualified_leads` 컬럼은 **불변 정의** 유지.

**핵심 제약:** 두 신규 이벤트는 `QUALIFIED_LEAD_EVENT_NAMES`에 **넣지 않는다.** 넣으면 "카톡 87건"이라는 앵커가 다시 오염된다.

- [ ] **Step 1: 구현**

`scripts/ga4-fetch.mjs`의 이벤트 상수 블록(18~44번 줄 부근)을 교체:

```js
const ALL_LEAD_EVENT_NAMES = [
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_email',
  'lead_click_naver_map',
  'lead_click_contact',
  'lead_submit_success',
  'lead_submit_error',
  'lead_form_start',
  'lead_form_abandon',
  'lead_form_field_error',
];

// 마이크로 전환 — 리드가 아니다. 관측은 하되 QUALIFIED에는 절대 넣지 않는다.
const MICRO_EVENT_NAMES = ['micro_click_service'];

// 실제 "문의 행동"만 유효 리드다.
// lead_click_contact(문의 페이지로 이동)와 micro_click_service(서비스 페이지 클릭)는
// 의도적으로 제외한다 — 이동은 문의가 아니다. 이 집합을 넓히면 이 사업의 유일하게
// 신뢰 가능한 지표가 희석된다.
const QUALIFIED_LEAD_EVENT_NAMES = new Set([
  'lead_click_kakao',
  'lead_click_phone',
  'lead_click_email',
  'lead_click_naver_map',
  'lead_submit_success',
]);

const FORM_ERROR_EVENT_NAMES = new Set([
  'lead_submit_error',
  'lead_form_field_error',
  'lead_form_abandon',
]);

const TRACKED_EVENT_NAMES = [...ALL_LEAD_EVENT_NAMES, ...MICRO_EVENT_NAMES];
```

그리고 `fetchEvents`의 `inListFilter.values`를 `TRACKED_EVENT_NAMES`로 바꾼다:

```js
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: TRACKED_EVENT_NAMES,
        },
      },
    },
```

`fetchSource`의 `leadRows` 쿼리는 `ALL_LEAD_EVENT_NAMES`를 그대로 유지한다 (마이크로 이벤트는 소스별 리드 표에 넣지 않는다).

- [ ] **Step 2: 실행해서 확인**

Run: `node --env-file=.env.local scripts/ga4-fetch.mjs`

Expected: 정상 완료. 배포 전이므로 신규 이벤트는 아직 0건이고 `events.csv`에 나타나지 않는다 — **이건 정상이다.** 확인할 것은 (a) 스크립트가 에러 없이 끝나고 (b) `source.csv`의 `qualified_leads` 합계가 이전과 동일한지다.

Run: `python3 -c "
import csv
S=list(csv.DictReader(open('docs/ga4-raw/source.csv')))
print('qualified_leads 합계:', sum(int(r['qualified_leads']) for r in S))
"`
Expected: `96` (배포 전이므로 변화 없어야 한다)

- [ ] **Step 3: 커밋**

```bash
git add scripts/ga4-fetch.mjs docs/ga4-raw/
git commit -m "$(cat <<'EOF'
feat(analytics): ga4-fetch에 lead_click_contact·micro_click_service 집계 추가

두 신규 이벤트를 events.csv에서 관측하되 QUALIFIED_LEAD_EVENT_NAMES에는 넣지 않는다.
문의 페이지로의 이동과 서비스 페이지 클릭은 문의가 아니다. 이 집합을 넓히면
"카톡 리드"라는 유일하게 신뢰 가능한 지표가 희석된다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 배포 1 최종 검증 및 배포

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npx jest`
Expected: **1 failed, 나머지 전부 통과.** 실패는 `content/i18nKeys.test.ts`의 선재 결함(`stories.detail.faqTitle`/`faqSubtitle`) **단 하나**여야 한다. 다른 실패가 있으면 배포하지 말 것.

- [ ] **Step 2: 타입·린트·빌드**

Run: `npm run type-check && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 3: 실브라우저 검증**

`npx next dev -p 3987`로 띄운 뒤 확인한다.

1. `http://localhost:3987/en/practice-room` — 하단 ContactCTA에 **"Contact us"** 버튼 1개만 있고 "KakaoTalk" 버튼이 없어야 한다.
2. `http://localhost:3987/ko/practice-room` — **"카카오톡"** 버튼과 **"위치"** 버튼이 그대로 2개 있어야 한다 (한국어는 불변).
3. `http://localhost:3987/ko/stories/practice-room-keyboard1` — 본문 브릿지 카드의 "서비스 자세히 보기" 클릭 시 콘솔에서 이벤트 확인:
   ```js
   // 개발자도구 콘솔에 붙여넣고, 그 다음 링크를 클릭
   window.dataLayer = window.dataLayer || [];
   window.gtag = (...a) => console.log('EVENT:', a[1], a[2]);
   ```
   Expected: `EVENT: micro_click_service {...service_type: 'practice'...}`

- [ ] **Step 4: 푸시**

```bash
git push
```

- [ ] **Step 5: 기준선 확보 — 2주 대기 (중요)**

배포 1은 **카톡 리드 수치를 떨어뜨린다** (비한국어 `/contact` 클릭이 더 이상 카톡으로 집계되지 않으므로). 이건 정확해지는 것이지 나빠지는 게 아니다.

**배포 후 최소 2주간 Task 6 이후를 진행하지 말 것.** 2주 뒤 아래를 실행해 새 기준선을 기록한다:

```bash
node --env-file=.env.local scripts/ga4-fetch.mjs
python3 -c "
import csv
S=list(csv.DictReader(open('docs/ga4-raw/source.csv')))
E=list(csv.DictReader(open('docs/ga4-raw/events.csv')))
print('신규 qualified_leads 기준선:', sum(int(r['qualified_leads']) for r in S))
from collections import defaultdict
ev=defaultdict(int)
for r in E: ev[r['event_name']] += int(r['event_count'])
for k in ['lead_click_kakao','lead_click_contact','micro_click_service']:
    print(f'  {k}: {ev[k]}')
"
```

기록할 것: **주당 카톡 리드 N건**(새 기준선), `lead_click_contact` 발생량, `micro_click_service` 발생량.
`micro_click_service`가 0이면 배포 1이 실제로 동작하지 않은 것이다 — Task 6으로 넘어가기 전에 원인을 찾아라.

---

# 배포 2 — 지역 글 오퍼 정합 (배포 1 후 2주 경과 필수)

## Task 6: 슬러그 인지 자동 fallback

**Files:**
- Modify: `lib/storyAutoFallback.ts`
- Modify: `lib/stories.ts:376-385` (호출부)
- Test: `lib/storyAutoFallback.test.ts` (기존 파일에 describe 추가)
- Test: `lib/stories.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Consumes: 기존 `PRICING_BY_CATEGORY`, `SERVICE_BY_CATEGORY`, `isRegionHub` (from `lib/regionHubSlugs`)
- Produces:
  - `isPracticeRoomRegionStory(categoryKey: string, slug: string): boolean`
  - `matchPricingForStory(categoryKey: string, slug: string): string | null`
  - `matchServiceForStory(categoryKey: string, slug: string): string | null`
  - 기존 `matchPricingForCategory` / `matchServiceForCategory` / `matchReviewForCategory`는 **그대로 유지**한다 (기본 맵 접근자이며 기존 테스트가 검증 중)

**문제:** `PRICING_BY_CATEGORY.region = 'recording-pro'`이고 `decideAutoFallback`은 price를 service보다 먼저 반환하며 **하나만** 주입한다(`lib/inlineDirectives.ts:92,100`). 결과적으로 "연신내 연습실 월세"로 들어온 사람의 본문에 **시간당 10만원 보컬녹음 가격표**가 꽂히고, 연습실 브릿지는 구조적으로 받을 수 없다.

**분기 기준 — `region` + `practice-room-` 접두사:**

| 그룹 | 편수 | 예시 | 오퍼 |
|---|---|---|---|
| 실상권 연습실 LP | 26 | `practice-room-yeonsinnae1`, `practice-room-samsong1`, `practice-room-deogyang1` | **`service:practice`** |
| 광역 허브 (`isRegionHub`) | 18 | `seoul1`, `busan1`, `jeju1` | `price:recording-pro` (현행 유지) |
| 찾아오는 길 가이드 | 4 | `ktx-gyeongbu-guide1`, `seoul-metro-guide1`, `dongjak1` | `price:recording-pro` (현행 유지) |

**왜 `isRegionHub` 반전이 아니라 접두사인가:** 비허브 region 30편에는 실상권 연습실 26편 외에 `ktx-*-guide1`·`seoul-metro-guide1` 같은 **교통 가이드**가 섞여 있다. 이들은 스튜디오에 **녹음하러 오는** 사람을 위한 글이라 연습실 오퍼가 틀린다. `data/practiceRoomRegionLPs.ts`(21개)도 큐레이션된 부분집합이라 5편(합정·망원·월드컵·대화·화정)을 놓친다.

- [ ] **Step 1: 실패하는 단위 테스트 작성**

`lib/storyAutoFallback.test.ts` 상단 import를 교체:
```ts
import {
  matchPricingForCategory,
  matchReviewForCategory,
  matchServiceForCategory,
  matchPricingForStory,
  matchServiceForStory,
  isPracticeRoomRegionStory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';
```

파일 **맨 끝에** 추가:
```ts
// 실상권 연습실 지역 LP는 "연신내 연습실 월세" 같은 순수 구매 의도로 진입한다.
// 그런데 PRICING_BY_CATEGORY.region = 'recording-pro'이고 decideAutoFallback이 price를
// service보다 먼저 반환하므로, 이 페이지들의 본문에는 시간당 10만원 보컬녹음 가격표가
// 꽂히고 연습실 브릿지는 구조적으로 못 받는다. 슬러그로 분기해 교정한다.
describe('지역 스토리 오퍼 분기', () => {
  describe('isPracticeRoomRegionStory', () => {
    it('region + practice-room- 접두사 → true', () => {
      expect(isPracticeRoomRegionStory('region', 'practice-room-yeonsinnae1')).toBe(true);
      expect(isPracticeRoomRegionStory('region', 'practice-room-deogyang1')).toBe(true);
      expect(isPracticeRoomRegionStory('region', 'practice-room-mangwon1')).toBe(true);
    });

    it('광역 허브는 false — 부산 검색자에게 서울 연습실은 무의미하다', () => {
      expect(isPracticeRoomRegionStory('region', 'seoul1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'busan1')).toBe(false);
    });

    it('찾아오는 길 가이드는 false — 녹음하러 오는 사람이다', () => {
      expect(isPracticeRoomRegionStory('region', 'ktx-gyeongbu-guide1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'seoul-metro-guide1')).toBe(false);
      expect(isPracticeRoomRegionStory('region', 'dongjak1')).toBe(false);
    });

    it('region이 아닌 카테고리는 접두사가 같아도 false', () => {
      expect(isPracticeRoomRegionStory('instrument', 'practice-room-bass-funk1')).toBe(false);
    });
  });

  describe('matchPricingForStory', () => {
    it('실상권 연습실 LP는 가격표를 받지 않는다 (service 자리를 비워준다)', () => {
      expect(matchPricingForStory('region', 'practice-room-yeonsinnae1')).toBeNull();
    });

    it('광역 허브·교통 가이드는 기존대로 recording-pro', () => {
      expect(matchPricingForStory('region', 'seoul1')).toBe('recording-pro');
      expect(matchPricingForStory('region', 'ktx-honam-guide1')).toBe('recording-pro');
    });

    it('다른 카테고리는 카테고리 맵 그대로', () => {
      expect(matchPricingForStory('mixing', 'mixing1')).toBe('mixing-level1');
      expect(matchPricingForStory('instrument', 'practice-room-bass-funk1')).toBeNull();
    });
  });

  describe('matchServiceForStory', () => {
    it('실상권 연습실 LP → practice 브릿지', () => {
      expect(matchServiceForStory('region', 'practice-room-samsong1')).toBe('practice');
    });

    it('광역 허브·교통 가이드는 service 매칭 없음', () => {
      expect(matchServiceForStory('region', 'seoul1')).toBeNull();
      expect(matchServiceForStory('region', 'ktx-gyeongbu-guide1')).toBeNull();
    });

    it('instrument 카테고리는 기존대로 practice', () => {
      expect(matchServiceForStory('instrument', 'practice-room-bass-funk1')).toBe('practice');
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/storyAutoFallback.test.ts`
Expected: FAIL — `matchPricingForStory is not a function` (또는 TS 컴파일 에러)

- [ ] **Step 3: 구현**

`lib/storyAutoFallback.ts`의 `matchServiceForCategory` 정의(38~39번 줄) **바로 아래에** 추가:

```ts
/**
 * "이 글이 실제 상권의 연습실 지역 LP인가?"
 *
 * region 카테고리 라이브 스토리 48편은 성격이 셋으로 갈린다:
 *   - practice-room-{동네} 26편 — 연신내·불광·응암·삼송·덕양 등 실제 통근권. 순수 연습실 의도.
 *   - 광역 허브 18편 (isRegionHub) — seoul1·busan1·jeju1 등. 부산 검색자에게 서울 연습실은 무의미하나
 *     원격 믹싱·데이록 녹음은 유효하므로 녹음 오퍼를 유지한다.
 *   - 교통 가이드 4편 — ktx-*-guide1·seoul-metro-guide1·dongjak1. 스튜디오로 "찾아오는" 사람이므로
 *     녹음 의도다.
 *
 * data/practiceRoomRegionLPs.ts는 hub-and-spoke 섹션용 큐레이션 부분집합(21개)이라
 * 5편(합정·망원·월드컵·대화·화정)을 놓친다. 슬러그 접두사가 실제 분류 기준이다.
 */
export const isPracticeRoomRegionStory = (categoryKey: string, slug: string): boolean =>
  categoryKey === 'region' && slug.startsWith('practice-room-');

/**
 * 슬러그를 함께 보는 가격 매칭.
 * 실상권 연습실 LP는 가격표를 받지 않는다 — decideAutoFallback이 price를 service보다 먼저
 * 반환하고 하나만 주입하므로(lib/inlineDirectives.ts:92,100), 가격을 비워야 연습실 브릿지가 들어간다.
 */
export const matchPricingForStory = (categoryKey: string, slug: string): string | null => {
  if (isPracticeRoomRegionStory(categoryKey, slug)) return null;
  return matchPricingForCategory(categoryKey);
};

/** 슬러그를 함께 보는 서비스 매칭. 실상권 연습실 LP는 연습실 브릿지를 받는다. */
export const matchServiceForStory = (categoryKey: string, slug: string): string | null => {
  if (isPracticeRoomRegionStory(categoryKey, slug)) return 'practice';
  return matchServiceForCategory(categoryKey);
};
```

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `npx jest lib/storyAutoFallback.test.ts`
Expected: 기존 + 신규 전부 통과

- [ ] **Step 5: 커밋 (호출부 배선 전)**

```bash
git add lib/storyAutoFallback.ts lib/storyAutoFallback.test.ts
git commit -m "$(cat <<'EOF'
feat(stories): 슬러그 인지 자동 fallback 매칭 함수 추가

region 카테고리는 실상권 연습실 LP(26편)·광역 허브(18편)·교통 가이드(4편)로 갈리는데
카테고리 맵은 이를 구분하지 못해 전부 보컬녹음 가격표를 받는다. 아직 배선은 하지 않는다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 호출부 배선 + 통합 검증

**Files:**
- Modify: `lib/stories.ts` (import 14~17번 줄, 호출 376~385번 줄)
- Test: `lib/stories.test.ts`

**Interfaces:**
- Consumes: Task 6의 `matchPricingForStory`, `matchServiceForStory`
- Produces: 없음

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`lib/stories.test.ts` 맨 끝에 추가 (파일 상단 import에 `getStoryDetail`이 이미 있다):

```ts
describe('지역 스토리 자동 fallback — 유입 의도와 오퍼 정합', () => {
  it('실상권 연습실 LP는 연습실 브릿지를 받는다 (보컬녹음 가격표가 아니라)', async () => {
    const detail = await getStoryDetail('practice-room-yeonsinnae1', 'ko');

    expect(detail.content).toContain('%%service:practice%%');
    expect(detail.content).not.toContain('%%price:recording-pro%%');
  });

  it('광역 허브는 기존대로 녹음 가격표를 받는다 (원격 믹싱·데이록은 전국 대상)', async () => {
    const detail = await getStoryDetail('seoul1', 'ko');

    expect(detail.content).toContain('%%price:recording-pro%%');
    expect(detail.content).not.toContain('%%service:practice%%');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest lib/stories.test.ts -t '지역 스토리 자동 fallback'`
Expected: FAIL — `practice-room-yeonsinnae1`의 content에 `%%price:recording-pro%%`가 들어 있고 `%%service:practice%%`가 없다

- [ ] **Step 3: 호출부 배선**

`lib/stories.ts` 13~18번 줄의 import를 교체:
```ts
import {
  matchPricingForStory,
  matchReviewForCategory,
  matchServiceForStory,
  injectAutoFallbackMarker,
} from './storyAutoFallback';
```

376~385번 줄을 교체 (`matchPricingForCategory` → `matchPricingForStory`, `matchServiceForCategory` → `matchServiceForStory`, 슬러그 전달):
```ts
    const matchedPriceId = hasFrontmatterFallback
      ? (frontmatterFallback?.price ?? null)
      : matchPricingForStory(baseStory.categoryKey, slug);
    const matchedReviewId = hasFrontmatterFallback
      ? (frontmatterFallback?.review ?? null)
      : matchReviewForCategory(baseStory.categoryKey);
    const bookingMessage = frontmatterFallback?.booking ?? null;
    const reviewSourcedFromFrontmatter = hasFrontmatterFallback && Boolean(frontmatterFallback?.review);
    // inlineFallback 정의 시 카테고리 매핑 전체 우회 (service도 동일 규칙)
    const matchedServiceType = hasFrontmatterFallback ? null : matchServiceForStory(baseStory.categoryKey, slug);
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest lib/stories.test.ts lib/storyAutoFallback.test.ts && npm run type-check && npx eslint lib/stories.ts lib/storyAutoFallback.ts`
Expected: 전부 통과

- [ ] **Step 5: 영향 범위 실측**

배포 전에 실제로 몇 편이 어떻게 바뀌는지 눈으로 확인한다.

```bash
node -e "
const { getStoryDetail } = require('./lib/stories.ts');
" 2>/dev/null || npx tsx -e "
import { getStoryDetail } from './lib/stories';
const targets = ['practice-room-yeonsinnae1','practice-room-samsong1','practice-room-deogyang1','seoul1','ktx-gyeongbu-guide1'];
(async () => {
  for (const slug of targets) {
    const d = await getStoryDetail(slug, 'ko');
    const svc = d.content.includes('%%service:practice%%');
    const price = d.content.includes('%%price:recording-pro%%');
    console.log(\`\${slug.padEnd(28)} service:practice=\${svc}  price:recording-pro=\${price}\`);
  }
})();
"
```

Expected:
```
practice-room-yeonsinnae1    service:practice=true   price:recording-pro=false
practice-room-samsong1       service:practice=true   price:recording-pro=false
practice-room-deogyang1      service:practice=true   price:recording-pro=false
seoul1                       service:practice=false  price:recording-pro=true
ktx-gyeongbu-guide1          service:practice=false  price:recording-pro=true
```

(`npx tsx`가 없으면 이 단계는 Step 6의 브라우저 확인으로 대체해도 된다.)

- [ ] **Step 6: 전체 테스트 + 빌드 + 브라우저 확인**

Run: `npx jest && npm run type-check && npm run lint && npm run build`
Expected: `content/i18nKeys.test.ts` 선재 결함 1건만 실패, 나머지 통과

`npx next dev -p 3987` 후:
1. `http://localhost:3987/ko/stories/practice-room-yeonsinnae1` — 본문에 **음악연습실 브릿지 카드**(월 36만원부터)가 있고, 보컬녹음 가격표가 **없어야** 한다.
2. `http://localhost:3987/ko/stories/seoul1` — 기존대로 **녹음 가격표**가 있어야 한다.

- [ ] **Step 7: 커밋 및 배포**

```bash
git add lib/stories.ts lib/stories.test.ts
git commit -m "$(cat <<'EOF'
fix(stories): 실상권 연습실 지역 LP에 보컬녹음 가격표 대신 연습실 브릿지

"연신내 연습실 월세"로 들어온 사람의 본문 한가운데에 시간당 10만원 보컬녹음
가격표가 꽂히고 있었다. PRICING_BY_CATEGORY.region='recording-pro'인데
decideAutoFallback이 price를 service보다 먼저 반환하고 하나만 주입하기 때문에,
지역 글은 구조적으로 연습실 브릿지를 받을 수 없었다.

구매 의도가 가장 순수한 26편이 유일하게 틀린 상품을 제안받고 있었다.

- practice-room-{동네} 26편 → service:practice
- 광역 허브 18편·교통 가이드 4편 → price:recording-pro 유지
  (부산 검색자에게 서울 연습실은 무의미하나 원격 믹싱은 유효)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 8: 판정 기준 기록 (12주 후)**

**리드로 개선을 "증명"하려 들지 말 것.** 주당 리드 7.5건, 포아송 노이즈 ±2.7건에서 스토리 CVR 0.40%의 50% 개선을 검출하려면 12.6개월이 걸린다.

- **1차 지표 (12주 후)**: 실상권 지역 스토리 랜딩 세션의 `micro_click_service` 클릭률 **≥ 2%**
- **2차 지표 (12주 후)**: 실상권 지역 스토리 랜딩 리드가 이전 90일 대비 **감소하지 않을 것**
- **롤백 조건**: 전체 카톡 클릭의 4주 이동평균이 배포 1에서 확정한 새 기준선 대비 **-35% 이하**. (-20%는 노이즈에 정기적으로 걸리므로 오경보 장치다.)

---

# 코드 변경이 없는 항목

## 결정 3 — 정의형 콘텐츠 신규 생산 중단

코드 작업이 아니라 **운영 정책**이다. 구현할 것이 없다.

- 정의형("~뜻", "~이란") 질의를 겨냥한 **신규 스토리를 발행하지 않는다.** 90일 80클릭(전체 8,788클릭의 0.9%), 리드 0. 구글 AI 개요가 답을 대신하는 제로클릭 SERP다.
- **기존 1,700편은 삭제하지 않는다.** 유지비 0이고, 무권위 도메인(1~3위 노출 0.16%)의 상업 페이지를 평균 6.2위에 붙들고 있는 것이 이 코퍼스의 토픽 신호일 가능성이 반증되지 않았다. 반증 실험의 회복 비용이 비대칭적으로 크다.
- **"상업 의도 콘텐츠로 전환"은 아직 승인되지 않았다.** 어느 채널(구글? 네이버?)을 겨냥할지가 아래 미해결 쟁점 해소 전에는 정해지지 않는다.

## 후속 과제 (별도 계획 필요)

- **네이버 측정 부재.** 가장 잘 전환되는 `/ko/practice-room` 유입의 **32%가 네이버**(m.search.naver.com 105 + naver/organic 25 / 총 408)인데 우리가 보는 검색 데이터는 GSC(구글)뿐이다. 레포에 `docs/naver-blog/`가 이미 있다. **네이버 서치어드바이저 연동**을 별도 계획으로 세워야 한다.
- **영어 세그먼트 재평가.** `/en/*` 100세션 → 리드 9건(9.0%)은 사이트 최고지만 Task 2가 고치는 버그로 오염돼 있었다. **배포 1 후 4주 재측정** 전에는 판단하지 않는다.
- **결제 기록.** 리드 96건 중 실제 결제 건수를 기록하지 않고 있다. 대시보드를 만들 규모가 아니다(주 7.5건) — 스프레드시트 한 장에 손으로 기록한다.
