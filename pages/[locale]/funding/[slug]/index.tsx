import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../../components/SEO';
import MarkdownRenderer from '../../../../components/MarkdownRenderer';
import ImageHero, { HERO_SCRIM_STRONG } from '../../../../components/common/ImageHero';
import { Section } from '../../../../components/ui/Section';
import FundingProgress from '../../../../components/funding/FundingProgress';
import RewardCard from '../../../../components/funding/RewardCard';
import BackerWall from '../../../../components/funding/BackerWall';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import FundingMobileCta from '../../../../components/funding/FundingMobileCta';
import RewardModal from '../../../../components/funding/RewardModal';
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import { buildPageStaticProps } from '../../../../lib/getStatic';
import { defaultLocale } from '../../../../lib/i18n';
import { formatPriceAmount } from '../../../../data/pricing';
import imageMetadata from '../../../../utils/imageMetadata.json';

const SITE_URL = 'https://studionol.co.kr';
const toAbsolute = (p: string): string => (p.startsWith('http') ? p : `${SITE_URL}${p}`);
import { computeProjectState, getAllFundingProjects, stripRewardDownloads, type FundingProject, type FundingReward, type ProjectState } from '../../../../lib/funding/projects';
import { getFundingProjectAsync } from '../../../../lib/funding/repository';

interface Props {
  project: FundingProject;
  initialState: ProjectState;
}

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

