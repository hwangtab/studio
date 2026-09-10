import { useEffect, useState } from 'react';
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
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import { buildPageStaticProps } from '../../../../lib/getStatic';
import { defaultLocale } from '../../../../lib/i18n';
import {
  computeProjectState,
  getAllFundingProjects,
  getFundingProject,
  type FundingProject,
  type ProjectState,
} from '../../../../lib/funding/projects';

interface Props {
  project: FundingProject;
  initialState: ProjectState;
}

const STATE_LABEL: Record<ProjectState, string> = { live: '진행 중', upcoming: '오픈 예정', closed: '마감', draft: '' };

export default function FundingProjectPage({ project, initialState }: Props) {
  const { data, error: statusError } = useFundingStatus(project.slug, initialState);
  const state = data?.state ?? initialState;
  const canPledge = state === 'live';
  // 렌더 본문에서 new Date()를 부르면 서버(빌드 시각)와 클라이언트 값이 달라 D-day 텍스트가
  // 하이드레이션 불일치를 낸다 — 마운트 후에만 시계를 읽는다.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  return (
    <>
      <SEO
        title={`${project.title} — 펀딩 | 스튜디오 놀`}
        description={project.summary}
        canonical={`/ko/funding/${project.slug}`}
        ogImage={project.ogImage ?? project.cover}
        robots={project.hidden ? 'noindex, nofollow' : undefined}
      />
      <Section className="pb-16 pt-28 md:pb-20 md:pt-36">
        <div className="grid items-start gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
          <ResponsiveImage
            src={project.cover}
            alt=""
            containerClassName="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl shadow-lg"
            className="object-cover"
            priority
          />
          <div className="lg:pt-2">
            <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary dark:bg-primary-light/15 dark:text-primary-light">
              {STATE_LABEL[state]}
            </span>
            <h1 className="typo-section-title mt-3">{project.title}</h1>
            <p className="typo-section-lead mt-3">{project.summary}</p>
            {statusError && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                현황을 불러오지 못했습니다. 새로고침해 주세요.
              </p>
            )}
            <div className="glass-card mt-6 rounded-2xl p-5 sm:p-6">
              <FundingProgress
                goalAmount={project.goalAmount}
                endAt={project.endAt}
                now={now}
                data={data ? { raisedAmount: data.raisedAmount, backerCount: data.backerCount, percent: data.percent, state } : null}
              />
              {canPledge && (
                <a
                  href="#rewards"
                  className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-xl bg-primary px-8 text-lg font-bold text-white shadow-md transition-colors hover:bg-primary-dark"
                >
                  후원하기
                </a>
              )}
            </div>
          </div>
        </div>
      </Section>
      <Section className="py-12 md:py-16">
        <article className="prose prose-lg max-w-3xl dark:prose-invert">
          <MarkdownRenderer content={project.content} locale="ko" />
        </article>
      </Section>
      <Section id="rewards" variant="alternate" className="scroll-mt-16">
        <div className="max-w-3xl">
          <h2 className="typo-section-title">리워드</h2>
          <p className="typo-section-lead mt-3">후원 금액에 따라 돌려드릴 구성입니다. 배송이 있는 리워드는 배송지를 입력받습니다.</p>
        </div>
        <div className="mt-10 grid max-w-6xl items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {project.rewards.map((r) => (
            <RewardCard
              key={r.id}
              reward={r}
              remaining={data?.remaining[r.id] ?? (r.totalQuantity === null ? null : r.totalQuantity)}
              pledgeHref={`/ko/funding/${project.slug}/pledge?reward=${encodeURIComponent(r.id)}`}
              canPledge={canPledge}
            />
          ))}
        </div>
      </Section>
      <Section className="pb-28 pt-12 md:py-16">
        <div className="max-w-3xl space-y-8">
          <BackerNameRoll names={data?.publicBackers ?? []} />
          <FundingTrustNotice />
        </div>
      </Section>
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
    { project, initialState: computeProjectState(project, new Date()) },
    { i18nSections: ['stories'] },
  );
};
