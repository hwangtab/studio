import { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import PledgeWizard from '../../../../components/funding/PledgeWizard';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import { computeProjectState, getFundingProject, type FundingProject } from '../../../../lib/funding/projects';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';
import { trackMicroEvent } from '../../../../utils/analytics';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }

export default function PledgePage({ project, initialRewardId, remaining }: Props) {
  // GA4 key event로 지정 금지 — 마이크로 전환일 뿐 리드 지표가 아니다(utils/analytics.ts 참조).
  // 제출 성공이 아니라 위저드 진입 시점에 발화한다(펀딩 퍼널 이탈 측정 목적).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { trackMicroEvent('funding_pledge_start', { component: 'funding_pledge', landing_slug: project.slug }); }, []);
  return (
    <>
      <Head><title>{project.title} 후원하기 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:pt-32">
        <p className="typo-card-meta">
          <Link href={`/ko/funding/${project.slug}`} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">
            ← {project.title}
          </Link>
        </p>
        <h1 className="typo-section-title mt-3">후원하기</h1>
        <p className="typo-section-lead mt-3">리워드를 고르고 후원자 정보를 입력하면 결제로 이어집니다.</p>
        <div className="mt-10"><PledgeWizard project={project} initialRewardId={initialRewardId} remaining={remaining} /></div>
        <div className="mt-12"><FundingTrustNotice /></div>
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
  const initialRewardId = typeof query.reward === 'string' && project.rewards.some((r) => r.id === query.reward) && status.remaining[query.reward] !== 0
    ? query.reward : null;
  return { props: { project, initialRewardId, remaining: status.remaining } };
};
