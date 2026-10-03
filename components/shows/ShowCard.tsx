import Link from 'next/link';

import ResponsiveImage from '../ResponsiveImage';
import BaseCard from '../ui/BaseCard';
import { nextShowtimeOf } from '../../lib/shows/availability';
import { formatWon, SALE_STATE_LABELS } from '../../lib/shows/copy';
import type { PublicShow } from '../../lib/shows/queries';

interface Props {
  show: PublicShow;
  /** 서버가 정한 현재 시각(초) — 하이드레이션 불일치를 피하려고 props로 받는다. */
  nowSec: number;
  /** 지난 공연이면 상태 배지를 '종료'로 고정한다. */
  past?: boolean;
}

/**
 * 공연 목록 카드 — 펀딩 목록 카드(FundingProjectCard)와 같은 재질·구조다: Link > BaseCard glass > 이미지 + 본문.
 * 배지는 디자인 시스템 §4(둥근 알약, 색만 의미에 따라)이고 '예매 중'만 보라 틴트다.
 */
export default function ShowCard({ show, nowSec, past = false }: Props) {
  const next = nextShowtimeOf(show, nowSec) ?? show.showtimes[show.showtimes.length - 1] ?? null;
  const stateKey = show.cancelled ? 'cancelled' : past || !next ? 'ended' : next.saleState;
  const prices = show.ticketTypes.map((t) => t.price);
  const lowPrice = prices.length ? Math.min(...prices) : null;

  return (
    <Link href={`/ko/shows/${show.slug}`} prefetch={false} className="block h-full">
      <BaseCard variant="glass" className="flex h-full flex-col overflow-hidden">
        {show.coverImage ? (
          <ResponsiveImage
            src={show.coverImage}
            alt=""
            containerClassName="relative block aspect-[3/4] w-full overflow-hidden"
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <div aria-hidden="true" className="aspect-[3/4] w-full bg-gray-100 dark:bg-gray-800" />
        )}
        <div className="flex flex-1 flex-col p-6">
          <span
            className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
              stateKey === 'open'
                ? 'bg-primary/10 text-primary dark:bg-primary-light/15 dark:text-primary-lighter'
                : stateKey === 'cancelled'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {SALE_STATE_LABELS[stateKey as keyof typeof SALE_STATE_LABELS]}
          </span>
          <h2 className="typo-card-title mt-3 text-gray-900 dark:text-white">{show.title}</h2>
          {show.subtitle && <p className="typo-card-meta mt-1">{show.subtitle}</p>}
          <p className="typo-card-body mt-2 flex-1">
            {show.presenterName} 주최
            {next && <><br />{next.label}</>}
            <br />
            {show.venueName}
          </p>
          {lowPrice !== null && (
            <div className="mt-4 border-t border-gray-200/70 pt-3 dark:border-gray-700/70">
              <p className="typo-card-meta">
                <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatWon(lowPrice)}</span>
                {prices.length > 1 ? '~' : ''}
              </p>
            </div>
          )}
        </div>
      </BaseCard>
    </Link>
  );
}
