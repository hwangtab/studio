import Image from 'next/image';

import SEO from '../../../components/SEO';
import ShowBookingForm from '../../../components/shows/ShowBookingForm';
import ShowLineup from '../../../components/shows/ShowLineup';
import ShowMobileCta from '../../../components/shows/ShowMobileCta';
import { Button } from '../../../components/ui/Button';
import { Section } from '../../../components/ui/Section';
import { withI18nServerProps } from '../../../lib/getStatic';
import { formatWon, ON_SITE_PRICE_NOTE, SALE_STATE_LABELS, SHOW_CONTACT_PHONE } from '../../../lib/shows/copy';
import { parseDescriptionParagraphs, parsePerformers, splitShowTitle } from '../../../lib/shows/content';
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

  const { main: mainTitle, subtitle } = splitShowTitle(show.title);
  const performers = parsePerformers(show.performers);
  const paragraphs = parseDescriptionParagraphs(show.description);
  // 앞의 두 문단은 소개 본문, 나머지(시간·수익·가격 안내)는 짧은 안내 목록으로 보여 준다.
  const intro = paragraphs.slice(0, 2);
  const notices = paragraphs.slice(2);
  const bookable = !show.cancelled && show.showtimes.some((s) => s.saleState === 'open');
  const ctaLabel = bookable
    ? `티켓 예매하기${lowPrice !== null ? ` · ${formatWon(lowPrice)}` : ''}`
    : show.cancelled
      ? '취소된 공연입니다'
      : '지금은 예매할 수 없습니다';
  const mapUrl = `https://map.naver.com/p/search/${encodeURIComponent(`${show.venueName} ${show.venueAddress}`)}`;

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
          { name: '공연', path: '/ko/shows' },
          { name: show.title, path: `/ko/shows/${show.slug}` },
        ]}
      />

      {/* 히어로 — 포스터가 어두운 바탕이라 같은 결의 어두운 띠 위에 올린다. 가격·일시·장소와 예매 버튼이 첫 화면에 보인다. */}
      <section className="bg-gray-900 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-10 pt-24 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-12 md:pb-16 md:pt-32">
          {show.coverImage && (
            <div className="relative mx-auto aspect-[1200/1698] w-full max-w-[13rem] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10 md:max-w-sm">
              <Image
                src={show.coverImage}
                alt={`${show.title} 포스터`}
                fill
                priority
                sizes="(min-width: 768px) 384px, 70vw"
                className="object-cover"
              />
            </div>
          )}
          <div className={show.coverImage ? '' : 'md:col-span-2'}>
            <p className="text-sm font-semibold tracking-wide text-gray-300">{show.presenterName} 주최</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white md:text-5xl">{mainTitle}</h1>
            {subtitle && <p className="mt-2 text-lg text-gray-200 md:text-xl">{subtitle}</p>}

            {show.cancelled && (
              <p role="status" className="mt-5 rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
                이 공연은 취소되었습니다. 결제하신 분께는 별도로 환불을 안내해 드립니다. 문의 {SHOW_CONTACT_PHONE}
              </p>
            )}

            <dl className="mt-8 space-y-4">
              <div className="flex gap-4">
                <dt className="w-12 shrink-0 pt-0.5 text-sm text-gray-400">일시</dt>
                <dd className="text-lg font-semibold text-white">
                  <ul className="space-y-1">
                    {show.showtimes.map((st) => (
                      <li key={st.id}>
                        {st.label}
                        {st.saleState !== 'open' && (
                          <span className="ml-2 text-sm font-normal text-gray-400">({SALE_STATE_LABELS[st.saleState]})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-12 shrink-0 pt-0.5 text-sm text-gray-400">장소</dt>
                <dd className="text-lg font-semibold text-white">
                  {show.venueName}
                  <span className="block text-sm font-normal text-gray-300">{show.venueAddress}</span>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block rounded text-sm font-normal text-gray-200 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 dark:focus-visible:ring-white/70"
                  >
                    네이버 지도에서 보기
                  </a>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-12 shrink-0 pt-0.5 text-sm text-gray-400">티켓</dt>
                <dd className="text-lg font-semibold text-white">
                  {show.ticketTypes.map((t) => (
                    <span key={t.id} className="block">
                      {t.name} {formatWon(t.price)}
                    </span>
                  ))}
                  <span className="block text-sm font-normal text-gray-300">{ON_SITE_PRICE_NOTE}</span>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-12 shrink-0 pt-0.5 text-sm text-gray-400">관람</dt>
                <dd className="text-base text-gray-100">
                  {show.ageRating} · 약 {show.runningMinutes}분 · 비지정석(선착순 입장)
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              {bookable ? (
                <Button asChild size="lg" className="w-full md:w-auto md:min-w-[18rem]">
                  <a id="show-hero-cta" href="#book">{ctaLabel}</a>
                </Button>
              ) : (
                <p className="rounded-xl bg-gray-800 px-5 py-3 text-base font-semibold text-gray-100">{ctaLabel}</p>
              )}
              <p className="mt-3 text-sm text-gray-300">온라인 예매는 공연 전날 자정에 마감됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      <Section variant="default" spacing="tight">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-6 typo-section-title text-gray-900 dark:text-white">공연 소개</h2>
          <div className="space-y-5 break-keep text-base leading-8 text-gray-800 dark:text-gray-200 md:text-lg md:leading-9">
            {intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {notices.length > 0 && (
            <ul className="mt-8 space-y-2 break-keep rounded-2xl bg-gray-50 p-5 text-sm leading-7 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300 md:text-base">
              {notices.map((n) => (
                <li key={n} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 text-primary dark:text-primary-lighter">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {performers.length > 0 && (
        <Section variant="alternate" spacing="tight">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 typo-section-title text-gray-900 dark:text-white">출연</h2>
            <ShowLineup slug={show.slug} performers={performers} />
          </div>
        </Section>
      )}

      <Section variant="default" spacing="tight" id="tickets" className="pb-28 lg:pb-12">
        <div className="mx-auto max-w-2xl">
          <h2 className="typo-section-title text-gray-900 dark:text-white">티켓 예매</h2>
          {lowPrice !== null && !show.cancelled && (
            <p className="mb-6 mt-1 text-sm text-gray-600 dark:text-gray-300">
              {formatWon(lowPrice)} · 온라인 예매는 공연 전날 자정에 마감됩니다.
            </p>
          )}
          <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-700 md:p-8">
            <ShowBookingForm show={show} />
          </div>
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            문의 {SHOW_CONTACT_PHONE}
          </p>
        </div>
      </Section>

      {bookable && <ShowMobileCta label={ctaLabel} />}
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
