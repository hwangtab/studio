import Head from 'next/head';
import Link from 'next/link';

import { withI18nServerProps } from '../../../../lib/getStatic';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import { listProjectsForCreator, type CreatorProjectSummary } from '../../../../lib/funding/creatorProjectList';

const REVIEW_LABEL: Record<string, string> = {
  draft: '작성 중',
  submitted: '심사 중',
  changes_requested: '보완 요청',
  approved: '공개',
  rejected: '반려',
};

interface Props { projects: CreatorProjectSummary[] }

export default function CreatorHome({ projects }: Props) {
  return (
    <>
      <Head>
        <title>내 펀딩 프로젝트 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">내 펀딩 프로젝트</h1>
        {projects.length === 0 ? (
          <p className="mt-8 text-gray-600 dark:text-gray-400">아직 만든 프로젝트가 없습니다.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-sm text-gray-500">{REVIEW_LABEL[p.reviewStatus] ?? p.reviewStatus}</span>
                </div>
                {p.reviewNote && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">운영자 메모: {p.reviewNote}</p>
                )}
                {p.reviewStatus === 'approved' && (
                  <Link href={`/ko/funding/${p.slug}`} className="mt-3 inline-block text-sm underline">
                    공개된 페이지 보기
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-sm text-gray-500">
          프로젝트 만들기·편집은 다음 배포에서 열립니다. 문의는 메일로 주세요.
        </p>
      </main>
    </>
  );
}

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다
// (pages/[locale]/funding/[slug]/pledge.tsx:36과 같은 모양).
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  const projects = await listProjectsForCreator(auth.creatorId);
  return { props: { projects } };
});
