import Head from 'next/head';
import Link from 'next/link';

import { ShippingTable } from '../../../../../components/funding/creator/ShippingTable';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { loadCreatorShipping, type CreatorShippingView } from '../../../../../lib/funding/creatorShipping';
import { loadProjectForCreator } from '../../../../../lib/funding/creatorProjectWrite';
import { withI18nServerProps } from '../../../../../lib/getStatic';

interface Props {
  view: CreatorShippingView;
  projectTitle: string;
  projectId: string;
}

/**
 * 개설자가 자기 프로젝트의 배송지를 보는 화면.
 *
 * 개설자 세션은 매직링크 기반이고 쿠키가 `SameSite=lax`다(관리자는 `strict`) — 관리자
 * 화면보다 한 겹 얇은 자리라 좁게 연다. 소유는 `loadCreatorShipping`이 SQL JOIN으로
 * 다시 대조하므로(`lib/funding/creatorShipping.ts`), 이 화면이 따로 권한 로직을 두지
 * 않는다.
 *
 * 마감 전에는 집계만, 마감 뒤에는 표까지 보인다 — `state`가 `lib/funding/creatorShipping.ts`
 * 주석의 규칙을 그대로 반영한다(모금 중에는 셀프 취소가 자유로워 주소가 들락날락한다).
 */
export default function CreatorShippingPage({ view, projectTitle }: Props) {
  const { summary } = view;

  return (
    <>
      <Head>
        <title>배송지 | {projectTitle} | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-4xl px-4 py-16">
        <Link
          href="/ko/funding/creator"
          className="typo-caption text-gray-500 underline underline-offset-2 dark:text-gray-400"
        >
          ← 내 프로젝트 목록
        </Link>

        <h1 className="mt-4 text-2xl font-bold">{projectTitle} · 배송지</h1>

        <section className="mt-8 rounded-xl border border-gray-200 p-5 dark:border-gray-700">
          <h2 className="typo-body font-semibold">집계</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <dt className="typo-caption text-gray-500 dark:text-gray-400">후원자 수</dt>
              <dd className="text-xl font-bold">{summary.backerCount}</dd>
            </div>
            <div>
              <dt className="typo-caption text-gray-500 dark:text-gray-400">배송이 필요한 건수</dt>
              <dd className="text-xl font-bold">{summary.shippingRequiredCount}</dd>
            </div>
          </dl>
          {summary.byReward.length > 0 && (
            <ul className="mt-4 space-y-1 typo-body">
              {summary.byReward.map((r) => (
                <li key={r.rewardId} className="flex justify-between gap-3 text-gray-700 dark:text-gray-300">
                  <span>
                    {r.rewardTitle}
                    {r.requiresShipping ? '' : ' (배송 없음)'}
                  </span>
                  <span className="font-medium">{r.quantity}개</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          {view.state === 'before_close' ? (
            <p className="rounded-lg bg-gray-100 p-4 typo-body text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              배송지는 마감 뒤에 열립니다. 모금 중에는 후원자가 자유롭게 후원을 취소할 수 있어
              주소가 그때그때 바뀔 수 있기 때문입니다.
            </p>
          ) : (
            <ShippingTable rows={view.rows} />
          )}
        </section>
      </main>
    </>
  );
}

// 주석을 달지 않는다 — withI18nServerProps는 Props에 locale·i18nResources를 더한 타입을 돌려준다
// (pages/[locale]/funding/creator/[id]/preview.tsx와 같은 모양).
export const getServerSideProps = withI18nServerProps<Props>(async (context) => {
  // 배송지가 담긴 화면이다 — 중간 캐시에 남으면 안 된다.
  context.res.setHeader('Cache-Control', 'no-store');
  const id = typeof context.params?.id === 'string' ? context.params.id : '';
  // funding의 다른 SSR 형제 페이지와 같은 자리, 같은 방식 — 펀딩은 ko 전용이라 비-ko
  // 경로는 같은 화면을 ko로 되돌린다.
  if (context.params?.locale !== 'ko') {
    return { redirect: { destination: `/ko/funding/creator/${encodeURIComponent(id)}/shipping`, permanent: false } };
  }
  const auth = await authenticateCreatorRequest(context);
  if (!auth.ok) return { redirect: { destination: '/ko/funding/apply', permanent: false } };
  if (!id) return { notFound: true };

  // loadProjectForCreator도 소유를 대조하지만(guard와 같은 조건), 여기서는 제목만 쓰려고
  // 부른다 — 아래 loadCreatorShipping이 실제 표시 데이터의 소유를 다시 대조하므로 두 조회가
  // 같은 조건을 이중으로 확인하는 셈이다. 한쪽만 남의 프로젝트를 통과시키는 사고를 막으려면
  // 둘 다 자신의 소유 조건을 스스로 검사하는 편이, 한쪽이 다른 쪽의 결과를 그대로 믿는
  // 것보다 안전하다.
  const project = await loadProjectForCreator(auth.creatorId, id);
  if (!project) return { notFound: true };

  const view = await loadCreatorShipping(auth.creatorId, id);
  if (!view) return { notFound: true };

  return { props: { view, projectTitle: project.title, projectId: id } };
});
