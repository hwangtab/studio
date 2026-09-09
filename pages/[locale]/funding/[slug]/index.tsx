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
  const { data } = useFundingStatus(project.slug, initialState);
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
      <Section className="pt-28">
        <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
          <ResponsiveImage
            src={project.cover}
            alt=""
            containerClassName="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl"
            className="object-cover"
            priority
          />
          <div>
            <p className="text-sm font-semibold text-primary dark:text-accent">{STATE_LABEL[state]}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{project.title}</h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300">{project.summary}</p>
            <div className="mt-6">
              <FundingProgress
                goalAmount={project.goalAmount}
                endAt={project.endAt}
                now={now}
                data={data ? { raisedAmount: data.raisedAmount, backerCount: data.backerCount, percent: data.percent, state } : null}
              />
            </div>
            {canPledge && (
              <a
                href="#rewards"
                className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-8 font-bold text-white hover:bg-primary-dark"
              >
                후원하기
              </a>
            )}
          </div>
        </div>
      </Section>
      <Section>
        <article className="prose prose-lg max-w-3xl dark:prose-invert">
          <MarkdownRenderer content={project.content} locale="ko" />
        </article>
      </Section>
      <Section id="rewards" variant="alternate">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">리워드</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      <Section>
        <BackerNameRoll names={data?.publicBackers ?? []} />
        <div className="mt-10">
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
