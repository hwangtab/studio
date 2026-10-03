/* eslint-disable @next/next/no-html-link-for-pages --
 * private 페이지(URL에 토큰이 실린다)의 이탈 링크는 next/link가 아니라 문서 이동이어야 한다.
 * 근거: lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts
 */
import Head from 'next/head';

import ShowTicketManage from '../../../../components/shows/ShowTicketManage';
import { denyContractPageCaching } from '../../../../lib/contracts/page-cache';
import { withI18nServerProps } from '../../../../lib/getStatic';
import { getShowOrderForManage, type ManageOrderView } from '../../../../lib/shows/queries';
import { ticketQrDataUrl } from '../../../../lib/shows/qr';

interface ManageProps {
  order: ManageOrderView;
  /** 취소 요청에 재사용하는 쿼리 토큰 — order.manageToken 자체는 내려보내지 않는다. */
  token: string;
  qr: Record<string, string>;
}

export default function ShowManagePage({ order, token, qr }: ManageProps) {
  return (
    <>
      <Head>
        <title>내 티켓 | 스튜디오 놀</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto max-w-lg px-4 py-16">
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">스튜디오 놀</p>
        <ShowTicketManage order={order} token={token} qr={qr} />
        {/* private 페이지(URL에 관리 토큰이 실린다)의 이탈 링크는 문서 이동 + noreferrer —
            lib/analytics/privatePaths.ts, tests/pages/privateLinkNavigation.test.ts */}
        <p className="mt-10 text-center text-sm">
          <a href={`/ko/shows/${order.showSlug}`} rel="noreferrer" className="underline">공연 안내 보기</a>
          <span aria-hidden="true" className="mx-2 text-gray-400">·</span>
          <a href="/ko" rel="noreferrer" className="underline">홈으로</a>
        </p>
      </main>
    </>
  );
}

export const getServerSideProps = withI18nServerProps<ManageProps>(async (context) => {
  // 이 화면은 구매자 이름·티켓 QR을 담는다 — 공유 캐시 헤더를 렌더 전에 덮어쓴다(booking/manage와 같다).
  denyContractPageCaching(context.res);

  const { locale, orderNo } = context.params as { locale: string; orderNo: string };
  if (locale !== 'ko') return { redirect: { destination: '/ko', permanent: false } };

  const { token } = context.query;
  // 토큰 없음·불일치·주문 부재·티켓 주문 아님을 전부 같은 notFound로 답한다(존재 여부 노출 방지).
  if (typeof orderNo !== 'string' || orderNo.trim() === '' || typeof token !== 'string' || token.trim() === '') {
    return { notFound: true };
  }
  const order = await getShowOrderForManage(orderNo, token, new Date());
  if (!order) return { notFound: true };

  // QR은 입장 가능한 티켓에만 만든다. 생성 실패는 화면을 막지 않는다(입장번호·주문번호로 확인 가능).
  const qr: Record<string, string> = {};
  const live = order.tickets.filter((t) => t.status === 'issued' && !t.checkedIn);
  await Promise.all(
    live.map(async (t) => {
      try {
        qr[t.id] = await ticketQrDataUrl(t.code);
      } catch (error) {
        console.error('[shows-manage] QR 생성 실패', { orderNo, error: (error as Error).message });
      }
    }),
  );
  return { props: { order, token, qr } };
});

// 디자인 판 — lib/designEdition.ts
ShowManagePage.designEdition = 'v2';
