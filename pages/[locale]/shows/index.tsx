import SEO from '../../../components/SEO';
import ImageHero, { HERO_SCRIM_STRONG } from '../../../components/common/ImageHero';
import ShowCard from '../../../components/shows/ShowCard';
import { Section } from '../../../components/ui/Section';
import SectionHeading from '../../../components/ui/SectionHeading';
import { withI18nServerProps } from '../../../lib/getStatic';
import { SHOW_CONTACT_PHONE, SHOW_HERO_IMAGE } from '../../../lib/shows/copy';
import { listPublicShows, type PublicShow } from '../../../lib/shows/queries';

interface Props {
  upcoming: PublicShow[];
  past: PublicShow[];
  nowSec: number;
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

export default function ShowsIndexPage({ upcoming, past, nowSec }: Props) {
  return (
    <>
      <SEO
        title="공연 티켓 예매 | 스튜디오 놀"
        description="스튜디오 놀이 여는 공연의 일정과 티켓 예매 안내. 비지정석, 사전 예매는 온라인에서 받습니다."
        canonical="/ko/shows"
        availableLocales={['ko']}
        includeSchema
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: '공연', path: '/ko/shows' },
        ]}
      />
      <ImageHero
        locale="ko"
        priority
        backgroundImage={pickHeroImage(upcoming, past)}
        overlayGradient={HERO_SCRIM_STRONG}
        imageAlt=""
        title="공연"
        subtitle="스튜디오 놀이 여는 공연입니다. 사전 예매는 온라인에서 받고, 티켓(QR)은 메일로 보내 드립니다."
      />
      <Section>
        <SectionHeading eyebrow="예매" index="01" title="다가오는 공연" as="h2" />
        {upcoming.length === 0 ? (
          <div className="mx-auto max-w-xl text-center">
            <p className="typo-card-title text-gray-900 dark:text-white">지금 예매할 수 있는 공연이 없습니다</p>
            <p className="typo-card-body mt-3">새 공연은 SNS와 스토리에서 먼저 알립니다. 문의 {SHOW_CONTACT_PHONE}</p>
          </div>
        ) : (
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(upcoming.length)}`}>
            {upcoming.map((s) => (
              <ShowCard key={s.slug} show={s} nowSec={nowSec} />
            ))}
          </div>
        )}
      </Section>
      {past.length > 0 && (
        <Section variant="alternate">
          <SectionHeading eyebrow="아카이브" index="02" title="지난 공연" as="h2" />
          <div className={`mx-auto grid items-stretch gap-6 ${gridColumns(past.length)}`}>
            {past.map((s) => (
              <ShowCard key={s.slug} show={s} nowSec={nowSec} past />
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
  if (params?.locale !== 'ko') return { redirect: { destination: '/ko/shows', permanent: false } };
  // 공연 공개·잔여석이 바로 보여야 하고(관리자 공개 전환 직후), 공유 캐시는 짧게만 둔다 — 상세와 같다.
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  const now = new Date();
  try {
    const { upcoming, past } = await listPublicShows(now);
    return { props: { upcoming, past, nowSec: Math.floor(now.getTime() / 1000) } };
  } catch (error) {
    // DB 장애에 500을 내지 않는다 — 빈 목록 대신 짧게 캐시되는 빈 화면이 낫다. 로그는 남긴다.
    console.error('[shows] 목록 조회 실패:', error);
    res.setHeader('Cache-Control', 'no-store');
    return { props: { upcoming: [], past: [], nowSec: Math.floor(now.getTime() / 1000) } };
  }
});

// 디자인 판 — lib/designEdition.ts
ShowsIndexPage.designEdition = 'v2';
