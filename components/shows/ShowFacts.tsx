import { Button } from '../ui/Button';
import BaseCard from '../ui/BaseCard';
import { formatShowWon, showCopy, type ShowLocale } from '../../lib/shows/i18n';
import type { PublicShow } from '../../lib/shows/queries';
import { showMapLinks } from '../../lib/shows/maps';

interface Props {
  show: PublicShow;
  /** 예매 가능할 때의 버튼 문구. 불가하면 상태 문구를 그대로 보여 준다. */
  ctaLabel: string;
  bookable: boolean;
  locale?: ShowLocale;
}

/**
 * 공연 핵심 정보 패널 — 일시·장소·티켓·관람 + 예매 버튼. 펀딩 상세의 오른쪽 리워드 패널 자리에
 * 놓이고(데스크톱 sticky), <lg에서는 본문 위에 먼저 쌓인다. 회차·티켓 종류가 여럿이어도 세로로 쌓이게
 * 두어 다회차 공연에서도 같은 틀을 쓴다.
 */
export default function ShowFacts({ show, ctaLabel, bookable, locale = 'ko' }: Props) {
  const copy = showCopy(locale);
  const f = copy.facts;
  return (
    <BaseCard variant="glass" className="p-5 sm:p-6">
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="typo-card-meta">{f.when}</dt>
          <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
            <ul className="space-y-0.5">
              {show.showtimes.map((st) => (
                <li key={st.id}>
                  {st.label}
                  {st.saleState !== 'open' && (
                    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">({copy.saleState[st.saleState]})</span>
                  )}
                </li>
              ))}
            </ul>
            {show.scheduleNote && <p className="mt-0.5 font-normal text-gray-600 dark:text-gray-300">{show.scheduleNote}</p>}
          </dd>
        </div>
        <div>
          <dt className="typo-card-meta">{f.where}</dt>
          <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
            {show.venueName}
            <span className="block font-normal text-gray-600 dark:text-gray-300">{show.venueAddress}</span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {showMapLinks({ ...(show.mapSource ?? show), mapLinks: show.mapLinks }, locale).map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded font-normal text-gray-700 underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 dark:text-gray-200 dark:hover:text-primary-lighter dark:focus-visible:ring-primary-lighter/70"
                >
                  {l.label}
                </a>
              ))}
            </span>
          </dd>
        </div>
        <div>
          <dt className="typo-card-meta">{f.tickets}</dt>
          <dd className="mt-1 font-semibold text-gray-900 dark:text-white">
            {show.ticketTypes.map((t) => (
              <span key={t.id} className="block">
                {t.name} <span className="tabular-nums">{formatShowWon(t.price, locale)}</span>
              </span>
            ))}
            {show.onSitePriceNote && <span className="block font-normal text-gray-600 dark:text-gray-300">{show.onSitePriceNote}</span>}
          </dd>
        </div>
        <div>
          <dt className="typo-card-meta">{f.admission}</dt>
          <dd className="mt-1 text-gray-800 dark:text-gray-200">
            {f.admissionLine(show.ageRating, show.runningMinutes)}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        {bookable ? (
          // 하단 고정 바(MobileStickyCta)가 이 버튼이 보이는 동안 숨는다 — 같은 말을 하는 버튼 둘을 피한다.
          <Button asChild size="lg" shape="block" fullWidth>
            <a href="#book" data-hide-mobile-cta>{ctaLabel}</a>
          </Button>
        ) : (
          <p className="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{ctaLabel}</p>
        )}
        <p className="mt-2 text-center typo-caption text-gray-500 dark:text-gray-400">{f.salesClose}</p>
      </div>
    </BaseCard>
  );
}
