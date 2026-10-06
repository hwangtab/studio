import SEO from '../../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../../components/common/ImageHero';
import ShowCard from '../../../components/shows/ShowCard';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import { withI18nServerProps } from '../../../lib/getStatic';
import { SHOW_HERO_IMAGE } from '../../../lib/shows/copy';
import { fallbackShowLocale, SHOW_LOCALES, showCopy, toShowLocale, type ShowLocale } from '../../../lib/shows/i18n';
import { localizeShow } from '../../../lib/shows/localize';
import { listPublicShows, type PublicShow } from '../../../lib/shows/queries';

interface Props {
  upcoming: PublicShow[];
  past: PublicShow[];
  nowSec: number;
  locale: ShowLocale;
}

/**
 * 목록 히어로의 배경은 **가장 가까운 공연의 포스터**다 — 펀딩 목록이 진행 중 프로젝트의 커버를 쓰는 것과 같은 규칙.
 * 공연이 하나도 없을 때만 고정 사진(SHOW_HERO_IMAGE)으로 떨어진다.
 */
const pickHeroImage = (upcoming: PublicShow[], past: PublicShow[]): string =>
  upcoming[0]?.coverImage ?? past[0]?.coverImage ?? SHOW_HERO_IMAGE;

/** 1장이면 한 칸, 2장이면 두 칸까지만 벌린다 — 3열 고정이면 한 장짜리가 왼쪽으로 몰린다(펀딩 목록과 같다). */
const gridColumns = (count: number): string =>
  count <= 1 ? 'max-w-sm' : count === 2 ? 'max-w-3xl md:grid-cols-2' : 'max-w-6xl md:grid-cols-2 lg:grid-cols-3';

export default function ShowsIndexPage({ upcoming, past, nowSec, locale }: Props) {
  const copy = showCopy(locale).list;
  const crumbs = showCopy(locale);
  return (
    <>
      <SEO
        title={copy.seoTitle}
        description={copy.seoDescription}
        canonical={`/${locale}/shows`}
        availableLocales={SHOW_LOCALES}
        includeSchema
        breadcrumbs={[
          { name: crumbs.breadcrumbHome, path: `/${locale}` },
          { name: crumbs.breadcrumbShows, path: `/${locale}/shows` },
        ]}
      />
      <ImageHero
        locale={locale}
        priority
        backgroundImage={pickHeroImage(upcoming, past)}
        overlayGradient={HERO_SCRIM_STRONG}
        imageAlt=""
        title={copy.heroTitle}
        subtitle={copy.heroSubtitle}
      />
      <Section>
        <SectionHeading eyebrow={copy.upcomingEyebrow} index="01" title={copy.upcoming} as="h2" />
        {upcoming.length === 0 ? (
          <div className="mx-auto max-w-xl text-center">
            <p className="typo-card-title text-gray-900 dark:text-white">{copy.empty}</p>
            <p className="typo-card-body mt-3">{copy.emptyHint}</p>
          </div>
        ) : (
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(upcoming.length)}`}>
            {upcoming.map((s) => (
              <ShowCard key={s.slug} show={s} nowSec={nowSec} locale={locale} />
            ))}
          </div>
        )}
      </Section>
      {past.length > 0 && (
        <Section variant="alternate">
          <SectionHeading eyebrow={copy.pastEyebrow} index="02" title={copy.past} as="h2" />
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(past.length)}`}>
            {past.map((s) => (
              <ShowCard key={s.slug} show={s} nowSec={nowSec} locale={locale} past />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** 히어로가 헤더 밑까지 풀블리드로 깔리고 헤더가 투명해진다(Layout의 hasHero 분기). */
ShowsIndexPage.hasHero = true;

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, res }) => {
  const locale = toShowLocale(params?.locale);
  if (!locale) return { redirect: { destination: `/${fallbackShowLocale(params?.locale)}/shows`, permanent: false } };
  // 공연 공개·잔여석이 바로 보여야 하고(관리자 공개 전환 직후), 공유 캐시는 짧게만 둔다 — 상세와 같다.
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  const now = new Date();
  try {
    const { upcoming, past } = await listPublicShows(now);
    return {
      props: {
        upcoming: upcoming.map((s) => localizeShow(s, locale)),
        past: past.map((s) => localizeShow(s, locale)),
        nowSec: Math.floor(now.getTime() / 1000),
        locale,
      },
    };
  } catch (error) {
    // DB 장애에 500을 내지 않는다 — 빈 목록 대신 짧게 캐시되는 빈 화면이 낫다. 로그는 남긴다.
    console.error('[shows] 목록 조회 실패:', error);
    res.setHeader('Cache-Control', 'no-store');
    return { props: { upcoming: [], past: [], nowSec: Math.floor(now.getTime() / 1000), locale } };
  }
});

// 디자인 판 — lib/designEdition.ts
ShowsIndexPage.designEdition = 'v2';
