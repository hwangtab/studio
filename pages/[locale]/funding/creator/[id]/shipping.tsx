import Head from 'next/head';
import Link from 'next/link';

import { ShippingTable } from '../../../../../components/funding/creator/ShippingTable';
import { authenticateCreatorRequest } from '../../../../../lib/funding/creatorAuth';
import { loadCreatorShipping, type CreatorShippingView } from '../../../../../lib/funding/creatorShipping';
import { loadProjectForCreator } from '../../../../../lib/funding/creatorProjectWrite';
import { withI18nServerProps } from '../../../../../lib/getStatic';
import { getClientIp } from '../../../../../lib/contracts/client-ip';
import { privacyCreatorActor, recordPrivacyAccess } from '../../../../../lib/privacy/accessLog';

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
 * 마감 **날짜** 전에는 집계만, 지난 뒤에는 표까지 보인다 — `state`가
 * `lib/funding/creatorShipping.ts` 주석의 규칙을 그대로 반영한다(모금 중에는 셀프 취소가
 * 자유로워 주소가 들락날락한다). 운영자가 누른 조기 종료는 이 선을 앞당기지 않는다.
 *
 * 표가 실제로 실리는 경우에는 CSV 내려받기와 **같은 접속기록**을 남긴다 — 자세한 사정은
 * 아래 getServerSideProps 안의 주석에 적어 뒀다.
 */
export default function CreatorShippingPage({ view, projectTitle, projectId }: Props) {
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
            <ShippingTable projectId={projectId} rows={view.rows} />
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

  /**
   * 화면으로 보는 것도 접속기록에 남긴다.
   *
   * **행이 실릴 때만 남긴다.** 이 화면은 마감 뒤에 CSV와 같은 행·같은 항목을 그대로
   * `__NEXT_DATA__`에 실어 내려보낸다 — 받는 분 이름·연락처·우편번호·주소·상세주소·배송
   * 메모가 페이지 소스에 그대로 있다. 나가는 범위가 같으니 action도 같은
   * `funding_creator_shipping_export`를 쓰고, 별도 action을 새로 만들지 않는다. 같은 일에
   * 두 이름을 두면 나중에 한쪽만 조회해 "안 봤다"는 잘못된 결론이 나온다.
   *
   * 마감 전(`before_close`)에는 남기지 않는다. 그때 내려가는 것은 집계 숫자뿐이라
   * 개인정보가 한 줄도 나가지 않는데, 기록만 쌓으면 접속기록이 열람 사실을 가리키지 않게
   * 된다.
   *
   * 남의 프로젝트(위쪽 404)도 남기지 않는다 — CSV 라우트가 404·409를 남기지 않는 것과
   * 같은 판단이다(`pages/api/funding/creator/projects/[id]/shipping.csv.ts`의 주석).
   * 아무것도 조회되지 않은 경로라 남길 열람이 없다.
   *
   * `recordPrivacyAccess`는 절대 던지지 않으므로(`lib/privacy/accessLog.ts`) 실패해도 화면은
   * 그대로 뜬다. 그래도 `.catch`를 한 겹 더 두는 것은 CSV 라우트와 같은 이유다 — 그 규약이
   * 깨지는 날 배송 화면이 통째로 500이 되면 안 된다. await하는 것은 서버리스에서 응답 뒤
   * 실행이 얼어붙어 기록이 통째로 누락될 수 있기 때문이고, insert 한 줄이라 응답 지연은
   * CSV 라우트와 같은 수준이다.
   */
  if (view.state === 'open') {
    await recordPrivacyAccess({
      actor: privacyCreatorActor(auth.creatorId),
      action: 'funding_creator_shipping_export',
      targetId: id,
      result: 'success',
      rowCount: view.rows.length,
      ip: getClientIp(context.req),
    }).catch((error: unknown) => {
      console.error('[privacy] 접속기록 호출 실패 — 배송 화면은 계속됩니다', error);
    });
  }

  return { props: { view, projectTitle: project.title, projectId: id } };
});
