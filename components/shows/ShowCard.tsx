import Image from 'next/image';
import Link from 'next/link';

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

const BADGE_TONE: Record<string, string> = {
  open: 'bg-primary text-white dark:bg-primary-lighter dark:text-gray-900',
  sold_out: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
  closed: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
  ended: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
  cancelled: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100',
};

export default function ShowCard({ show, nowSec, past = false }: Props) {
  const next = nextShowtimeOf(show, nowSec) ?? show.showtimes[show.showtimes.length - 1] ?? null;
  const stateKey = show.cancelled ? 'cancelled' : past || !next ? 'ended' : next.saleState;
  const prices = show.ticketTypes.map((t) => t.price);
  const lowPrice = prices.length ? Math.min(...prices) : null;

  return (
    <Link
      href={`/ko/shows/${show.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-lighter dark:focus-visible:ring-primary-lighter/70"
    >
      <div className="relative aspect-[3/4] w-full bg-gray-100 dark:bg-gray-800">
        {show.coverImage && (
          <Image
            src={show.coverImage}
            alt={`${show.title} 포스터`}
            fill
            sizes="(min-width: 1024px) 360px, (min-width: 768px) 45vw, 90vw"
            className="object-cover"
          />
        )}
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${BADGE_TONE[stateKey]}`}>
          {SALE_STATE_LABELS[stateKey as keyof typeof SALE_STATE_LABELS]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <p className="typo-eyebrow">{show.presenterName} 주최</p>
        <h2 className="typo-card-title text-gray-900 dark:text-white">{show.title}</h2>
        {show.subtitle && <p className="typo-card-meta">{show.subtitle}</p>}
        {next && <p className="typo-card-body mt-1">{next.label}</p>}
        <p className="typo-card-body">{show.venueName}</p>
        {lowPrice !== null && (
          <p className="mt-auto pt-3 text-sm font-semibold text-gray-900 dark:text-white">
            {formatWon(lowPrice)}
            {prices.length > 1 ? '~' : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
