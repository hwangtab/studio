import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import PledgeWizard from '../../../../components/funding/PledgeWizard';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import { computeProjectState, getFundingProject, type FundingProject } from '../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }

export default function PledgePage({ project, initialRewardId, remaining }: Props) {
  return (
    <>
      <Head><title>{project.title} 후원하기 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28">
        <p className="text-sm"><Link href={`/ko/funding/${project.slug}`} className="underline">← {project.title}</Link></p>
        <h1 className="mt-2 text-2xl font-bold">후원하기</h1>
        <div className="mt-8"><PledgeWizard project={project} initialRewardId={initialRewardId} remaining={remaining} /></div>
        <div className="mt-10"><FundingTrustNotice /></div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: `/ko/funding/${String(params?.slug ?? '')}/pledge`, permanent: false } };
  const project = getFundingProject(String(params.slug ?? ''));
  const now = new Date();
  if (!project) return { notFound: true };
  if (computeProjectState(project, now) !== 'live') return { redirect: { destination: `/ko/funding/${project.slug}`, permanent: false } };
  await expireStalePledges(now);
  const status = await aggregateProjectStatus(project, now);
  const initialRewardId = typeof query.reward === 'string' && project.rewards.some((r) => r.id === query.reward) ? query.reward : null;
  return { props: { project, initialRewardId, remaining: status.remaining } };
};
