import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import SEO from '../../../../components/SEO';
import MarkdownRenderer from '../../../../components/MarkdownRenderer';
import ResponsiveImage from '../../../../components/ResponsiveImage';
import { Section } from '../../../../components/ui/Section';
import FundingProgress from '../../../../components/funding/FundingProgress';
import RewardCard from '../../../../components/funding/RewardCard';
import BackerNameRoll from '../../../../components/funding/BackerNameRoll';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import FundingMobileCta from '../../../../components/funding/FundingMobileCta';
import RewardModal from '../../../../components/funding/RewardModal';
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import { buildPageStaticProps } from '../../../../lib/getStatic';
import { defaultLocale } from '../../../../lib/i18n';
import { computeProjectState, getAllFundingProjects, getFundingProject, stripRewardDownloads, type FundingProject, type FundingReward, type ProjectState } from '../../../../lib/funding/projects';

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
  return (
    <>
      <SEO
        title={`${project.title} — 펀딩 | 스튜디오 놀`}
        description={project.summary}
        canonical={`/ko/funding/${project.slug}`}
        ogImage={project.ogImage ?? project.cover}
        robots={project.hidden ? 'noindex, nofollow' : undefined}
      />
      {/*
        제목·본문(왼쪽)과 후원 패널(오른쪽)을 **페이지 맨 위부터** 나란히 둔다. 히어로를 따로
        띄우면 첫 화면이 그림과 제목으로만 차고 진행률·리워드는 스크롤해야 나온다 — 후원
        의사가 가장 높은 순간에 후원할 수단이 화면에 없는 셈이다. 패널은 데스크톱에서
        sticky라 본문을 읽는 내내 모금 현황과 리워드가 남는다.
      */}
      <Section className="pb-28 pt-24 md:pt-28 lg:pb-16">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="min-w-0">
            {/*
              커버는 목록 카드·OG 이미지와 같은 16:9 파일 하나를 공유하지만, 여기서는
              **정사각으로 잘라** 쓴다. 원본이 정사각 앨범아트면 16:9 파일의 좌우는 바탕색
              여백일 뿐이라, 넓게 펴 놓으면 큰 회색 판이 먼저 보이고 그림이 작아진다.
              가운데를 정사각으로 따면 여백이 통째로 빠져 작품만 남는다.
            */}
            <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8">
              <ResponsiveImage
                src={project.cover}
                alt=""
                containerClassName="relative block aspect-square w-full max-w-[15rem] overflow-hidden rounded-2xl shadow-lg sm:max-w-none"
                className="object-cover"
                priority
              />
              <div>
                <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary dark:bg-primary-light/15 dark:text-violet-300">
                  {STATE_LABEL[state]}
                </span>
                <h1 className="typo-card-title mt-3 text-gray-900 dark:text-white">{project.title}</h1>
                <p className="typo-card-body mt-3">{project.summary}</p>
              </div>
            </div>

            <div className="mt-12">
              {statusError && (
                <p role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                  현황을 불러오지 못했습니다. 새로고침해 주세요.
                </p>
              )}
              <article className="prose prose-lg max-w-none dark:prose-invert">
                <MarkdownRenderer content={project.content} locale="ko" />
              </article>
              <div className="mt-12 space-y-8">
                <BackerNameRoll names={data?.publicBackers ?? []} />
                <FundingTrustNotice />
              </div>
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
            <h2 className="typo-card-title mt-8 text-gray-900 dark:text-white">리워드</h2>
            <p className="typo-card-meta mt-2">후원 금액에 따라 돌려드릴 구성입니다.</p>
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

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getAllFundingProjects()
    .filter((p) => p.status !== 'draft')
    .map((p) => ({ params: { locale: defaultLocale, slug: p.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const project = getFundingProject(String(params?.slug ?? ''));
  if (!project || project.status === 'draft') return { notFound: true };
  return buildPageStaticProps(
    defaultLocale,
    // 공개 화면이라 내려받기 주소를 벗겨 내려보낸다(lib/funding/projects.ts 주석).
    { project: stripRewardDownloads(project), initialState: computeProjectState(project, new Date()) },
    { i18nSections: ['stories'] },
  );
};
