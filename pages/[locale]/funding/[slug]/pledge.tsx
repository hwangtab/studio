import { useEffect } from 'react';
import { withI18nServerProps } from '../../../../lib/getStatic';
import Head from 'next/head';
import Link from 'next/link';
import PledgeWizard from '../../../../components/funding/PledgeWizard';
import { useFundingStatus } from '../../../../components/funding/useFundingStatus';
import FundingTrustNotice from '../../../../components/funding/FundingTrustNotice';
import { computeProjectState, stripRewardDownloads, type FundingProject } from '../../../../lib/funding/projects';
import { getFundingProjectAsync } from '../../../../lib/funding/repository';
import { aggregateProjectStatus, expireStalePledges } from '../../../../lib/funding/service';
import { trackMicroEvent } from '../../../../utils/analytics';

interface Props { project: FundingProject; initialRewardId: string | null; remaining: Record<string, number | null> }

export default function PledgePage({ project, initialRewardId, remaining }: Props) {
  // GA4 key event로 지정 금지 — 마이크로 전환일 뿐 리드 지표가 아니다(utils/analytics.ts 참조).
  // 제출 성공이 아니라 위저드 진입 시점에 발화한다(펀딩 퍼널 이탈 측정 목적).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { trackMicroEvent('funding_pledge_start', { component: 'funding_pledge', landing_slug: project.slug }); }, []);
  // 남은 수량을 상세 페이지·모달과 같은 폴링으로 새로 받는다. 결제 실패 뒤 "다시 펀딩하기"와
  // 새 탭 클릭이 이 페이지로 오므로, SSR 값만 쓰면 폼을 채우는 사이 팔린 리워드를 품절로
  // 못 보여 주고 제출에서야 409로 알게 된다. PledgeWizard가 바뀐 remaining으로 담은 수량을 줄인다.
  const { data } = useFundingStatus(project.slug, 'live', { status: project.status, startAt: project.startAt, endAt: project.endAt });
  return (
    <>
      <Head><title>{project.title} 펀딩하기 | 스튜디오 놀</title><meta name="robots" content="noindex, nofollow" /></Head>
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:pt-32">
        <p className="typo-card-meta">
          <Link href={`/ko/funding/${project.slug}`} className="underline underline-offset-2 hover:text-primary dark:hover:text-primary-lighter">
            ← {project.title}
          </Link>
        </p>
        <h1 className="typo-section-title mt-3">펀딩하기</h1>
        <p className="typo-section-lead mt-3">리워드를 담고 후원자 정보를 입력하면 결제로 이어집니다.</p>
        <div className="mt-10"><PledgeWizard project={project} initialRewardId={initialRewardId} remaining={data?.remaining ?? remaining} /></div>
        <div className="mt-12"><FundingTrustNotice /></div>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<Props>(async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store');
  if (params?.locale !== 'ko') return { redirect: { destination: `/ko/funding/${String(params?.slug ?? '')}/pledge`, permanent: false } };
  const project = await getFundingProjectAsync(String(params.slug ?? ''));
  const now = new Date();
  if (!project) return { notFound: true };
  if (computeProjectState(project, now) !== 'live') return { redirect: { destination: `/ko/funding/${project.slug}`, permanent: false } };
  await expireStalePledges(now);
  const status = await aggregateProjectStatus(project, now);
  const initialRewardId = typeof query.reward === 'string' && project.rewards.some((r) => r.id === query.reward) && status.remaining[query.reward] !== 0
    ? query.reward : null;
  // 공개 화면이라 내려받기 주소를 벗겨 내려보낸다(lib/funding/projects.ts 주석).
  return { props: { project: stripRewardDownloads(project), initialRewardId, remaining: status.remaining } };
});

// 디자인 판 — lib/designEdition.ts
PledgePage.designEdition = 'v2';
