import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { createProject, logoutCreator } from '../../../../components/funding/creator/api';
import { REVIEW_STATUS_LABEL } from '../../../../components/funding/creator/types';
import { Button } from '../../../../components/ui/Button';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { authenticateCreatorRequest } from '../../../../lib/funding/creatorAuth';
import { listProjectsForCreator, type CreatorProjectSummary } from '../../../../lib/funding/creatorProjectList';

interface Props { projects: CreatorProjectSummary[] }

export default function CreatorHome({ projects }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    const result = await createProject();
    if (result.ok) {
      router.push(`/ko/funding/creator/${result.id}`);
      return;
    }
    setCreateError(result.message);
    setCreating(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    // 실패를 무시하고 이동하면 세션이 실제로는 남아 있는데 로그아웃된 것처럼 보인다
    // (2026-09-17 리뷰 지적) — 성공했을 때만 이동한다.
    const result = await logoutCreator();
    if (result.ok) {
      router.push('/ko/funding/apply');
      return;
    }
    setLogoutError(result.message);
    setLoggingOut(false);
  };

  return (
    <>
      <Head>
        <title>내 펀딩 프로젝트 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-3xl font-bold">내 펀딩 프로젝트</h1>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="typo-caption text-gray-500 underline underline-offset-2 disabled:opacity-50 dark:text-gray-400"
            >
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </button>
            {logoutError && (
              <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{logoutError}</span>
            )}
          </div>
        </div>
        {projects.length === 0 ? (
          <p className="mt-8 text-gray-600 dark:text-gray-400">아직 만든 프로젝트가 없습니다.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {projects.map((p) => (
              <li key={p.id} className="glass-card rounded-2xl p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{p.title || '(제목 없음)'}</span>
                  <span className="text-sm text-gray-500">{REVIEW_STATUS_LABEL[p.reviewStatus] ?? p.reviewStatus}</span>
                </div>
                {p.reviewNote && (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">운영자 메모: {p.reviewNote}</p>
                )}
                <div className="mt-3 flex gap-4">
                  <Link href={`/ko/funding/creator/${p.id}`} className="text-sm underline underline-offset-2">
                    편집하기
                  </Link>
                  {p.reviewStatus === 'approved' && (
                    <Link href={`/ko/funding/${p.slug}`} className="text-sm underline underline-offset-2">
                      공개된 페이지 보기
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-10 flex items-center gap-3">
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? '만드는 중…' : '새 프로젝트 만들기'}
          </Button>
          {createError && <span role="alert" className="typo-caption text-red-600 dark:text-red-400">{createError}</span>}
        </div>
      </main>
    </>
  );
}

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다
// (pages/[locale]/funding/[slug]/pledge.tsx:36과 같은 모양).
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  context.res.setHeader('Cache-Control', 'no-store');
  // funding의 다른 SSR 형제 페이지(success·manage/[orderNo])와 같은 자리, 같은 방식 —
  // 펀딩은 ko 전용이라 비-ko 경로는 같은 화면을 ko로 되돌린다. 이 가드가 없으면 세션
  // 쿠키가 path=/라 로케일을 안 가려서 /en/funding/creator가 같은 목록을 그대로 렌더해
  // 같은 화면이 7개 URL로 존재하게 된다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: '/ko/funding/creator', permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  const projects = await listProjectsForCreator(auth.creatorId);
  return { props: { projects } };
});
