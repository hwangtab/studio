import React from 'react';
import Link from 'next/link';

import type { BookingService } from '../../lib/booking/products';
import { trackMicroEvent } from '../../utils/analytics';
import { Button } from '../ui/Button';

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
    <Button asChild variant="solid" shape="pill" size="lg">
      <Link
        href={`/ko/booking/${service}`}
        prefetch={false}
        onClick={() =>
          trackMicroEvent('micro_click_booking_entry', {
            locale,
            component: 'BookingEntryButton',
            cta_id: `${service}_booking_entry`,
          })
        }
        className="h-auto min-h-[48px] py-4 font-bold"
      >
        온라인 예약
      </Link>
    </Button>
  );
};

export default BookingEntryButton;
