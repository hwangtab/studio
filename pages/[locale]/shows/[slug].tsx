import SEO from '../../../components/SEO';
import ShowDetailView from '../../../components/shows/ShowDetailView';
import { withI18nServerProps } from '../../../lib/getStatic';
import { SHOW_SLUG_PATTERN } from '../../../lib/shows/failMessages';
import { showFaqItems } from '../../../lib/shows/faq';
import { fallbackShowLocale, SHOW_LOCALES, showCopy, toShowLocale, type ShowLocale } from '../../../lib/shows/i18n';
import { localizeShow } from '../../../lib/shows/localize';
import { getPublicShowBySlug, type PublicShow } from '../../../lib/shows/queries';
import imageMetadata from '../../../utils/imageMetadata.json';

interface Props {
  show: PublicShow;
  locale: ShowLocale;
}

const SITE_URL = 'https://studionol.co.kr';
const toAbsolute = (p: string): string => (p.startsWith('http') ? p : `${SITE_URL}${p}`);

/** 검색 결과용 한 줄 요약 — 소개글 첫 문단을 잘라 쓴다. */
function summarize(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 150 ? `${flat.slice(0, 147)}…` : flat;
}

export default function ShowPage({ show, locale }: Props) {
  const copy = showCopy(locale);
  const path = `/${locale}/shows/${show.slug}`;
  const url = `${SITE_URL}${path}`;
  const faq = showFaqItems(locale);
  const ogImage = show.ogImage ?? show.coverImage ?? undefined;
  const ogImageSize = ogImage ? (imageMetadata as Record<string, { width: number; height: number } | undefined>)[ogImage] : undefined;

  // 회차마다 Event 하나 — 가격은 티켓 종류별 Offer. 취소·매진·마감 상태를 schema에도 반영한다.
  const schema = show.showtimes.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: show.subtitle ? `${show.title} — ${show.subtitle}` : show.title,
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
    performer: show.performers.map((p) => ({ '@type': 'PerformingGroup', name: p.name })),
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
        title={copy.detailSeoTitle(show.title)}
        description={summarize(show.description)}
        canonical={path}
        ogImage={ogImage}
        ogImageWidth={ogImageSize?.width}
        ogImageHeight={ogImageSize?.height}
        availableLocales={SHOW_LOCALES}
        includeSchema
        schema={schema}
        faqItems={faq}
        breadcrumbs={[
          { name: copy.breadcrumbHome, path: `/${locale}` },
          { name: copy.breadcrumbShows, path: `/${locale}/shows` },
          { name: show.title, path },
        ]}
      />
      <ShowDetailView show={show} locale={locale} />
    </>
  );
}

/** 히어로가 헤더 밑까지 풀블리드로 깔리고 헤더가 투명해진다(Layout의 hasHero 분기). */
ShowPage.hasHero = true;

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  // 공연은 한국어·영어만 연다(lib/shows/i18n.ts). 다른 로케일은 영어 화면으로 보낸다.
  const locale = toShowLocale(params?.locale);
  if (!locale) {
    const to = fallbackShowLocale(params?.locale);
    return { redirect: { destination: SHOW_SLUG_PATTERN.test(slug) ? `/${to}/shows/${slug}` : `/${to}`, permanent: false } };
  }
  if (!SHOW_SLUG_PATTERN.test(slug)) return { notFound: true };

  const show = await getPublicShowBySlug(slug, new Date());
  if (!show) return { notFound: true };
  // 색인 대상 공개 페이지 — 잔여석 숫자가 낡아도 되는 만큼만 CDN에 둔다(주문 생성이 최종 게이트).
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return { props: { show: localizeShow(show, locale), locale } };
});

// 디자인 판 — lib/designEdition.ts
ShowPage.designEdition = 'v2';
