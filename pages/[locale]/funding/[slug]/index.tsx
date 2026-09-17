import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../../components/SEO';
import ProjectDetailView from '../../../../components/funding/ProjectDetailView';
import FundingMobileCta from '../../../../components/funding/FundingMobileCta';
import RewardModal from '../../../../components/funding/RewardModal';
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import { buildPageStaticProps } from '../../../../lib/getStatic';
import { defaultLocale } from '../../../../lib/i18n';
import imageMetadata from '../../../../utils/imageMetadata.json';

const SITE_URL = 'https://studionol.co.kr';
const toAbsolute = (p: string): string => (p.startsWith('http') ? p : `${SITE_URL}${p}`);
import { computeProjectState, getAllFundingProjects, stripRewardDownloads, type FundingProject, type FundingReward, type ProjectState } from '../../../../lib/funding/projects';
import { getFundingProjectAsync } from '../../../../lib/funding/repository';

interface Props {
  project: FundingProject;
  initialState: ProjectState;
}

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
        히어로·본문·리워드 합성은 공개 화면과 개설자 미리보기가 공유한다
        (`components/funding/ProjectDetailView.tsx`). 상태 폴링·후원 CTA(모달·모바일
        고정 바)는 여기(공개 페이지)에만 있다 — 미리보기에는 없어야 하는 것들이다.
      */}
      <ProjectDetailView
        project={project}
        state={state}
        status={data ? { pledgedAmount: data.raisedAmount, backerCount: data.backerCount } : null}
        interactive
        now={now}
        statusError={!!statusError}
        remaining={data?.remaining}
        onSelectReward={setOpenReward}
        backers={data?.publicBackers ?? []}
        messages={data?.publicMessages ?? []}
      />

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