export default function FundingProjectPage({ project, initialState }: Props) {
  // timing을 함께 넘긴다 — 훅이 오픈 시각에 맞춰 1회 재조회하고, 마운트 뒤로는 브라우저
  // 시계로도 상태를 다시 판정한다(FundingProjectCard와 같은 이유: 정적 생성된 initialState는
  // 빌드 시각에 고정돼 있고 상태 API 응답도 CDN 캐시라 최대 몇 분 뒤처진다). 오픈을 기다리며
  // 탭을 띄워 둔 사람에게 후원 버튼이 그 순간 나타나야 한다.
  const { data, error: statusError, state } = useFundingStatus(project.slug, initialState, {
    status: project.status,
    startAt: project.startAt,
    endAt: project.endAt,
  });
  const canPledge = state === 'live';
  // 렌더 본문에서 new Date()를 부르면 서버(빌드 시각)와 클라이언트 값이 달라 D-day 텍스트가
  // 하이드레이션 불일치를 낸다 — 마운트 후에만 시계를 읽는다.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  // 리워드 모달은 페이지에 **하나만** 둔다. 카드마다 띄우면 결제 위젯 인스턴스가 여러 벌
  // 살아 있을 수 있다.
  const [openReward, setOpenReward] = useState<FundingReward | null>(null);
  const closeModal = useCallback(() => setOpenReward(null), []);
  // 상태 API가 아직 안 왔으면 파일의 한정 수량을 그대로 쓴다(/pledge 페이지와 같은 폴백).
  const remaining = useMemo<Record<string, number | null>>(() => {
    const fallback = Object.fromEntries(project.rewards.map((r) => [r.id, r.totalQuantity]));
    return { ...fallback, ...(data?.remaining ?? {}) };
  }, [data?.remaining, project.rewards]);
  /**
   * 후원은 리워드가 딸린 **선주문 판매**다(기부가 아니다 — 약관·신뢰 고지와 같은 입장).
   * 그래서 Product + Offer로 적는다. 가격은 티어마다 달라 `lowPrice`로 최저가를 알린다.
   *
   * 마감일(`priceValidUntil`)을 넣는 이유: 없으면 구글이 오래된 오퍼로 보고 리치 결과에서
   * 내린다. `endAt`이 그대로 그 날짜다.
   */
  const fundingSchema = useMemo(() => {
    const amounts = project.rewards.map((r) => r.amount);
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: project.title,
      description: project.summary,
      image: toAbsolute(project.ogImage ?? project.cover),
      brand: { '@type': 'Organization', name: '스튜디오 놀' },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'KRW',
        lowPrice: Math.min(...amounts),
        highPrice: Math.max(...amounts),
        offerCount: amounts.length,
        availability: canPledge ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        priceValidUntil: project.endAt.slice(0, 10),
        url: `${SITE_URL}/ko/funding/${project.slug}`,
      },
    };
  }, [canPledge, project]);

  // OG 이미지의 실제 치수. 목록에 없으면 넘기지 않는다 — 틀린 값을 주느니 비우는 게 낫다.
  const ogImageSize = imageMetadata[(project.ogImage ?? project.cover) as keyof typeof imageMetadata] as
    | { width: number; height: number }
    | undefined;

  return (
    <>
      <SEO
        // 제목에 구분자를 두 번 겹치지 않는다 — 프로젝트 제목이 이미 '… 후원'으로 끝나는데
        // `— 펀딩 | 스튜디오 놀`을 붙이면 `—`와 `|`가 함께 나와 검색 결과에서 지저분하다.
        title={`${project.title} | 스튜디오 놀`}
        description={project.summary}
        canonical={`/ko/funding/${project.slug}`}
        ogImage={project.ogImage ?? project.cover}
        // 치수를 함께 주지 않으면 카카오·페이스북이 비율을 스스로 재협상한다.
        ogImageWidth={ogImageSize?.width}
        ogImageHeight={ogImageSize?.height}
        // includeSchema 기본값이 false라, 켜지 않으면 schema·breadcrumbs를 넘겨도 조용히 버려진다.
        includeSchema
        schema={fundingSchema}
        breadcrumbs={[
          { name: '홈', path: '/ko' },
          { name: '펀딩', path: '/ko/funding' },
          { name: project.title, path: `/ko/funding/${project.slug}` },
        ]}
        robots={project.hidden ? 'noindex, nofollow' : undefined}
      />
      {/*
        히어로는 사이트 공용 `ImageHero`를 그대로 쓴다(스크림 2단계·font-hero·투명 헤더가
        여기 묶여 있다). **정렬도 기본값(가운데)을 따른다** — `textAlign`을 넘기는 페이지는
        이 사이트에 하나도 없다.

        스크림만 STRONG으로 올린다. 짐작이 아니라 실측이다(ImageHero.tsx:27 — "짐작하지
        말고 재 볼 것"): 가운데 글씨 자리의 평균 휘도가 128/255이고, 그 안을 가로지르는
        LP의 밝은 띠는 167/255다. 기본 HERO_SCRIM으로는 그 띠가 3.8:1까지 떨어져 AA(4.5:1)
        에도 못 미친다. STRONG이면 글씨 자리 8.7:1, 밝은 띠 5.9:1로 둘 다 목표(6:1) 위다.
        배경을 갈아 끼우면 다시 잴 것.
      */}
      <ImageHero
        locale="ko"
        priority
        overlayGradient={HERO_SCRIM_STRONG}
        backgroundImage={project.heroImage ?? project.cover}
        imageAlt=""
        title={project.title}
        subtitle={
          <>
            {project.summary}
            <span className="mt-6 flex flex-wrap justify-center gap-2">
              {STATE_LABEL[state] && (
                <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
                  {STATE_LABEL[state]}
                </span>
              )}
              <span className="inline-block rounded-full border border-white/40 bg-black/30 px-4 py-1.5 text-sm">
                목표 {formatPriceAmount(project.goalAmount)}원
              </span>
            </span>
          </>
        }
        ctaButtons={
          canPledge ? (
            // 카카오가 아닌 목적지이므로 옐로를 쓰지 않는다(CLAUDE.md 카카오 CTA 규칙).
            // <lg에서는 FundingMobileCta가 상시 떠 있어 같은 버튼이 한 화면에 둘이 된다.
            <a
              href="#rewards"
              className="hidden h-14 lg:inline-flex items-center justify-center rounded-xl bg-primary px-8 text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
            >
              펀딩하기
            </a>
          ) : null
        }
      />

      {/*
        본문(왼쪽)과 펀딩 패널(오른쪽)을 나란히 둔다. 패널은 데스크톱에서 sticky라 본문을
        읽는 내내 모금 현황과 리워드가 화면에 남는다.
      */}
      <Section className="pb-28 pt-16 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            {statusError && (
              <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                현황을 불러오지 못했습니다. 새로고침해 주세요.
              </p>
            )}
            <article className="prose prose-lg max-w-none dark:prose-invert">
              <MarkdownRenderer content={project.content} locale="ko" />
            </article>
            <div className="mt-12 space-y-8">
              <BackerWall names={data?.publicBackers ?? []} messages={data?.publicMessages ?? []} />
              <FundingTrustNotice />
            </div>
          </div>

          <aside id="rewards" className="scroll-mt-20 lg:sticky lg:top-24">
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <FundingProgress
                goalAmount={project.goalAmount}
                endAt={project.endAt}
                now={now}
                data={data ? { raisedAmount: data.raisedAmount, backerCount: data.backerCount, percent: data.percent, state } : null}
              />
            </div>
            {/* 여기에 표지 썸네일을 두지 않는다. `cover`는 프로젝트의 얼굴(행사 포스터)이지
                리워드의 얼굴이 아니다 — 리워드 이미지는 각 리워드가 `image`로 갖는다. */}
            <h2 className="typo-card-title mt-8 text-gray-900 dark:text-white">리워드</h2>
            <p className="typo-card-meta mt-1">펀딩 금액에 따라 돌려드릴 구성입니다.</p>
            <div className="mt-4 space-y-4">
              {project.rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  remaining={remaining[r.id]}
                  pledgeHref={`/ko/funding/${project.slug}/pledge?reward=${encodeURIComponent(r.id)}`}
                  canPledge={canPledge}
                  onSelect={canPledge ? setOpenReward : undefined}
                />
              ))}
            </div>
          </aside>
        </div>
      </Section>

      <RewardModal project={project} reward={openReward} remaining={remaining} onClose={closeModal} />
      <FundingMobileCta visible={canPledge} />
    </>
  );
}

