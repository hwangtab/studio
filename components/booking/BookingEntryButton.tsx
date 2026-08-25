import React from 'react';
import Link from 'next/link';

export type BookingService = 'recording' | 'voice-acting' | 'wedding-song' | 'cover-video';

interface BookingEntryButtonProps {
  service: BookingService;
  locale: string;
}

/**
 * 서비스 페이지 CTA 섹션에서 `/ko/booking/[service]` 예약 플로우로 들어가는 2차 버튼.
 * 카카오 CTA(옐로, 1차)와 나란히 놓이는 것을 전제로 한다 — 색은 반드시 `bg-primary`
 * 계열이어야 한다(CLAUDE.md 카카오 배색 규칙: 옐로는 카카오톡 목적지 전용).
 * 예약 퍼널은 `/ko/` 전용이므로 ko가 아니면 아무것도 렌더하지 않는다.
 */
const BookingEntryButton = ({ service, locale }: BookingEntryButtonProps) => {
  if (locale !== 'ko') return null;

  return (
    <Link
      href={`/ko/booking/${service}`}
      prefetch={false}
      className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-primary text-white font-bold text-lg hover:bg-primary-dark shadow-md hover:shadow-lg transition-colors duration-200"
    >
      온라인 예약
    </Link>
  );
};

export default BookingEntryButton;
