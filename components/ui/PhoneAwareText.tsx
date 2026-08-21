import React from 'react';

import { CANONICAL_FACTS } from '../../lib/factTokens';
import { trackLeadEvent } from '../../utils/analytics';
import type { Locale } from '../../lib/i18n';

const REGEX_META_CHARS = /[.*+?^${}()|[\]\\]/g;
// 국제표기를 먼저 둔다 — 교대(|)는 왼쪽 우선이라 순서를 바꾸면 "+82-10-4255-7893"이
// 국내표기 부분매치로 잘린다.
const PHONE_FORMS = [CANONICAL_FACTS.phoneIntl, CANONICAL_FACTS.phone] as const;
const PHONE_SET = new Set<string>(PHONE_FORMS);
const PHONE_PATTERN = new RegExp(
  `(${PHONE_FORMS.map((v) => v.replace(REGEX_META_CHARS, '\\$&')).join('|')})`,
  'g'
);

const toTelHref = (display: string): string => `tel:${display.replace(/[^0-9+]/g, '')}`;

interface PhoneAwareTextProps {
  text: string;
  locale?: Locale;
  /** GA4 cta_id 접두사 — 어느 면의 전화 클릭인지 구분한다. */
  source: string;
}

/**
 * 평문 문자열 안의 전화번호만 tap-to-call 링크로 승격해 렌더한다.
 *
 * 왜 컴포넌트인가: FAQ 답변 같은 값은 JSON-LD(FAQPage)와 가시 렌더가 같은 원본 문자열을
 * 공유한다. 원본에 마크다운·HTML을 주입하면 구조화 데이터 텍스트가 오염되므로, 원본은
 * 평문 그대로 두고 화면에 그릴 때만 링크로 쪼갠다.
 *
 * "입주 상담은 어떻게 하나요?" 같은 FAQ는 구매 직전 질문인데, 답에 적힌 번호가 눌리지
 * 않는 글자였다.
 */
const PhoneAwareText = ({ text, locale = 'ko', source }: PhoneAwareTextProps) => {
  const parts = React.useMemo(() => text.split(PHONE_PATTERN), [text]);
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) =>
        PHONE_SET.has(part) ? (
          <a
            key={`tel-${index}`}
            href={toTelHref(part)}
            className="text-primary dark:text-primary-light hover:underline underline-offset-4 whitespace-nowrap"
            onClick={() =>
              trackLeadEvent('lead_click_phone', {
                locale,
                component: 'PhoneAwareText',
                cta_id: `${source}_phone`,
              })
            }
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={`t-${index}`}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

export default PhoneAwareText;
