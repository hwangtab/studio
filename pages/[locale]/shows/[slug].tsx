import Image from 'next/image';

import SEO from '../../../components/SEO';
import RefundPolicyList from '../../../components/shows/RefundPolicyList';
import ShowBookingForm from '../../../components/shows/ShowBookingForm';
import { withI18nServerProps } from '../../../lib/getStatic';
import { formatWon, ON_SITE_PRICE_NOTE, SALE_STATE_LABELS, SHOW_CONTACT_PHONE } from '../../../lib/shows/copy';
import { SHOW_SLUG_PATTERN } from '../../../lib/shows/failMessages';
import { getPublicShowBySlug, type PublicShow } from '../../../lib/shows/queries';

interface Props {
  show: PublicShow;
}

const SITE_URL = 'https://studionol.co.kr';
const toAbsolute = (p: string): string => (p.startsWith('http') ? p : `${SITE_URL}${p}`);

/** 검색 결과용 한 줄 요약 — 소개글 첫 문단을 잘라 쓴다. */
function summarize(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 150 ? `${flat.slice(0, 147)}…` : flat;
}

export default function ShowPage({ show }: Props) {
  const prices = show.ticketTypes.map((t) => t.price);
  const lowPrice = prices.length ? Math.min(...prices) : null;
  const url = `${SITE_URL}/ko/shows/${show.slug}`;

  // 회차마다 Event 하나 — 가격은 티켓 종류별 Offer. 취소·매진·마감 상태를 schema에도 반영한다.
  const schema = show.showtimes.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: show.title,
    startDate: new Date(s.startsAt * 1000).toISOString(),
    eventStatus:
      s.saleState === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: show.venueName,
      address: show.venueAddress,
    },
    ...(show.coverImage ? { image: [toAbsolute(show.coverImage)] } : {}),
    description: summarize(show.description),
    performer: { '@type': 'PerformingGroup', name: show.performers },
    organizer: { '@type': 'Organization', name: show.presenterName },
    offers: show.ticketTypes.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: t.price,
      priceCurrency: 'KRW',
      url,
      availability:
        (s.remaining[t.id] ?? 0) > 0 && s.saleState === 'open'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
    })),
  }));

  return (
    <>
      <SEO
        title={`${show.title} 티켓 예매 | 스튜디오 놀`}
        description={summarize(show.description)}
        canonical={`/ko/shows/${show.slug}`}
        ogImage={show.coverImage ?? undefined}
        availableLocales={['ko']}
        includeSchema
        schema={schema}
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: show.title, path: `/ko/shows/${show.slug}` },
        ]}
      />
      <main className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {show.coverImage && (
            <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 lg:mx-0">
              <Image
                src={show.coverImage}
                alt={`${show.title} 포스터`}
                fill
                priority
                sizes="(min-width: 1024px) 384px, 90vw"
                className="object-cover"
              />
            </div>
          )}
          <div className={show.coverImage ? '' : 'lg:col-span-2'}>
            <p className="typo-eyebrow">{show.presenterName} 주최</p>
            <h1 className="typo-page-title mt-1">{show.title}</h1>
            {show.cancelled && (
              <p role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                이 공연은 취소되었습니다. 결제하신 분께는 별도로 환불을 안내해 드립니다. 문의 {SHOW_CONTACT_PHONE}
              </p>
            )}
            <dl className="mt-6 space-y-3 text-sm text-gray-800 dark:text-gray-200">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">일시</dt>
                <dd>
                  <ul className="space-y-1">
                    {show.showtimes.map((s) => (
                      <li key={s.id}>
                        {s.label}
                        {s.saleState !== 'open' && (
                          <span className="ml-2 text-gray-500 dark:text-gray-400">({SALE_STATE_LABELS[s.saleState]})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">장소</dt>
                <dd>
                  {show.venueName}
                  <span className="block text-gray-500 dark:text-gray-400">{show.venueAddress}</span>
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">출연</dt>
                <dd>{show.performers}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">관람</dt>
                <dd>
                  {show.ageRating} · {show.runningMinutes}분 · 비지정석(선착순 입장)
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-gray-500 dark:text-gray-400">가격</dt>
                <dd>
                  <ul className="space-y-1">
                    {show.ticketTypes.map((t) => (
                      <li key={t.id}>
                        {t.name} {formatWon(t.price)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">{ON_SITE_PRICE_NOTE}</p>
                </dd>
              </div>
            </dl>

            <section aria-label="공연 소개" className="mt-8">
              <h2 className="typo-card-title">공연 소개</h2>
              <p className="mt-3 whitespace-pre-line typo-body text-gray-700 dark:text-gray-300">{show.description}</p>
            </section>
          </div>
        </div>

        <section aria-label="예매" className="mt-12 rounded-2xl border border-gray-200 p-5 dark:border-gray-700 md:p-8">
          <h2 className="typo-section-title mb-1">티켓 예매</h2>
          {lowPrice !== null && !show.cancelled && (
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{formatWon(lowPrice)}부터 · 온라인 예매는 공연 전날 자정에 마감됩니다.</p>
          )}
          <ShowBookingForm show={show} />
        </section>

        <section aria-label="취소·환불 규정" className="mt-10">
          <h2 className="typo-card-title">취소·환불 규정</h2>
          <RefundPolicyList className="mt-3" />
        </section>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  if (params?.locale !== 'ko') {
    return { redirect: { destination: SHOW_SLUG_PATTERN.test(slug) ? `/ko/shows/${slug}` : '/ko', permanent: false } };
  }
  if (!SHOW_SLUG_PATTERN.test(slug)) return { notFound: true };

  const show = await getPublicShowBySlug(slug, new Date());
  if (!show) return { notFound: true };
  // 색인 대상 공개 페이지 — 잔여석 숫자가 낡아도 되는 만큼만 CDN에 둔다(주문 생성이 최종 게이트).
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return { props: { show } };
});

// 디자인 판 — lib/designEdition.ts
ShowPage.designEdition = 'v2';
