import React from 'react';
import Link from 'next/link';
import { trackMicroEvent } from '../../utils/analytics';
import type { QuoteService } from '../../lib/quote/estimate';

interface QuoteEntryLinkProps {
  /** 분석용 입구 이름 — 어느 자리에서 견적 요청서로 넘어왔는지 센다. */
  ctaId: string;
  children: React.ReactNode;
  /** 견적 요청서에서 미리 골라 둘 서비스·규모(QuoteWizard가 주소에서 읽는다). */
  service?: QuoteService;
  scale?: string;
  className?: string;
}

/**
 * 견적 요청서(/ko/quote) 입구 텍스트 링크 — ko 전용. 호출하는 쪽이 locale을 거른다.
 *
 * 목적지가 카카오톡이 아니므로 옐로를 쓰지 않는다(카카오 배색 규칙). 페이지 이동이라 리드가 아니라
 * micro 이벤트다. 2026-10-12: 견적 요청서가 9/26 출시 뒤 2주간 조회 1회였다 — 입구가 /pricing 표
 * 아래와 문의 페이지뿐이라, 발매 상담(카톡 대부분이 견적·예산 질문)이 실제로 시작되는 발매 LP·발매
 * 글에 입구를 둔다.
 */
const QuoteEntryLink = ({ ctaId, children, service, scale, className = '' }: QuoteEntryLinkProps) => {
  const params = new URLSearchParams();
  if (service) params.set('service', service);
  if (service && scale) params.set('scale', scale);
  const query = params.toString();
  const href = `/ko/quote${query ? `?${query}` : ''}`;
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => trackMicroEvent('micro_click_quote_entry', { locale: 'ko', component: 'QuoteEntryLink', cta_id: ctaId })}
      className={`font-semibold text-primary underline underline-offset-4 hover:text-primary-dark dark:text-primary-lighter dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:focus-visible:ring-primary-lighter/70 rounded ${className}`.trim()}
    >
      {children}
    </Link>
  );
};

export default QuoteEntryLink;