/**
 * 히어로가 헤더 밑까지 풀블리드로 깔리고 헤더가 투명해진다(Layout.tsx의 `hasHero` 분기).
 * 이 플래그가 없으면 main에 pt-20이 붙어 히어로 위에 흰 띠가 생긴다.
 */
FundingProjectPage.hasHero = true;

export const getStaticPaths: GetStaticPaths = async () => ({
  // 빌드 때는 파일 프로젝트만 만든다 — 빌드가 DB에 닿지 않게 하려는 것이다.
  // DB 프로젝트는 첫 요청에 생성돼 ISR로 캐시된다(blocking).
  paths: getAllFundingProjects()
    .filter((p) => p.status !== 'draft')
    .map((p) => ({ params: { locale: defaultLocale, slug: p.slug } })),
  fallback: 'blocking',
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  // fallback:'blocking'은 paths에 없는 요청(다른 로케일 포함)도 렌더를 시도한다.
  // 이 페이지는 ko 전용(하드코딩된 locale="ko")이라 다른 로케일 세그먼트로 들어오면
  // 404로 막아야 한다 — 안 막으면 /en/funding/<slug> 같은 주소가 그대로 생성돼 ISR로
  // 캐시된다(lib/koOnlyRoutes.ts가 지키는 불변식, koOnlyRoutes.test.ts가 대조).
  // 비-ko는 언제까지나 404가 맞다(이 페이지는 애초에 ko 전용) — revalidate를 주지 않는다.
  if (params?.locale !== defaultLocale) return { notFound: true };
  const project = await getFundingProjectAsync(String(params?.slug ?? ''));
  // revalidate 없는 notFound는 ISR에 영구히 캐시된다. 초안·미존재 slug는 그렇지 않다 —
  // 개설자가 승인 전에 자기 프로젝트 주소를 미리 열어 볼 수 있는데, 그때 404가 굳어 버리면
  // 나중에 승인해도 재배포 전까지 계속 404다. 승인이 배포를 기다리지 않게 하는 것이 이
  // 태스크의 목표이므로 여기는 revalidate: 60을 반드시 함께 준다(로케일 가드와 다른 이유).
  if (!project || project.status === 'draft') return { notFound: true, revalidate: 60 };
  return buildPageStaticProps(
    defaultLocale,
    // 공개 화면이라 내려받기 주소를 벗겨 내려보낸다(lib/funding/shape.ts 주석).
    { project: stripRewardDownloads(project), initialState: computeProjectState(project, new Date()) },
    { i18nSections: ['stories'], revalidate: 60 },
  );
};
